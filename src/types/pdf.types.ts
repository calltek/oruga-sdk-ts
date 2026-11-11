/**
 * Types of the ORUGA PDF API (`/v1/pdf/*`), snake_case like the backend
 * (`og-backend/src/modules/pdf/dto/pdf-invoice.dto.ts`).
 */

import type {
    CalendarDate,
    DecimalInput,
    VerifactuEnvironment,
    VerifactuRecordStatus,
    VerifactuTaxLineInput,
} from './verifactu.types'

/** F1 full, F2 simplified, R1–R5 corrective. */
export type PdfInvoiceType = 'F1' | 'F2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'

/** Replaces the issuer's address, email and phone (e.g. a shop's). */
export interface PdfIssuerContact {
    address?: string
    /** «CP City» */
    city?: string
    email?: string
    phone?: string
}

export interface PdfRecipient {
    name: string
    /** Spanish NIF, or `id` + `id_type`. */
    nif?: string
    /** Without a Spanish NIF: 02 VAT id, 03 passport, 04 official id, 05 residence, 06 other, 07 not registered. */
    id_type?: '02' | '03' | '04' | '05' | '06' | '07'
    id?: string
    /** ISO 3166-1 alpha-2. */
    country_code?: string
    address?: string
    cp?: string
    city?: string
    state?: string
    country?: string
    email?: string
    phone?: string
}

export interface PdfRectifiedInvoice {
    invoice_number: string
    issue_date: CalendarDate
}

/** Extra column of the lines table, after the concept. */
export interface PdfLineColumn {
    /** snake_case key in `lines[].extra`. */
    key: string
    label: string
}

export interface PdfInvoiceLine {
    description: string
    /** Longer description, under the concept. */
    notes?: string
    /** Section title row (e.g. «Albarán: A-12 - 03/11/2026»), without amounts. */
    is_title?: boolean
    /** Required unless `is_title`. */
    quantity?: DecimalInput
    /** Required unless `is_title`. */
    unit_price?: DecimalInput
    /** Line discount (%). */
    discount_percent?: DecimalInput
    /** Line amount before taxes, with its discount applied. Required unless `is_title`. */
    amount?: DecimalInput
    /** Value of each `line_columns` column, by key. */
    extra?: Record<string, string>
}

/** Tax breakdown line, as in `POST /verifactu/invoices`. */
export type PdfTaxLine = Omit<VerifactuTaxLineInput, 'base_at_cost'>

/** Body of `POST /pdf/invoices`. */
export interface RenderPdfInvoiceInput {
    /** NIF of an issuer of the workspace: its fiscal data, logo and colour go on the PDF. */
    issuer_nif: string
    issuer_contact?: PdfIssuerContact
    /** Legal texts under the issuer (e.g. sanitary register). Up to 5. */
    issuer_legal_lines?: string[]
    /** Draft: «BORRADOR» watermark, no QR, nothing registered in VERI*FACTU. */
    preview?: boolean
    /** Invoice id in your ERP: comes back in the VERI*FACTU webhooks. */
    external_id?: string
    /** Only if the NIF is a VERI*FACTU taxpayer in both environments of the workspace. */
    environment?: VerifactuEnvironment
    invoice_number: string
    issue_date: CalendarDate
    /** @default 'F1' */
    invoice_type?: PdfInvoiceType
    /** @default 'I' */
    rectification_type?: 'S' | 'I'
    /** Required for R1–R5. */
    rectified_invoices?: PdfRectifiedInvoice[]
    /** Required unless F2. */
    recipient?: PdfRecipient
    /** Up to 4. */
    line_columns?: PdfLineColumn[]
    /** Up to 500. Σ amounts − `discount_amount` must equal Σ `tax_lines[].base`. */
    lines: PdfInvoiceLine[]
    /** Discount on the sum of the lines, before taxes. */
    discount_amount?: DecimalInput
    /** Up to 12. */
    tax_lines: PdfTaxLine[]
    /** Σ (base + tax_amount + surcharge_amount). */
    total: DecimalInput
    /** Plain text; line breaks are kept. */
    notes?: string
    payment_method?: string
}

/** What VERI*FACTU did with the invoice (from the `X-Verifactu-*` headers). */
export interface PdfVerifactuRegistration {
    /** Id of the VERI*FACTU invoice in ORUGA (`sdk.verifactu.invoices.get(id)`). */
    invoice_id: number
    /** Status of its current record. */
    status: VerifactuRecordStatus
    /** `true`: registered now; `false`: reprint of an invoice already registered. */
    created: boolean
}

export interface PdfInvoiceResult {
    /** The PDF bytes. */
    data: ArrayBuffer
    contentType: string | null
    filename: string | null
    /** `null` if VERI*FACTU is not active for the NIF, or with `preview`. */
    verifactu: PdfVerifactuRegistration | null
}
