# Active Recon — Fingerprint, Probe, Harvest

After passive recon, you have `subs.uniq` + `ips.live`. Now confirm which are alive and what they run.

## 1. HTTP probing

```bash
httpx -l subs.uniq \
  -silent -status-code -title -tech-detect -ip -cname -cdn \
  -web-server -follow-redirects -threads 100 \
  -json -o probe.json

# Quick TUI of interesting hits
jq -r 'select(.status_code<400) | "\(.status_code)\t\(.title)\t\(.tech)\t\(.url)"' probe.json | column -t -s$'\t'
```

Key columns: **CNAME** (takeover signal), **tech** (CVE map), **title** (exposed-service signal).

## 2. Port scan

```bash
# Top 1000 ports fast
naabu -list ips.live -top-ports 1000 -rate 2000 -o ports.naabu

# Full sweep on smaller IP set
nmap -sV -sC -p- --min-rate 5000 -iL ips.live -oA nmap.deep -Pn -n

# Common interesting ports (per service)
# 22 23 25 53 80 110 143 443 445 873 1433 1521 2049 2375 2376 2379 2380 2483 3000 3306 3389
# 4369 5000 5432 5601 5672 5984 6379 7000 7001 7077 7474 7687 8000 8008 8080 8086 8088 8089
# 8161 8443 8500 8888 9000 9001 9042 9090 9092 9200 9300 9418 11211 15672 25565 27017 27018
```

## 3. Screenshot for fast visual triage

```bash
gowitness file -f subs.uniq -P shots/ --threads 20
# Or aquatone (HTML report grouped by similarity)
cat subs.uniq | aquatone -out aquatone-out -threads 20
```

Open the HTML report and scan for:
- Default branding (Jenkins, Grafana, Kibana, Spring, MongoDB Express)
- "Welcome / Setup" pages = never-finished install = often anon-RCE
- Old-style admin panels
- Stack traces / phpinfo / debug exceptions

## 4. JS harvesting

```bash
# Spider for JS and links
katana -list alive.txt -d 5 -jc -kf all -aff -fs fqdn -silent -o crawled.txt
gospider -S alive.txt -d 5 -c 10 --js --sitemap --robots -o gospider/

# Extract JS URLs and download
grep -E '\.js(\?|$)' crawled.txt | awk -F'?' '{print $1}' | sort -u > js.urls
mkdir -p js
while read u; do
  name=$(echo "$u" | sha1sum | awk '{print $1}').js
  curl -s "$u" -o "js/$name"
done < js.urls

# Source maps (if present, you get full source)
grep -lE 'sourceMappingURL=' js/* | while read f; do
  m=$(grep -oE 'sourceMappingURL=\S+' "$f" | awk -F= '{print $2}')
  echo "$f -> $m"
done

# Extract endpoints + secrets from JS
linkfinder -i 'js/*.js' -o cli > js.endpoints
jsluice urls js/*.js > js.endpoints.jsluice
jsluice secrets js/*.js > js.secrets
trufflehog filesystem js/ --only-verified
retire --jspath js/ --outputformat json --outputpath retire.json
```

## 5. Endpoint / Parameter fuzzing (controlled)

```bash
# Sensitive paths
ffuf -w wordlists/sensitive.txt -u "FUZZ" -input-cmd "cat alive.txt" \
  -mc 200,403 -ac -t 50 -o ffuf.sensitive.json -of json

# Common admin/dev paths
seclists=/usr/share/seclists
ffuf -w $seclists/Discovery/Web-Content/raft-large-directories.txt \
  -u https://$T/FUZZ -mc 200,401,403 -ac -t 40

# Parameter discovery on identified endpoints
arjun -u https://$T/api/v1/user -m GET,POST --headers "User-Agent: bountyhunter"
paramspider --domain $T --quiet -o params.txt
```

## 6. Manual exposure sweep (no scanner required)

Scanners like nuclei are **confirmation tools, not discovery tools**. They miss:
- Custom endpoints unique to the target
- Logic-tied exposures (only reachable with a specific header / referer)
- Anything not in a public template

Manual approach — three loops:

**Loop A — sensitive path probe (curl + parallel):**

