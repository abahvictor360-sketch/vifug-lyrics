# The subscription switch (owner's note)

Vifug can be told, from the server and without shipping a new app, to start asking for payment.
It ships **off**. Nothing changes for anyone until you turn it on.

## One-time setup

Set `ENTITLEMENT_ADMIN_TOKEN` on the hosted app (Vercel project settings, at least 16 random characters) and redeploy once.
Without it, nobody can change the policy, including you.

## What each copy of Vifug does

On start the operator screen asks `https://app.vifug.com/api/entitlement`. The answer is one of:

| `mode` | What people see |
| --- | --- |
| `off` | Nothing. |
| `nag` | A pop-up asking them to subscribe. "Maybe later" hides it for `nagEveryHours` (default 24). |
| `lock` | A full-screen lock at the **next start** until a licence key is entered. |

Separately, `minVersion` (for example `"1.30.0"`) locks any installed app older than that behind an "update Vifug" screen.
That is how a paywall that only exists in a newer build is made to reach everyone.

Safety rules built in:

- No connection and no recent answer means **no lock** (it fails open). A fetched policy is trusted offline for 14 days.
- A running app is never locked mid-service: a change that arrives while it is open shows a yellow notice, and applies at the next start.
- The projector, stream and stage windows are never gated.
- A licence entered once is remembered; it is re-checked about weekly and is withdrawn only if the server says it is invalid, never because the computer is offline.

## Turning it on

```sh
TOKEN=...   # the same value as ENTITLEMENT_ADMIN_TOKEN
URL=https://app.vifug.com/api/entitlement

# Ask politely, with your payment link:
curl -X PUT $URL -H "x-admin-token: $TOKEN" -H "content-type: application/json" -d '{
  "mode": "nag",
  "title": "Support Vifug",
  "message": "Vifug is becoming a paid app. Subscribe to keep going.",
  "checkoutUrl": "https://your-payment-page.example/vifug"
}'

# Lock until a licence is entered, starting on a date:
curl -X PUT $URL -H "x-admin-token: $TOKEN" -H "content-type: application/json" \
  -d '{"mode":"lock","startsAt":"2027-02-01"}'

# Give out licence keys (stored only as hashes; they cannot be read back):
curl -X PUT $URL -H "x-admin-token: $TOKEN" -H "content-type: application/json" \
  -d '{"addKeys":["VIFUG-AB12-CD34"]}'
# remove one with {"removeKeys":[...]}

# Require everyone to update:
curl -X PUT $URL -H "x-admin-token: $TOKEN" -H "content-type: application/json" \
  -d '{"minVersion":"1.30.0"}'

# Turn it all off again:
curl -X PUT $URL -H "x-admin-token: $TOKEN" -H "content-type: application/json" -d '{"mode":"off","minVersion":""}'
```

## When you choose a payment provider

Two places change, both small:

1. `checkoutUrl` points at the provider's checkout page.
2. `verifyLicence()` in `packages/web/src/api/lib/entitlement.ts` checks a key (or a signed token) with the provider
   instead of the list of key hashes. Nothing else needs to change.

## Before you switch it on

The landing page says Vifug has no subscription. Change that wording first, or people will feel misled.
