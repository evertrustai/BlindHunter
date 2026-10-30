# Subdomain Recon Playbook

## Tools
- subfinder -d target.com -o subs.txt
- assetfinder --subs-only target.com >> subs.txt
- cat subs.txt | sort -u | httpx -silent -o live.txt
- katana -list live.txt -d 3 -o urls.txt
- waybackurls target.com > wayback.txt
- gau --subs target.com >> wayback.txt

## Analysis
- grep -E "\?|=" urls.txt | unfurl params > params.txt
- subjs -i live.txt -o js-urls.txt
- httpx -l js-urls.txt -content-type | grep javascript
