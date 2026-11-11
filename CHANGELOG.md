# Changelog

## 1.1.0 — 2026-11-11

### Added

- `sdk.pdf.invoice(body)` (`POST /pdf/invoices`): PDF of an invoice issued by
  your ERP, with ORUGA's template and the issuer's brand. With VERI\*FACTU
  active for `issuer_nif`, the same call registers it and the PDF carries the
  QR; `result.verifactu` has `{ invoice_id, status, created }` (from the
  `X-Verifactu-*` headers). `preview: true` renders a draft without registering.
  Types `RenderPdfInvoiceInput`, `PdfInvoiceResult`… and `readVerifactuHeaders()`.
- CommonJS build (`dist/index.cjs` + `index.d.cts`): `require('@calltek/oruga-sdk')`
  works. Node 16.14+ is supported passing `config.fetch` (e.g. `undici`).
- `VerifactuInvoiceSource` includes `'pdf'` (invoices registered through `sdk.pdf`).

## 1.0.0 — 2026-10-22

**First release of `@calltek/oruga-sdk`**, the official TypeScript SDK for the
ORUGA API (`https://api.oru.ga/v1`). It **replaces `@calltek/invo-sdk`**: INVO's
VERI\*FACTU engine now lives in ORUGA and INVO is being retired. The GitHub repo
moved from `calltek/invo-sdk-ts` to `calltek/oruga-sdk-ts`.

There is **no INVO compatibility layer**: no `InvoSDK`, no `store()`, no
camelCase DTOs. Migrating means changing the package, the API key and the call
sites (see below).

### Added

- `OrugaSDK`: `new OrugaSDK({ apiKey, baseUrl?, timeout?, maxRetries?, retryBaseDelay?, maxRetryDelay?, onError?, debug?, fetch? })`.
- `sdk.verifactu.*`: the whole VERI\*FACTU API, 1:1 with the backend (snake_case payloads):
  - `invoices.create / bulk / list / search / get / records / qr / qrSvg / correct / annul`
  - `records.list / search / get / xml / resend`
  - `taxpayers.list / create / get / update / delete` and
    `taxpayers.representations.list / create / verify / revoke / document`
  - `errors.list / resolve`
  - `webhook.get / update / rotateSecret / deliveries`
- `sdk.request(path, method?, body?, options?)`: generic escape hatch with the
  same auth, timeout, retries and error mapping.
- Webhooks: `verifyWebhookSignature()`, `constructWebhookEvent()`,
  `signWebhookPayload()` and `WEBHOOK_HEADERS` (`X-Oruga-Timestamp`,
  `X-Oruga-Signature`, `X-Oruga-Event`, `X-Oruga-Delivery`).
- HTTP client: timeout (30 s), automatic `Idempotency-Key` on writes, retries
  with exponential backoff on 429 (honouring `Retry-After`), 5xx and network
  errors (only idempotent requests), custom `fetch`, `debug` logger that never
  prints the API key.
- Typed errors: `OrugaError` → `OrugaConfigError`, `OrugaValidationError`,
  `OrugaApiError` (`status`, `code`, `message`, `errors`, `requestId`,
  `retryAfter`) → `OrugaAuthError` / `OrugaRateLimitError`, and
  `OrugaNetworkError` → `OrugaTimeoutError`.
- Per-request options (`idempotencyKey`, `signal`, `timeout`, `maxRetries`, `headers`).

### Migrating from `@calltek/invo-sdk` 0.x

1. **Package**: `npm uninstall @calltek/invo-sdk && npm install @calltek/oruga-sdk`,
   and `import { OrugaSDK } from '@calltek/oruga-sdk'`.
2. **API key**: create an ORUGA API key (`ogk_…`) in a workspace with the
   `verifactu` app active and the scopes you need (at least
   `verifactu_invoice.*`; plus `verifactu_record.view`,
   `verifactu_taxpayer.view`, `verifactu_error.view`, `verifactu_webhook.*` if
   you use them). `new OrugaSDK({ apiKey: 'ogk_…' })`. INVO tokens
   (`invo_tok_…`) and the `apiToken` option are gone; a key that does not start
   with `ogk_` throws `OrugaConfigError`.
3. **Taxpayer**: register your issuer as a taxpayer in ORUGA (NIF, legal name
   exactly as in the AEAT census, environment `test` or `production`) with its
   verified representation model.
