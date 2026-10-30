---

name: web-05-deserialization
sequence: web-05
category: misc
domain: web
description: "Insecure deserialization attack checklist: identifying deserialization sinks, Java/PHP/.NET/Python deserialization exploitation, ysoserial gadget chains, magic method abuse, and detection evasion. Use when testing deserialization endpoints or developing deserialization exploits."
wordlist_ref: "wordlists/web/web-20-deserialization/"
---

## Full Methodology

# Insecure Deserialization

Happens when applications deserialize program objects without proper precaution. An attacker can then manipulate serialized objects to change program behavior and even execute code.

## Shortcut

1. Search source for deserialization that touches user input.
2. If black-box, look for large, opaque blobs (cookies, headers, bodies) and unusual content-types.
3. Identify features that must deserialize user-supplied data (session, jobs/queues, file metadata, tokens).
4. If identity is embedded, tamper to attempt auth bypass.
5. Try to escalate to RCE/logic abuse carefully and non-destructively.

## Mechanisms

- Occurs when user-controlled data is deserialized without strict allowlists and integrity checks. Exploits often occur during deserialization (magic methods, constructors), before app logic runs.
- Prefer data formats that don’t instantiate code (JSON), and disable polymorphic typing.

## Hunt

1.  **Identify Potential Inputs:**
    - HTTP parameters/headers/cookies, file uploads, message queues, caches, DB‑stored user content
2.  **Recognize Serialized Data:**
    - **PHP:** `O:<len>:"Class":...` (often Base64), PHAR archives (`phar://`)
    - **Java:** hex `ac ed 00 05` or Base64 `rO0`; XMLDecoder/XStream flows
    - **.NET:** legacy `BinaryFormatter`/`SoapFormatter` (unsafe/deprecated); Base64 `AAEAAAD/////`
    - **Python:** `pickle` opcodes; unsafe `yaml.load` without `SafeLoader`
    - **Ruby:** `YAML.load` unsafe; use `safe_load`
3.  **Source Review (if available):**
    - **Java:** `ObjectInputStream.readObject`; enable `ObjectInputFilter`, disable Jackson default typing; use allowlists
    - **PHP:** `unserialize()`; file operations that dereference `phar://`
    - **.NET:** avoid `BinaryFormatter`; use `System.Text.Json`
    - **Python:** avoid `pickle` for untrusted data; `yaml.safe_load`
    - **Node.js:** `node-serialize`, `serialize-javascript`, `funcster` with unsafe eval()
    - **Golang:** `encoding/gob` with interface{} type confusion
    - **Ruby:** `Marshal.load()`, `YAML.load()` without `safe_load`
    - **Rust:** `serde` with YAML/bincode, `ron` (Rusty Object Notation)
4.  **Dynamic Analysis:** Intercept and mutate; watch for error stack traces, class names, and timing anomalies.

## Bypass Techniques

1.  **Alternate Gadgets/Classes:** Switch payload chains if blocklists are present.
2.  **Type Confusion:** Change expected types to bypass weak validation.
3.  **Indirect Paths:** Sink data into storage that a different component later deserializes.
4.  **Format Specific:** PHAR wrappers, XML entity tricks, language‑specific unserialize quirks.
5.  **Post‑deserialization Impact:** Abuse magic methods that run before validation.

## Language-Specific Details

### Node.js

- **node-serialize**: RCE via `_$$ND_FUNC$$_` IIFE pattern
  ```javascript
  {"rce":"_$$ND_FUNC$$_function(){require('child_process').exec('whoami', function(error, stdout){console.log(stdout)});}()"}
  ```
- **serialize-javascript**: Unsafe eval() when not properly escaped
- **funcster**: Arbitrary function serialization leads to code execution
- **Detection**: Look for `{"_$$ND_FUNC$$_` or serialized function strings in cookies/tokens

### Golang

- **encoding/gob**: Type confusion attacks when using `interface{}` types
  ```go
  // Vulnerable: accepts any type
  var data interface{}
  dec := gob.NewDecoder(buffer)
  dec.Decode(&data)
  ```
- **encoding/json**: Generally safe but Unmarshal into `interface{}` allows unexpected types
- **MessagePack**: Unsafe reflection in `github.com/vmihailenco/msgpack` with custom decoders
- **Mitigation**: Use concrete types, avoid `interface{}` for untrusted data

### Rust

- **serde**: Generally memory-safe but logic bugs possible with custom `Deserialize` implementations
- **bincode**: Binary serialization - ensure versioning and size limits
- **ron** (Rusty Object Notation): Can deserialize into arbitrary types if schema not restricted
- **YAML**: `serde_yaml` with untrusted input can cause DoS via deeply nested structures
- **Best Practice**: Use `#[serde(deny_unknown_fields)]` and explicit type constraints

### Additional Languages

- **Ruby**:
  - `Marshal.load()`: Gadget chains exist (e.g., `Gem::Requirement`, `Gem::RequestSet`)
  - Tools: `Ruby Marshal RCE` (exploit scripts)
- **Python**:
  - `pickle`: Extensive gadget chains, `__reduce__` magic method exploitation
  - `yaml.load()`: Use `yaml.safe_load()` or `yaml.load(data, Loader=yaml.SafeLoader)`
- **Java**:
  - Apache Commons Collections (InvokerTransformer chain)
  - Spring Framework (PropertyPathFactoryBean)
  - Tool: `ysoserial` - generates payloads for 30+ gadget chains

## Modern Attack Vectors

