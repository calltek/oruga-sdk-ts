import { describe, expect, it } from 'vitest'
import { OrugaApiError, readVerifactuHeaders } from '../src'
import type { RenderPdfInvoiceInput } from '../src'
import { json, makeSdk, mockFetch } from './helpers'

const body: RenderPdfInvoiceInput = {
    issuer_nif: 'B39876958',
    invoice_number: 'F-2026/0412',
    issue_date: '2026-11-07',
    recipient: { name: 'CLIENTE SL', nif: 'B12345674' },
    lines: [
        { description: 'Albarán A-12', is_title: true },
        { description: 'Queso curado 1 kg', quantity: '2', unit_price: '50.00', amount: '100.00' },
    ],
    tax_lines: [{ base: '100.00', tax_rate: '4', tax_amount: '4.00' }],
    total: '104.00',
}

const PDF_BYTES = new TextEncoder().encode('%PDF-1.7 fake')

function pdf(headers: Record<string, string> = {}, status = 200): Response {
    return new Response(PDF_BYTES, {
        status,
        headers: {
            'content-type': 'application/pdf',
            'content-disposition': 'inline; filename="factura-F-2026_0412.pdf"',
            ...headers,
        },
    })
}

describe('sdk.pdf.invoice', () => {
    it('posts the body and returns the PDF with the VERI*FACTU registration', async () => {
        const { fetch, calls } = mockFetch(() =>
            pdf({
                'X-Verifactu-Invoice-Id': '42',
                'X-Verifactu-Status': 'queued',
                'X-Verifactu-Created': 'true',
            }),
        )
        const result = await makeSdk(fetch).pdf.invoice(body)

        expect(calls).toHaveLength(1)
        expect(calls[0].method).toBe('POST')
        expect(calls[0].url).toBe('https://api.test/v1/pdf/invoices')
        expect(calls[0].body).toEqual(body)
        expect(calls[0].headers.accept).toContain('application/pdf')
        expect(calls[0].headers['idempotency-key']).toBeUndefined()

        expect(new Uint8Array(result.data)).toEqual(PDF_BYTES)
        expect(result.contentType).toBe('application/pdf')
        expect(result.filename).toBe('factura-F-2026_0412.pdf')
        expect(result.verifactu).toEqual({ invoice_id: 42, status: 'queued', created: true })
    })

    it('returns verifactu null without the headers (no VERI*FACTU, or preview)', async () => {
        const { fetch } = mockFetch(() => pdf())
        const result = await makeSdk(fetch).pdf.invoice({ ...body, preview: true })
        expect(result.verifactu).toBeNull()
    })

    it('reads a reprint (created false)', () => {
        const headers = new Headers({
            'X-Verifactu-Invoice-Id': '7',
            'X-Verifactu-Status': 'accepted',
            'X-Verifactu-Created': 'false',
        })
        expect(readVerifactuHeaders(headers)).toEqual({
            invoice_id: 7,
            status: 'accepted',
            created: false,
        })
    })

    it('retries a 503 (a repeated call is a reprint)', async () => {
        const { fetch, calls } = mockFetch(
            () => json({ status: 503, code: 'HTTP_503', message: 'Unavailable' }, 503),
            () => pdf(),
        )
        const result = await makeSdk(fetch).pdf.invoice(body)
        expect(calls).toHaveLength(2)
        expect(result.contentType).toBe('application/pdf')
    })

    it('maps a mismatch to OrugaApiError with its details', async () => {
        const { fetch } = mockFetch(() =>
            json(
                {
                    status: 409,
                    code: 'VERIFACTU_INVOICE_MISMATCH',
                    message: 'La factura ya está registrada con otros datos fiscales',
                    details: { invoice_id: 42, differences: ['total'] },
                },
                409,
            ),
        )
        const error = await makeSdk(fetch)
            .pdf.invoice(body)
            .catch((e: unknown) => e)
        expect(error).toBeInstanceOf(OrugaApiError)
        expect(error).toMatchObject({
            status: 409,
            code: 'VERIFACTU_INVOICE_MISMATCH',
            details: { invoice_id: 42, differences: ['total'] },
        })
    })
})
