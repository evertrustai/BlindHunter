# Reference — Livewire snapshot decoding

Livewire 3 stores component state in `wire:snapshot="..."` attributes on
the root element of each component. The attribute is a URL-encoded JSON
envelope. Decoding it is the fastest way to confirm a Filament IDOR.

## Anatomy of a snapshot

After URL-decoding `&quot;` → `"`, etc:

```json
{
  "data": {
    "<bound-property-name>": [<value>, {"class": "<ModelClass>", "key": <id>, "s": "mdl"}],
    "<another-property>": [<value>, {"s": "arr"}],
    "data": [{ /* nested form data tree */ }],
    "isTableLoaded": false,
    "tableRecordsPerPage": 10
  },
  "memo": {
    "id": "<component-instance-id>",
    "name": "<component-class-name>",           // ← Livewire component name
    "path": "<current-page-path-relative>",     // ← server-resolved route
    "method": "GET",
    "children": {...},
    "scripts": [],
    "assets": [],
    "errors": [],
    "locale": "en"
  },
  "checksum": "<sha256 hex>"
}
```

## What each field tells you

- `data.<name>[1]."class"` + `.key` — A reference to an Eloquent model
  bound to the component property `<name>`. The `key` IS the primary key,
  the `class` IS the model class. **If the key is for a foreign tenant
  and the page rendered 200, you have IDOR.**
- `data.data` — Filament form's state tree, deep-nested. Contains the
  user-visible field values (customer name, billing address, line items,
  etc.). Diff this between an own-baseline and a cross-tenant probe to
  prove the foreign data is rendered.
- `memo.name` — Livewire component class. Useful to confirm you're
  hitting the right Filament Resource page (e.g.,
  `events.email-reminder` indicates the EmailReminder page of EventResource).
- `memo.path` — The path the server thinks it's serving. If you requested
  `/events/93919/emails-and-reminders` and `memo.path` matches, the
  server accepted the foreign ID.
- `checksum` — SHA-256 over `data + memo` with the app's session-bound
  secret. Verified server-side on `/livewire/update` POSTs. Protects
  against tampering of submitted snapshots, NOT against using a foreign
  snapshot the server itself returned.

## Quick decode (Python)

```python
import re, html, json
body = open("response.html").read()
for s in re.findall(r'wire:snapshot="([^"]+)"', body):
    snap = json.loads(html.unescape(s))
    print(snap["memo"]["name"], snap["memo"]["path"],
          {k: v[1].get("key") for k, v in snap["data"].items()
           if isinstance(v, list) and len(v)==2 and isinstance(v[1], dict) and "key" in v[1]})
```

## Common Filament component names worth grepping

- `events.dashboard`, `events.email-reminder`,
  `events.balance-and-payouts`, `events.ticket-revenue-chart`
- `orders.edit`, `orders.refund`, `orders.transfer`
- `users.edit`, `users.invitation`
- `notifications` — every page renders this one (Filament toaster bar)
- `filament.tables.table` — every list page renders this; useful to find
  paginators that may expose data via API

## When the snapshot looks "empty" but the page is 200

If the cross-tenant page renders 200 but the snapshot's `data` field is
mostly blank (`name = null`, `email = null`), one of these is happening:

1. The page is loading the foreign record but a downstream policy is
   blanking the fields before render. Still IDOR (you've confirmed model
   load by foreign ID), but lower-impact. Look for sibling pages on the
   same Resource that don't blank.
2. The page renders an empty form because the model is soft-deleted.
   Re-probe with a fresh foreign ID.
3. The snapshot you decoded is a Filament chrome component
   (`notifications`), not the data component. Find the snapshot whose
   `memo.name` matches the Resource page name.

## When the snapshot's `data` field has XSS / Burp Collaborator payloads

Stored XSS / Collaborator probes in customer-name fields are common
evidence that researchers have probed the system before. They prove the
bug has been touched but not fixed. Mention them in the report's
"researcher notes" section as evidence that the defect class is
under-addressed, but don't claim XSS — that's a different bug class.
