import { OrugaConfigError } from './errors'
import { HttpClient, type HttpMethod } from './http'
import type { OrugaDebugLogger, OrugaSDKConfig, RequestOptions } from './types/sdk.types'
import { PdfClient } from './pdf'
import { VerifactuClient } from './verifactu'
import { DEFAULT_BASE_URL } from './version'

const API_KEY_PREFIX = 'ogk_'

function resolveApiKey(config: OrugaSDKConfig): string {
    const key = typeof config.apiKey === 'string' ? config.apiKey.trim() : ''
    if (!key) {
        throw new OrugaConfigError(
            'An ORUGA API key is required: new OrugaSDK({ apiKey: "ogk_..." })',
        )
    }
    if (!key.startsWith(API_KEY_PREFIX)) {
        throw new OrugaConfigError('Invalid API key: ORUGA API keys start with "ogk_"')
    }
    return key
}

function resolveDebug(debug: OrugaSDKConfig['debug']): OrugaDebugLogger | undefined {
    if (!debug) return undefined
    if (typeof debug === 'function') return debug
    return (message, meta) => console.debug(message, meta ?? '')
}

/**
 * SDK for the ORUGA API.
 *
 * @example
 * ```typescript
 * const sdk = new OrugaSDK({ apiKey: process.env.ORUGA_API_KEY! })
 *
 * const invoice = await sdk.verifactu.invoices.create({ ... })
 * const qr = await sdk.verifactu.invoices.qr(invoice.id)
 * ```
 */
export class OrugaSDK {
    /** VERI*FACTU API: invoices, records, taxpayers, errors and webhook. */
    readonly verifactu: VerifactuClient

    /** PDF API: invoices from your ERP with ORUGA's template (and VERI*FACTU QR if active). */
    readonly pdf: PdfClient

    private readonly http: HttpClient

    constructor(config: OrugaSDKConfig) {
        if (!config || typeof config !== 'object') {
            throw new OrugaConfigError('OrugaSDK needs a config object: new OrugaSDK({ apiKey })')
        }

        this.http = new HttpClient({
            apiKey: resolveApiKey(config),
            baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
            timeout: config.timeout ?? 30_000,
            maxRetries: Math.max(0, config.maxRetries ?? 3),
            retryBaseDelay: config.retryBaseDelay ?? 500,
            maxRetryDelay: config.maxRetryDelay ?? 60_000,
            fetch: config.fetch,
            debug: resolveDebug(config.debug),
            onError: config.onError,
        })
        this.verifactu = new VerifactuClient(this.http)
        this.pdf = new PdfClient(this.http)
    }

    /** Base URL of the API (without trailing slash). */
    get baseUrl(): string {
        return this.http.baseUrl
    }

    /**
     * Generic request to any endpoint of the API, relative to `baseUrl`
     * (e.g. `/verifactu/taxpayers`). Escape hatch for endpoints the SDK does
     * not wrap yet; it gets the same auth, timeout, retries and error mapping.
     */
    async request<T>(
        endpoint: string,
        method: HttpMethod = 'GET',
        body?: unknown,
        options?: RequestOptions,
    ): Promise<T> {
        return this.http.request<T>({
            ...options,
            method,
            path: endpoint.startsWith('/') ? endpoint : `/${endpoint}`,
            body,
        })
    }
}
