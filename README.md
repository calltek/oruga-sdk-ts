# @calltek/oruga-sdk

Official TypeScript SDK for the **ORUGA API**. It covers VERI\*FACTU
(register invoices with the AEAT, follow their status, get the QR, manage
taxpayers and verify webhooks) and PDF invoices rendered by ORUGA for your ERP.

> Replaces `@calltek/invo-sdk`. There is no INVO compatibility layer: see the
> [migration notes](./CHANGELOG.md#migrating-from-calltekinvo-sdk-0x).

- Zero runtime dependencies, ESM and CommonJS. Node ≥ 18 (native `fetch`);
  Node 16 works passing `fetch` (see [Node 16](#node-16)).
- Typed 1:1 with the API (`sdk.verifactu.*`, `sdk.pdf.*`, snake_case payloads).
- Automatic `Idempotency-Key`, timeouts, retries with backoff on 429/5xx.
- Webhook signature verification.

## Installation

```bash
npm install @calltek/oruga-sdk
```

## Quick start

```typescript
import { OrugaSDK } from '@calltek/oruga-sdk'

const sdk = new OrugaSDK({
    apiKey: process.env.ORUGA_API_KEY!, // ogk_…
    // baseUrl: 'https://api.oru.ga/v1', // default
})

const invoice = await sdk.verifactu.invoices.create({
    issuer_nif: 'B12345678', // a taxpayer of your workspace (or taxpayer_id)
    invoice_number: 'FAC-2026-001',
    issue_date: '2026-10-21',
    description: 'Servicios de consultoría',
    recipients: [{ name: 'Cliente SL', nif: 'B87654321' }],
    tax_lines: [{ tax_rate: '21', base: '1000.00', tax_amount: '210.00' }],
    total: '1210.00',
    external_id: 'order-12345',
    callback_url: 'https://myapp.com/webhooks/verifactu',
})

console.log(invoice.id, invoice.status) // 42 'queued'

// Later: status, CSV and QR
const detail = await sdk.verifactu.invoices.get(invoice.id)
const { qr_payload, svg } = await sdk.verifactu.invoices.qr(invoice.id)
```

The record is chained and queued immediately; ORUGA submits it to the AEAT in
batches and the status moves to `accepted`, `accepted_with_warnings`,
`rejected` or `failed`. Use a webhook (below) instead of polling.

### Prerequisites in ORUGA

- An ORUGA workspace with the **`verifactu`** app active.
- An **API key** (`ogk_…`) of that workspace with the scopes you need, e.g.
  `verifactu_invoice.*`, `verifactu_record.view`, `verifactu_taxpayer.view`,
  `verifactu_error.view`, `verifactu_webhook.*`. The key implies the workspace:
  no workspace header is needed.
- The issuer registered as a **taxpayer** (`nif`, `legal_name` exactly as in
  the AEAT census, `environment` `test` = AEAT pre-production or
  `production`) with a verified representation model.

## API reference (`sdk.verifactu`)

All methods take an optional last argument `RequestOptions`:
`{ idempotencyKey?, signal?, timeout?, maxRetries?, headers? }`.
Lists answer `{ data, total_items }` and accept `page`, `limit` (≤ 100), `sort`, `order`.

### Invoices

| Method | Endpoint |
| --- | --- |
| `invoices.create(body)` | `POST /verifactu/invoices` (Idempotency-Key automatic) |
| `invoices.bulk(invoices)` | `POST /verifactu/invoices/bulk` — up to 50; 200 with per-invoice `results` |
| `invoices.list(query)` | `GET /verifactu/invoices` (`taxpayer_id`, `status`, `record_type`, `invoice_number`, `external_id`, `invoice_type`, `source`, `date_from`, `date_to`) |
| `invoices.search(body)` | `POST /verifactu/invoices/search` (filter DSL, e.g. `{ filter: { 'current_record.status': 'rejected' } }`) |
| `invoices.get(id)` | `GET /verifactu/invoices/:id` — with its record history |
| `invoices.records(id)` | `GET /verifactu/invoices/:id/records` |
| `invoices.qr(id)` / `qrSvg(id)` | `GET /verifactu/invoices/:id/qr` (JSON / `?format=svg`) |
| `invoices.correct(id, body)` | `POST /verifactu/invoices/:id/correct` — subsanación |
| `invoices.annul(id)` | `POST /verifactu/invoices/:id/annul` |

### Records, taxpayers, errors, webhook

| Method | Endpoint |
| --- | --- |
| `records.list(query)` / `records.search(body)` | `GET /verifactu/records`, `POST /verifactu/records/search` |
| `records.get(id)` | `GET /verifactu/records/:id` |
| `records.xml(id)` | `GET /verifactu/records/:id/xml` — XML sent/received per attempt |
| `records.resend(id)` | `POST /verifactu/records/:id/resend` — only `failed` records |
| `taxpayers.list / create / get / update / delete` | `/verifactu/taxpayers[/:id]` |
| `taxpayers.representations.list / create / verify / revoke / document` | `/verifactu/taxpayers/:id/representations…` (`create` is multipart: pass `file: Blob`) |
| `errors.list(query)` / `errors.resolve(id)` | `GET /verifactu/errors`, `PATCH /verifactu/errors/:id/resolve` |
| `webhook.get()` / `update(body)` / `rotateSecret()` / `deliveries(query)` | `/verifactu/webhook…` |

Amounts are decimal strings in responses (`"121.00"`); on input both strings
and numbers are accepted (prefer strings).

For an endpoint the SDK does not wrap yet, `sdk.request(path, method?, body?, options?)`
calls it with the same auth, timeout, retries and error mapping
(`path` is relative to `baseUrl`, e.g. `/verifactu/taxpayers`).

## PDF invoices (`sdk.pdf`)

`sdk.pdf.invoice(body)` (`POST /pdf/invoices`) renders an invoice issued by
your ERP with ORUGA's template and the brand (logo, colour, fiscal data) of
the issuer `issuer_nif` of your workspace. ORUGA stores nothing but, if the
**`verifactu`** app is active and `issuer_nif` is one of its taxpayers, the
same call registers the invoice (alta) and the PDF carries the QR.

```typescript
import { writeFile } from 'node:fs/promises'

const { data, filename, verifactu } = await sdk.pdf.invoice({
    issuer_nif: 'B12345678',
    invoice_number: 'F-2026/0412',
    issue_date: '2026-11-07',
    external_id: '1532', // your id: comes back in the VERI*FACTU webhooks
    recipient: { name: 'Cliente SL', nif: 'B87654321', address: 'C/ Mayor 1', cp: '39001', city: 'Santander' },
    line_columns: [{ key: 'lot', label: 'Lote' }],
    lines: [
        { description: 'Albarán A-12 - 03/11/2026', is_title: true },
        { description: 'Queso curado 1 kg', quantity: '2', unit_price: '50.00', amount: '100.00', extra: { lot: 'L-2611' } },
    ],
    tax_lines: [{ tax_rate: '4', base: '100.00', tax_amount: '4.00' }],
    total: '104.00',
    payment_method: 'Transferencia ES12 …',
})

await writeFile(filename ?? 'factura.pdf', Buffer.from(data))
if (verifactu) save(verifactu.invoice_id, verifactu.status) // created: true on the first call
```

- The amounts must add up: Σ `lines[].amount` − `discount_amount` = Σ `tax_lines[].base`
  and `total` = Σ (base + tax + surcharge). Otherwise 400 `PDF_INVOICE_INVALID`
  with the list in `error.errors`.
- `recipient` is required except in a simplified invoice (`invoice_type: 'F2'`);
  corrective invoices (R1–R5) need `rectified_invoices`.
- `preview: true`: draft with a «BORRADOR» watermark, no QR, nothing registered.
  Use it before issuing.
- Calling again with the same fiscal data reprints the same invoice and QR
  (`verifactu.created === false`), so the call is retried like an idempotent
  one. Different fiscal data ⇒ 409 `VERI\*FACTU_INVOICE_MISMATCH`
  (`error.details.differences`); an annulled invoice ⇒ 409 `VERI\*FACTU_INVOICE_ANNULLED`.
  Once registered, fix an invoice with a corrective one, not by editing it.
- `issuer_contact` replaces the issuer's address, email and phone (a shop);
  `issuer_legal_lines` adds legal texts under it (e.g. a sanitary register).
- Needs the **`pdf`** app in the workspace and the `pdf_invoice.render` scope
  on the API key.

## Webhooks

Configure a workspace webhook once (or send `callback_url` per invoice):

```typescript
const { secret } = await sdk.verifactu.webhook.update({ url: 'https://myapp.com/webhooks/verifactu' })
// `secret` (whsec_…) is shown only now (and on rotateSecret()): store it
```

Each verdict (`accepted`, `accepted_with_warnings`, `rejected`, `failed`) is
POSTed with these headers (also exported as `WEBHOOK_HEADERS`, lower-case):

```
X-Oruga-Timestamp: <unix seconds>
X-Oruga-Signature: sha256=<hex HMAC-SHA256(secret, "<timestamp>.<raw body>")>
X-Oruga-Event: verifactu_record.status_changed
X-Oruga-Delivery: <delivery id>
```

and this body (`VerifactuWebhookEvent`):

```json
{
    "event": "verifactu_record.status_changed",
    "occurred_at": "2026-10-21T10:00:00.000Z",
    "invoice_id": "order-12345",
    "data": {
        "verifactu_invoice_id": 42,
        "external_id": "order-12345",
        "taxpayer_id": 1,
        "invoice_number": "FAC-2026-001",
        "issue_date": "2026-10-21",
        "record_id": 7,
        "record_type": "alta",
        "chain_index": 9,
        "status": "accepted",
        "aeat_status": "correcto",
        "aeat_csv": "A-XXXXXXXXXXXXXX",
        "aeat_error_code": null,
        "aeat_error_description": null
    },
    "delivery_id": 3
}
```

Verify it against the **raw** body:

```typescript
import express from 'express'
import { constructWebhookEvent, OrugaValidationError, WEBHOOK_HEADERS } from '@calltek/oruga-sdk'

app.post('/webhooks/verifactu', express.raw({ type: 'application/json' }), (req, res) => {
    try {
        const event = constructWebhookEvent({
            secret: process.env.VERIFACTU_WEBHOOK_SECRET!,
            timestamp: req.header(WEBHOOK_HEADERS.TIMESTAMP),
            signature: req.header(WEBHOOK_HEADERS.SIGNATURE),
            body: req.body, // Buffer with the raw body
            // toleranceSeconds: 300 (default)
        })
        // event.invoice_id = your external_id
        // event.data.status, event.data.aeat_csv, event.data.aeat_error_code…
        res.sendStatus(200)
    } catch (error) {
        if (error instanceof OrugaValidationError) return res.sendStatus(401)
        throw error
    }
})
```

`verifyWebhookSignature(params)` only checks the signature (returns a boolean,
never throws); `signWebhookPayload(secret, timestamp, body)` computes the header
value (handy in your tests). Deliveries are retried with backoff for hours:
deduplicate by `delivery_id`.

## Configuration

```typescript
new OrugaSDK({
    apiKey: 'ogk_…', // required
    baseUrl: 'https://api.oru.ga/v1', // default
    timeout: 30_000, // ms per attempt
    maxRetries: 3, // 429 / 5xx / network, idempotent requests only
    retryBaseDelay: 500, // ms, exponential backoff with jitter
    maxRetryDelay: 60_000, // longest Retry-After honoured
    onError: (error) => {}, // every error thrown
    debug: true, // or (message, meta) => logger.debug(message, meta); never logs the API key
    fetch: customFetch, // optional
})
```

### Node 16

Node 16 has no global `fetch`: pass one (e.g. `undici` 5) and use `require`
or `import` as usual.

```javascript
const { OrugaSDK } = require('@calltek/oruga-sdk')
const { fetch } = require('undici')

const sdk = new OrugaSDK({ apiKey: process.env.ORUGA_API_KEY, fetch })
```

### Retries and idempotency

- `invoices.create`, `bulk`, `correct` and `annul` always send an
  `Idempotency-Key` (a random UUID unless you pass `idempotencyKey`). Retries reuse
  it, so a retried write never duplicates an invoice. Same key + same body within
  24 h returns the stored response; same key + different body is a 422
  `IDEMPOTENCY_KEY_REUSED`. Pass a key derived from your own id
  (``{ idempotencyKey: `order-${orderId}` }``) to make retries safe across processes.
- Retries happen on 429 (honouring `Retry-After`), 5xx and network errors/timeouts,
  only for GET/PUT/DELETE, searches and writes with an Idempotency-Key.
- Rate limit: 300 requests/min per API key by default (`X-RateLimit-*` headers).

## Errors

```typescript
import { OrugaApiError, OrugaNetworkError } from '@calltek/oruga-sdk'

try {
    await sdk.verifactu.invoices.create(body)
} catch (error) {
    if (error instanceof OrugaApiError) {
        error.status // 400
        error.code // 'VERIFACTU_INVOICE_INVALID'
        error.message // details from the API
        error.errors // validation errors, when sent
        error.requestId // X-Correlation-Id, for support
        error.retryAfter // seconds (429)
    } else if (error instanceof OrugaNetworkError) {
        // no response (or OrugaTimeoutError): safe to retry with the same idempotencyKey
    }
}
```

| Class | When |
| --- | --- |
| `OrugaError` | Base class of everything the SDK throws |
| `OrugaApiError` | The API answered with an error (`{ status, code, message }`) |
| `OrugaAuthError` | 401 (invalid/revoked key) or 403 (missing scope) |
| `OrugaRateLimitError` | 429 `RATE_LIMITED` / `VERIFACTU_BULK_IN_PROGRESS` |
| `OrugaNetworkError` / `OrugaTimeoutError` | No response / timeout |
| `OrugaConfigError` | Bad configuration (missing key, key not starting with `ogk_`) |
| `OrugaValidationError` | Invalid or expired webhook signature (`constructWebhookEvent`) |

## Development

```bash
npm install
npm run build      # rollup → dist/index.js + dist/index.d.ts
npm test           # vitest (mocked fetch)
npm run typecheck
```

Publishing is done by CI on a `v*` tag (see [docs/PUBLISHING.md](./docs/PUBLISHING.md)).

## License

MIT
