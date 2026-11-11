/**
 * @calltek/oruga-sdk — TypeScript SDK for the ORUGA API.
 *
 * @example
 * ```typescript
 * import { OrugaSDK } from '@calltek/oruga-sdk'
 *
 * const sdk = new OrugaSDK({ apiKey: process.env.ORUGA_API_KEY! })
 * const invoice = await sdk.verifactu.invoices.create({ ... })
 * ```
 */

// Main SDK
export { OrugaSDK } from './sdk'
export { SDK_VERSION, DEFAULT_BASE_URL } from './version'

// VERI*FACTU resources (for typing `sdk.verifactu.*`)
export {
    VerifactuClient,
    VerifactuInvoices,
    VerifactuRecords,
    VerifactuTaxpayers,
    VerifactuRepresentations,
    VerifactuErrors,
    VerifactuWebhook,
} from './verifactu'

// PDF
export { PdfClient, PDF_VERIFACTU_HEADERS, readVerifactuHeaders } from './pdf'

// HTTP
export { parseRetryAfter } from './http'
export type { HttpMethod } from './http'

// Webhooks
export {
    verifyWebhookSignature,
    constructWebhookEvent,
    signWebhookPayload,
    WEBHOOK_HEADERS,
} from './webhook'
export type { VerifyWebhookSignatureParams } from './webhook'

// Types
export type * from './types'

// Errors
export {
    OrugaError,
    OrugaConfigError,
    OrugaValidationError,
    OrugaApiError,
    OrugaAuthError,
    OrugaRateLimitError,
    OrugaNetworkError,
    OrugaTimeoutError,
} from './errors'
export type { OrugaApiErrorInit } from './errors'
