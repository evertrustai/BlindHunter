# Passive Recon — From a TLD to Full Surface (Zero Traffic)

Goal: build the largest possible asset inventory **without sending a single packet to the target**. Every command below queries third-party datasets (cert logs, search engines, archived crawls, public GitHub).

## 1. DNS / Cert Transparency

```bash
T=acme.com

# Cert transparency (best single source for subdomains, including internal-named ones)
curl -s "https://crt.sh/?q=%25.$T&output=json" | jq -r '.[].name_value' | tr ',' '\n' | sort -u > sub.crt
curl -s "https://api.certspotter.com/v1/issuances?domain=$T&include_subdomains=true&expand=dns_names" | jq -r '.[].dns_names[]' >> sub.crt
curl -s "https://tls.bufferover.run/dns?q=.$T" | jq -r '.Results[]' | awk '{print $5}' >> sub.crt

# Aggregator tools
subfinder -d $T -all -recursive -silent -o sub.sf
amass enum -passive -d $T -silent -o sub.am
chaos -d $T -silent -o sub.ch
findomain -t $T --quiet -u sub.fd

# Cert-SAN cross-pivot (find sibling TLDs via shared certs)
cero $T -c 1000 > sub.cero

# Recursive deep (some tools find sub-subs)
echo "$T" | dnsx -silent -ptr -a -aaaa -cname -ns -mx -txt > dns.records
```

## 2. Search Engine / Archive Mining

```bash
# Wayback / common-crawl historical URLs (gold for old vuln endpoints)
gau --threads 10 --subs $T > urls.gau
waybackurls $T > urls.wb
katana -passive -list <(echo $T) > urls.kat
curl -s "https://urlscan.io/api/v1/search/?q=domain:$T&size=10000" | jq -r '.results[].page.url' > urls.us
hakrawler -url https://$T -plain -d 3 < /dev/null > urls.hk 2>/dev/null

# Google dorks (manual, but worth it)
# site:$T -www inurl:admin|login|dev|staging|test|api|graphql|swagger|debug
# site:$T filetype:env|sql|bak|log|conf|yaml|yml|json
# site:$T intext:"password"|"secret"|"api_key"|"BEGIN RSA"
# site:github.com $T "password" | "api_key" | "token"
# site:postman.com $T
# site:trello.com $T
# site:s3.amazonaws.com $T
```

## 3. GitHub / GitLab / Postman / Docker

```bash
# Subdomains leaked in code
github-subdomains -d $T -t $GH_TOKEN -o sub.gh

# Secrets (verified mode = no FPs)
trufflehog github --org=$ORG --only-verified --json > secrets.th
gitleaks dir --org $ORG --report-format json -r secrets.gl.json
noseyparker scan github --org $ORG && noseyparker report

# Per-repo dorks via gh CLI
gh search code --owner $ORG "api_key" --limit 100
gh search code --owner $ORG "BEGIN PRIVATE KEY" --limit 100
gh search code --owner $ORG "filename:.env" --limit 100

# Postman public workspaces
curl -s "https://www.postman.com/_api/ws/proxy" \
  -H 'Content-Type: application/json' \
  -d "{\"service\":\"search\",\"method\":\"POST\",\"path\":\"/search-all\",\"body\":{\"queryText\":\"$T\",\"domain\":\"public\"}}"

# Docker Hub
curl -s "https://hub.docker.com/v2/search/repositories/?query=$ORG"
# Then pull suspicious images and trufflehog them
docker pull $ORG/internal:latest
trufflehog docker --image $ORG/internal:latest

# NPM / PyPI public packages
npm search "@$ORG" --json
curl -s "https://pypi.org/simple/" | grep -i $ORG
```

## 4. ASN / IP Range Mapping

```bash
# Find the org's ASNs (covers cloud + on-prem)
whois -h whois.cymru.com " -v $(dig +short $T)" | tail -1
amass intel -org "$ORG" -src
asnmap -d $T -silent

# Then enumerate every IP in those ASNs
asnmap -a AS12345 -silent | mapcidr -silent > ips.asn
```

## 5. Shodan / Censys / Fofa / ZoomEye (passive)

```bash
shodan search "ssl.cert.subject.cn:*.$T" --fields ip_str,port,product
shodan search "hostname:$T"
shodan search "org:\"$ORG\""

censys search "services.tls.certificates.leaf_data.subject.common_name:$T"
censys search "autonomous_system.name:\"$ORG\""

# fofa.info  - excellent for foreign assets
fofa search "domain=\"$T\"" -fields host,ip,port,title,server
```

## 6. Favicon / TLS Fingerprint Pivot

```bash
# Compute favicon mmh3 hash, then pivot to all assets sharing it (often non-obvious siblings)
python3 -c "
import mmh3, codecs, requests
r=requests.get('https://$T/favicon.ico').content
print(mmh3.hash(codecs.encode(r,'base64')))" > fav.hash
shodan search "http.favicon.hash:$(cat fav.hash)"
```

## 7. Dedup + Resolve

```bash
cat sub.* | grep -E "\.$T\$" | tr 'A-Z' 'a-z' | sort -u > subs.uniq
dnsx -silent -l subs.uniq -a -resp -o dns.live
awk -F'[][]' '{print $2}' dns.live | sort -u > ips.live
```

## Output of this phase

You should have:
- `subs.uniq`        — every plausible subdomain
- `dns.live`         — resolving hosts → IPs
- `ips.live`         — unique IPs to port-scan
- `urls.gau` etc     — historical URL corpus
- `secrets.*`        — verified leaked credentials
- `juicy.urls`       — file extensions worth fetching

Move to `recon-active.md`.
