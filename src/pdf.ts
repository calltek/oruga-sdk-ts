/**
 * `sdk.pdf.*` — the ORUGA PDF API (`/v1/pdf/*`): invoices from your ERP
 * rendered with ORUGA's template and the issuer's brand. If the issuer NIF is
 * a VERI*FACTU taxpayer of the workspace, the same call registers the invoice
 * and the PDF carries its QR.
 */

import type { HttpClient } from './http'
import type { PdfInvoiceResult, PdfVerifactuRegistration, RenderPdfInvoiceInput } from './types/pdf.types'
import type { RequestOptions } from './types/sdk.types'
import type { VerifactuRecordStatus } from './types/verifactu.types'

/** Response headers with what VERI*FACTU did. */
export const PDF_VERIFACTU_HEADERS = {
    INVOICE_ID: 'x-verifactu-invoice-id',
    STATUS: 'x-verifactu-status',
    CREATED: 'x-verifactu-created',
} as const

/** Reads the `X-Verifactu-*` headers; `null` if VERI*FACTU did not take part. */
export function readVerifactuHeaders(headers: Headers): PdfVerifactuRegistration | null {
    const id = Number(headers.get(PDF_VERIFACTU_HEADERS.INVOICE_ID))
    if (!Number.isInteger(id) || id <= 0) return null
    return {
        invoice_id: id,
        status: (headers.get(PDF_VERIFACTU_HEADERS.STATUS) ?? 'pending') as VerifactuRecordStatus,
        created: headers.get(PDF_VERIFACTU_HEADERS.CREATED) === 'true',
    }
}

export class PdfClient {
    constructor(private readonly http: HttpClient) {}

    /**
     * Render an invoice issued by your ERP (`POST /pdf/invoices`).
     *
     * - With VERI*FACTU active for `issuer_nif`, the first call registers it
     *   (alta) and later calls with the same fiscal data reprint it with the
     *   same QR. Different fiscal data ⇒ 409 `VERIFACTU_INVOICE_MISMATCH`.
     * - `preview: true` renders a draft («BORRADOR») and registers nothing.
     *
     * Safe to retry: a repeated call is a reprint, so network errors, 429 and
     * 5xx are retried like idempotent requests.
     */
    async invoice(body: RenderPdfInvoiceInput, options?: RequestOptions): Promise<PdfInvoiceResult> {
        const response = await this.http.requestWithResponse<ArrayBuffer>({
            ...options,
            method: 'POST',
            path: '/pdf/invoices',
            body,
            responseType: 'arrayBuffer',
            retryable: true,
            headers: { Accept: 'application/pdf, application/json', ...options?.headers },
        })
        const disposition = response.headers.get('content-disposition') ?? ''
        const match = /filename="([^"]*)"/.exec(disposition)
        return {
            data: response.data,
            contentType: response.headers.get('content-type'),
            filename: match ? match[1] : null,
            verifactu: readVerifactuHeaders(response.headers),
        }
    }
}