4. **Environment**: the `environment` option is gone. In ORUGA the AEAT
   environment belongs to each taxpayer; if the same NIF exists in both
   environments, send `environment` (`'test'` | `'production'`) or `taxpayer_id`
   in the invoice body. There is no sandbox URL.
5. **`store(dto, callback?)` → `sdk.verifactu.invoices.create({ … })`**, with
   the snake_case body below. The result is the full invoice
   (`invoice.id`, `invoice.chain_index`, `invoice.status`…) instead of
   `{ success, invoiceId, chainIndex }`.
6. **Webhooks**: the signature headers are now `X-Oruga-Timestamp` and
   `X-Oruga-Signature` (same HMAC scheme), and the body no longer has
   `invo_status`: read `data.status` (`accepted`, `accepted_with_warnings`,
   `rejected`, `failed`) and `data.aeat_error_code`. `invoice_id` is still your
   `external_id`.
7. **Removed**: `read()` (AI reader) and `pdf()` (branded PDFs) — render your
   own PDF and print the QR from `sdk.verifactu.invoices.qr(id)`;
   `getAccessToken()`, `getUser()`, `isAuthenticated()`, `apiUrl` (now
   `baseUrl`), the JWT helpers (`decodeJWT`, `isTokenExpired`…), the INVO types
   (`CreateInvoiceDto`, `UserDto`, `MakeupPDF*`…) and the old error names
   (`AuthError`, `NetworkError`, `InvalidCredentialsError`, `TokenExpiredError`,
   `InvalidTokenError`, `OAuthError`, `Invo*Error` → `Oruga*Error`).

#### Field mapping: `store(dto)` → `invoices.create(body)`

| invo-sdk 0.x (`CreateInvoiceDto`) | `CreateVerifactuInvoiceInput` |
| --- | --- |
| `emitterTaxId` | `issuer_nif` (or `taxpayer_id`) |
| `emitterName` | — (the AEAT name is the taxpayer's `legal_name`) |
| config `environment` | `environment` (`'test'` \| `'production'`; `sandbox` → `test`), only to disambiguate a NIF |
| `issueDate` | `issue_date` (`YYYY-MM-DD`, or an ISO instant with zone) |
| `invoiceNumber` | `invoice_number` |
| `externalId` | `external_id` |
| `totalAmount` (number) | `total` (decimal string, e.g. `'1210.00'`) |
| `currency` | — (amounts are in EUR) |
| `customerName` + `customerTaxId` | `recipients: [{ name, nif }]`, or `[{ name, id_type: '02', id }]` for an EU VAT number |
| `type` | `invoice_type` |
| `rectificationType` | `rectification_type` |
| `rectifiedInvoiceIds[]` | `rectified_invoices: [{ invoice_id }]` (ORUGA ids) or `[{ invoice_number, issue_date }]` |
| `substitutedInvoiceIds[]` | `substituted_invoices: [{ invoice_id }]` |
| — (INVO computed it) | `rectified_amounts: { base, tax, surcharge? }` (required for a rectification by substitution) |
| `description` | `description` |
| `simplifiedQualified` | `simplified_art_7273` |
| `unidentifiedRecipient` | `unidentified_recipient_art_61d` |
| `billingAgreementNumber` | `billing_agreement_number` |
| `callback` / 2nd argument of `store()` | `callback_url` |
| `taxLines[]` | `tax_lines[]` |
| `taxLines[].taxType` | `tax_type` (INVO's `04` "Others" is the AEAT code `05`) |
| `taxLines[].taxRate` | `tax_rate` (decimal string, e.g. `'21'`) |
| `taxLines[].baseAmount` | `base` |
| `taxLines[].taxAmount` | `tax_amount` |
| `taxLines[].surchargeRate` / `surchargeAmount` | `surcharge_rate` / `surcharge_amount` |
| `taxLines[].taxExemptionReason` (E1–E6) / `operationType` (S1, S2, N1, N2) | `operation` |
| `taxLines[].regimeKey` | `regime_key` |

Every create sends an `Idempotency-Key`; pass
``{ idempotencyKey: `order-${orderId}` }`` as the second argument to make
retries safe across processes.

---

## `@calltek/invo-sdk` (previous package)

### 0.2.0

- Regenerated INVO API types; removed `OAuthCallbackDto`.
