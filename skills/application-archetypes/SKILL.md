---
name: application-archetypes
description: "Instant recognition of any target's category (E-commerce, SaaS, Fintech, Social, Marketplace, CMS, Admin Panel) plus ready-made assets, roles, workflows, top logic bugs, and attack chains for each type. Load BEFORE starting any target. Integrates with app-model-builder and business-logic-hunter."
---

# APPLICATION ARCHETYPES

Identify archetype → know assets, roles, workflows, and top bugs before sending a single request.

## ARCHETYPE TABLE

| Archetype | Core Assets | Key Actors | Top 3 Bugs | Best Attack Chain |
|-----------|-------------|------------|------------|-------------------|
| **E-commerce** | Products, prices, orders, carts, coupons, payments, addresses, reviews | Guest, Shopper, Merchant, Admin | IDOR on orders/payment, coupon race condition, mass assignment on price | Race coupon → stack discounts → IDOR change order owner → free goods |
| **SaaS (B2B)** | Workspaces, users, roles, billing, integrations | Owner, Admin, Member, Guest | Cross-tenant BOLA, mass assignment on role, payment manipulation | Org ID BOLA → admin API key → full tenant breach |
| **Fintech/Wallet** | Balance, transactions, recipients, payment methods | User, Admin, Support | IDOR on transaction list, race on withdrawal, missing auth on balance | Race withdrawal → multiple payouts; IDOR on admin export → mass PII |
| **Social/Content** | Posts, messages, followers, groups, media | User, Moderator, Admin | IDOR on private posts, mass assignment on author, missing auth on delete | Webhook injection → SSRF → cloud metadata → credentials |
| **Marketplace** | Listings, bookings, reviews, payouts, disputes | Buyer, Seller, Admin | IDOR on booking, mass assignment on payout amount, review fraud | IDOR on seller payout → change amount; fake reviews via self-purchase |
| **Admin Panel** | Users, config, logs, audit trails, billing | Regular Admin, Super Admin | Missing auth on routes, client-side-only role check, IDOR in user management | Client-side role check bypass → super admin → delete production data |
| **CMS/Blog** | Posts, pages, media, users, comments, themes | Author, Editor, Admin | IDOR on drafts, mass assignment on published status, missing auth on media | Draft IDOR → read unpublished posts; media upload → path traversal |
| **Health/Tech** | Patient records, appointments, diagnoses, insurance | Patient, Doctor, Admin | IDOR on records, mass assignment on diagnosis, appointment race | Patient ID BOLA → all records → PHI breach |

## WORKFLOW
1. Match target's business model, features, auth levels, and money flows to the closest archetype.
2. Load the model into the schema with target-specific details.
3. Route to business-logic-hunter + api-security + attack-path-builder.
4. For ambiguous targets, test the highest-revenue flow first.

## COMMON FALSE POSITIVES BY ARCHETYPE
- E-commerce: Coupon stacking with intended limits · IDOR on public-order status (meant to be visible)
- SaaS: Cross-tenant data from public landing pages · admin-only endpoints behind a client-side check
- Fintech: Read-only transaction list (intended) · rate-limited withdrawal (designed security)
- Social: Public-profile data confused with private · cached responses appearing as IDOR

## REFERENCE FILES

| Reference File | Content |
|----------------|---------|
| `reference/quick-identification-table.md` | جدول سريع لتصنيف أي هدف (سؤالين تحدد الأركيتايب) |
| `reference/archetype-to-model-pipeline.md` | تحويل الأركيتايب إلى Application Model كامل |
| `reference/ecommerce-retail.md` | E-commerce: أصول، أدوار، تدفقات، ثغرات خاصة |
| `reference/saas-cloud-platform.md` | SaaS/Cloud: إيجارات، планы، cross-tenant |
| `reference/banking-fintech.md` | Fintech: محافظ، تحويلات، ثغرات financial logic |
| `reference/social-media.md` | Social Media: posts, messages, privacy violations |
| `reference/marketplace-platform.md` | Marketplace: listings, bookings, payouts |
| `reference/cms-content-management.md` | CMS/Blog: محتوى، وسائط، صلاحيات نشر |
| `reference/subscription-membership.md` | Subscription: خطط، تجارب، فوترة دورية |
| `reference/wallet-crypto.md` | Wallet/Crypto: أرصدة، معاملات، Web3 logic |
| `reference/developer-platform-api.md` | Developer API: مفاتيح API، rate limits، BOLA |
| `reference/hybrid-target-mapping.md` | Hybrid: أهداف متعددة الأركيتايبز |
| `reference/first-5-tests-per-archetype.md` | أول 5 اختبارات لكل أركيتايب |
| `reference/bounty-range-per-archetype.md` | نطاق الباونتي المتوقع لكل أركيتايب |
