# Playbook — Laravel Filament 3 / Livewire 3 IDOR

The canonical pattern that produced the Eventcube cross-tenant order leak.
If the target uses Filament for its admin panel, run this first — it has
historically yielded P1s.

## Fingerprint signals

You're on Filament/Livewire if you see ANY of these:
- `wire:id="..."` attributes on `<div>` elements (Livewire components).
- `wire:snapshot="..."` attributes (URL-encoded JSON state envelope).
- POST to `/livewire/update` in network log.
- Class names `fi-` prefixed (`fi-header`, `fi-card`, `fi-form`, `fi-table`).
- Cookie names: Laravel-style (`XSRF-TOKEN`, app-specific session cookie that
  decodes to JSON `{iv, value, mac}`).
- `csrf-token` meta tag in `<head>`.
- Filament tries to load `wire:initial-data` or `wire:effects` attributes.

## Architecture in one paragraph

Filament 3 admin Resources (e.g., `OrderResource`) declare `getModel()` and
ship a `Pages\EditRecord` page. The page's `resolveRecord($key)` calls
`static::getResource()::getEloquentQuery()->find($key)` where `$key` comes
from the route parameter `{record}`. If `getEloquentQuery()` is the default
(`Model::query()`), there's no store/tenant scope — any authenticated user
who can reach the page route can fetch any record by ID.

The standard Filament cookbook scopes via:
```php
public static function getEloquentQuery(): Builder
{
    return parent::getEloquentQuery()
        ->where('store_id', Filament::getTenant()->id);
}
```
Targets that *did* lock down the top-level browse route (`/orders` lists only
your own orders) but *did not* override `getEloquentQuery()` are the
vulnerable population — because direct navigation to `/orders/{foreign_id}/edit`
bypasses the list scope and hits `resolveRecord()` with the unscoped query.

## Test recipe

1. Find one Resource page URL pattern: `/{resource}/{id}/edit`,
   `/{resource}/{id}/view`, `/{resource}/{id}/<custom-page>` are the usual
   shapes.
2. Top-level baseline: `GET /{resource}/{foreign_id}` — usually returns
   403/404 (good — the list scope catches it).
3. Sub-route probe: `GET /{resource}/{foreign_id}/edit`,
   `GET /{resource}/{foreign_id}/<custom-page>` — these are where the bug
   lives.
4. **Wire:snapshot decode** — open the response, grep
   `wire:snapshot="..."`, URL-decode and JSON-parse. Look for:
   ```
   "data": {
     "store": [null, {"class": "Store", "key": <own_store_id>}],
     "<model>": [null, {"class": "<Model>", "key": <foreign_id>}],
     "data": [{ ... actual record fields ... }]
   }
   ```
   The smoking gun: `store.key` is YOUR session's store, but `<model>.key`
   is the foreign ID. That's the Resource loading the foreign record under
   your store's chrome.
5. Repeat for every Resource you can identify from JS bundles and HTML
   (`grep -oE '/[a-z\-]+/\d+/edit' all-urls.txt`).

## Common Filament Resources to probe (one or more usually leak)

- `orders`, `invoices`, `payments`, `refunds`, `payouts`
- `customers`, `attendees`, `tickets`, `reservations`, `bookings`
- `users`, `teams`, `members`, `invitations`
- `events`, `products`, `discounts`, `coupons`
- `webhooks`, `api-keys`, `integrations`
- `notifications`, `email-templates`, `email-reminders`, `email-campaigns`
- `reports`, `exports`, `imports`

## The Filament-specific sub-pages that often leak independently

Filament Resources commonly add custom pages beyond Edit/View:
- `EmailReminderPage`, `BalanceAndPayoutsPage`, `EmailsAndRemindersPage`
- `ScannerPage`, `AttendeesPage`, `RefundPage`, `ExportPage`
- Custom action modals (`mountAction` URLs)

Each custom page is its own Livewire component — and each one independently
re-resolves the parent record. **If the parent `getEloquentQuery()` is
unscoped, every custom page leaks. If it's scoped, custom pages still leak
if the developer wrote a separate `mount($record)` that calls
`Model::find($record)`.** Test every custom page; finding one safe doesn't
mean the others are.

## Livewire update POST (write-side IDOR)

`POST /livewire/update` carries the wire:snapshot as part of the request
body, including the checksum. The checksum protects against snapshot-data
tampering but does NOT protect against using a *foreign* snapshot from a
read-IDOR — the server only validates the checksum integrity, not that the
authenticated user owns the record described.

To probe writes after a confirmed read:
1. Capture the wire:snapshot for the foreign record (you already have it
   from the read).
2. Capture the `/livewire/update` POST body shape from your *own* edit
   (e.g., trigger an edit on your own resource, capture the POST).
3. Replay the POST with the foreign snapshot substituted.

If the server processes the update, you have cross-tenant *write*. That is
always a P1.

## Quick win: Filament Notifications component

Every Filament page renders a `notifications` Livewire component with its
own snapshot. The path field inside the snapshot's `memo` confirms the
current route:
```
"memo": {"name": "notifications", "path": "events/93919/emails-and-reminders"}
```
A path that resolves to a foreign tenant's record on a 200 OK is your bug
signal even before you decode the deeper component.
