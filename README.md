# Smart Budget

React/Vite personal budget app with account login, cloud persistence, and a secure write-only endpoint prepared for iPhone Shortcuts transaction imports.

## Local development

```bash
npm install
npm run dev
```

## Account + cloud setup on Vercel

Create an Upstash Redis database (the free tier is sufficient for normal personal use), then add the following Environment Variables to the Vercel project:

- `BUDGET_USERNAME`
- `BUDGET_PASSWORD_HASH`
- `SESSION_SECRET`
- `SMS_DEVICE_TOKEN`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
  - `KV_REST_API_URL` / `KV_REST_API_TOKEN` are also accepted.

Never commit real secrets to GitHub.

### Generate the password hash

Run locally and replace `YOUR_PASSWORD` only on your own machine:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
```

Store only the resulting hash in `BUDGET_PASSWORD_HASH`.

### Generate random secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this twice: once for `SESSION_SECRET` and once for `SMS_DEVICE_TOKEN`.

## Existing-data migration

After the first successful login, if the cloud account is empty but old browser budget data exists, the app asks whether to import it. The cloud copy then becomes the account master while localStorage acts as a synchronized browser cache for the existing UI.

## iPhone Shortcut transaction endpoint

`POST /api/transactions`

Required header:

```text
X-Device-Token: <SMS_DEVICE_TOKEN>
```

Example JSON body:

```json
{
  "type": "card_purchase",
  "amount": 126.5,
  "currency": "AED",
  "merchant": "AMAZON",
  "cardLast4": "1234",
  "availableLimit": 8850,
  "occurredAt": "2026-08-29T13:00:00+04:00"
}
```

The endpoint is intentionally write-only. The device token cannot read budget information. The intended Shortcut should parse the bank message locally and send only structured fields, not the full SMS text, OTPs, or authentication messages.