```bash
# Curated short wordlist; add target-specific guesses
cat > paths.sensitive <<EOF
.git/HEAD
.git/config
.svn/entries
.hg/store/data
.env
.env.local
.env.production
.DS_Store
web.config
config.php.bak
config.php.swp
backup.sql
backup.zip
dump.sql
db.sqlite
phpinfo.php
info.php
server-status
server-info
actuator
actuator/env
actuator/heapdump
actuator/mappings
actuator/health
api/swagger.json
api/swagger-ui
swagger-ui.html
v2/api-docs
graphql
graphiql
__graphql
admin
administrator
manager/html
jmx-console
console
solr/
elasticsearch
_cat/indices
debug
debug/pprof
trace
metrics
.well-known/security.txt
.well-known/openid-configuration
robots.txt
sitemap.xml
crossdomain.xml
EOF

# Probe each path on each alive host, log only 200s and interesting 403s
while read host; do
  while read path; do
    code=$(curl -sk -o /dev/null -w "%{http_code}" -m 8 "$host/$path")
    [[ "$code" =~ ^(200|401|403)$ ]] && echo "$code $host/$path"
  done < paths.sensitive
done < alive.txt | tee exposure.hits

# Then manually fetch each 200 — read it, don't trust the status code
grep '^200 ' exposure.hits | awk '{print $2}' | while read u; do
  echo "=== $u ==="
  curl -sk -m 8 "$u" | head -50
done > exposure.contents
```

**Loop B — banner / title pattern grep over `probe.json`:**

```bash
# Fingerprint to bug-class mapping (manual rules — accurate and explainable)
jq -r '.url + "\t" + (.title // "") + "\t" + (.webserver // "") + "\t" + ((.tech // []) | join(","))' probe.json |
while IFS=$'\t' read url title server tech; do
  case "$title$server$tech" in
    *Jenkins*)              echo "JENKINS $url" ;;
    *Grafana*)              echo "GRAFANA $url" ;;
    *Kibana*)               echo "KIBANA $url" ;;
    *Elasticsearch*|*\"name\":*\"cluster*) echo "ES $url" ;;
    *Spring*Boot*|*Whitelabel*) echo "SPRING $url" ;;
    *GitLab*)               echo "GITLAB $url" ;;
    *Confluence*)           echo "CONFLUENCE $url" ;;
    *Jira*)                 echo "JIRA $url" ;;
    *phpMyAdmin*)           echo "PHPMYADMIN $url" ;;
    *Drupal*)               echo "DRUPAL $url" ;;
    *WordPress*)            echo "WP $url" ;;
    *FortiGate*|*FortiOS*)  echo "FORTI $url" ;;
    *BIG-IP*|*F5*)          echo "F5 $url" ;;
    *Citrix*|*NetScaler*)   echo "CITRIX $url" ;;
    *MOVEit*)               echo "MOVEIT $url" ;;
    *Telerik*)              echo "TELERIK $url" ;;
    *Airflow*)              echo "AIRFLOW $url" ;;
    *Zeppelin*)             echo "ZEPPELIN $url" ;;
    *) ;;
  esac
done | tee fingerprints.hits
```

For each `fingerprints.hits` entry, open `references/exposed-services.md` and `references/preauth-cves.md`, then **manually verify the version and try the matching technique**. Do not blast nuclei templates — confirm version → choose technique → run one targeted PoC.

**Loop C — historical-URL diff (find dead-but-reachable endpoints):**

```bash
# Endpoints in wayback that current crawl missed = stale / forgotten / often vulnerable
sort -u urls.gau urls.wb > urls.hist
sort -u crawled.txt > urls.curr
comm -23 urls.hist urls.curr > urls.forgotten

# Quickly check which forgotten ones are still alive
httpx -l urls.forgotten -silent -mc 200,401,403 -o urls.forgotten.alive
```

These three loops out-perform nuclei on real targets because they encode **judgement**, not pattern matches.

### When to use nuclei (sparingly)

Only after manual triage, and only for **confirmation**:
- Confirming a specific CVE on a host you already fingerprinted: `nuclei -l host -id CVE-YYYY-NNNN`
- Sanity-sweeping for trivial takeovers across hundreds of CNAMEs: `nuclei -l subs.uniq -t http/takeovers/ -severity high,critical`
- Never blast `-t cves/` blindly — most templates have version-detection holes and produce FPs you'll waste hours on.

## 7. Build the attack-surface table

For each alive host, populate:

```
host | ip | cname | port | tech | server-banner | title | auth-required | interesting-paths
```

Filter and pivot in `nq` / `csvkit` / a spreadsheet. The hosts where `auth-required=false` and `tech in {Jenkins, Grafana, Spring, Kibana, MongoDB, ...}` are your first targets.