### Container & Kubernetes

- **ConfigMaps/Secrets**: Applications deserializing YAML/JSON from ConfigMaps without validation
- **Admission Webhooks**: Kubernetes admission controllers deserializing `AdmissionReview` objects
  - Test by submitting pods with malicious annotations or labels containing serialized payloads
- **CRD Controllers**: Custom Resource Definitions with unsafe deserialization in reconciliation loops
- **Attack**: Submit malicious Custom Resource → controller deserializes → RCE in cluster

### Message Queues

- **Kafka/RabbitMQ/Redis**: Consumers blindly deserializing messages from queues
  ```python
  # Vulnerable consumer
  msg = consumer.receive()
  data = pickle.loads(msg)  # Attacker controls msg
  ```
- **Testing**: Publish crafted serialized objects to queues if you have producer access
- **Impact**: Compromise all consumers processing the poisoned queue

### Serverless Functions

- **AWS Lambda**: Event payloads deserialized from S3 triggers, SNS, SQS
- **Google Cloud Functions**: HTTP request bodies automatically deserialized
- **Azure Functions**: Blob triggers with automatic deserialization
- **Attack Vector**: Upload malicious serialized object to S3 → Lambda deserializes → RCE in serverless context

### CI/CD Pipelines

- **Jenkins**: Java deserialization in remoting protocol (multiple CVEs)
- **GitLab Runners**: YAML deserialization in `.gitlab-ci.yml` with unsafe anchors/aliases
- **GitHub Actions**: Workflow files with embedded serialized data in custom actions
- **Build Artifacts**: Deserializing cached build objects from untrusted sources

### GraphQL / API Gateways

- **Custom Scalars**: GraphQL custom scalar types deserializing complex objects
- **Input Coercion**: API gateways converting JSON to language objects without validation
- **Batch Operations**: Bulk import/export features deserializing uploaded files

## Vulnerabilities / Impacts

- **RCE via gadget chains**: Execute arbitrary code through chained object instantiation
- **Arbitrary file access**: Read/write files via path traversal in deserialization
- **DoS via resource bombs**: Billion laughs-style attacks with nested objects (zip bombs, XML bombs)
- **Auth bypass via object field tampering**: Modify `is_admin`, `role`, `user_id` fields in session objects
- **Downstream SQLi with tainted fields**: Deserialized objects used in SQL queries without sanitization
- **Memory exhaustion**: Allocate large data structures during deserialization
- **Type juggling attacks**: Language-specific type coercion vulnerabilities

## Methodologies

- Identify → Format → Mutate/Fuzz → Exploit chain → Verify impact safely
- Tools: `ysoserial`, `phpggc`, `ysoserial.net`, Burp Deserialization Scanner, Semgrep rules for dangerous sinks, `marshalsec`, gadget inspectors.

## Remediation Recommendations

1.  Avoid deserializing untrusted input; use JSON with schemas.
2.  Verify integrity first (HMAC/signature) and only then deserialize; reject on mismatch.
3.  Use safe, specific serializers without polymorphic typing; implement allowlists.
4.  Isolate deserialization code under least privilege and sandboxing; timeouts/memory limits.
5.  Keep libraries updated; monitor for anomalies.




## Hacker Mindset

**Look for the magic bytes.** Java starts with `ac ed 00 05` or `rO0`. PHP starts with `O:`. .NET starts with `AAEAAAD///`. Python pickle starts with `gASV`. If you see these patterns, deserialization is happening.

**Gadget chains beat sandboxes.** Java's `InvokerTransformer` chain works on most unpatched servers. ysoserial has 30+ chains for a reason.

**Blind deserialization is common.** You won't always get RCE output. Use OOB callbacks to confirm.



## Chaining & Escalation

### Direct Escalation
This vulnerability can often be escalated directly. Test for RCE, data access, or privilege escalation depending on context.

### Chain with Other Skills
| Partner Vulnerability | Chain Effect |
|----------------------|--------------|
| SSRF | Use SSRF to reach internal services through this vuln |
| XSS | Stolen sessions amplify account-level findings |
| IDOR/BOLA | Find more data to exploit via authorization gaps |

### Amplification
Race conditions, parallel requests, and HTTP/2 single-packet attacks can amplify impact by 10-50x.



## OOB Detection & Blind Confirmation

### Blind Confirmation
Always set up OOB detection before testing. Use:
- **Burp Collaborator** — built into Burp Suite Pro
- **Interactsh** — OOB detection server (https://app.interactsh.com)
- **Canarytokens** for callback detection

### Timing Side-Channel
If OOB is blocked, use time-based detection:
- Inject `sleep(5)` or equivalent
- Compare response times between baseline and injected requests
- 5s+ delay = vulnerability confirmed



## Tools

- Burp Suite (manual testing + Intruder)
- curl / httpx
- Nuclei templates
- ysoserial
- phpggc
- ysoserial.net
- marshalsec

## Wordlist Invocation

When testing this vulnerability, invoke the wordlist payloads manually:

**Wordlist**: `wordlists/web/web-20-deserialization/`

**Files**:
- `wordlists/web/web-20-deserialization/payloads/deserialization/` — staged exploit payloads (low → med → high)

**Workflow**:
1. Start with `low` stage payloads — minimal risk probes
2. If signals detected, escalate to `med` stage
3. Use `high` only after confirmation (OOB/time-based where applicable)
4. Always establish a baseline response before running time-based payloads

**Tools**: curl, httpx, Burp Suite, or any HTTP client

