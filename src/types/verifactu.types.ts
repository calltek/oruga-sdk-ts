/**
 * Types of the ORUGA VERI*FACTU API (`/v1/verifactu/*`).
 *
 * Hand-written from the backend DTOs and presenters (og-backend,
 * `src/modules/verifactu/{taxpayer,invoice,record,error,webhook}`), field by
 * field and in the same snake_case. Dates travel as ISO strings, calendar dates
 * as `YYYY-MM-DD` and amounts as decimal strings (`"121.00"`).
 */

// ============================================================================
// Shared
// ============================================================================

/**
 * A decimal amount or percentage. The API always answers with strings
 * (`"121.00"`); on input it also accepts JSON numbers, which are converted to
 * text without floating point arithmetic (`121.1` → `"121.1"`). Prefer strings.
 */
export type DecimalInput = string | number

/** `YYYY-MM-DD` */
export type CalendarDate = string

/** ISO 8601 instant, e.g. `2026-10-21T10:30:00.000Z` */
export type IsoDateTime = string

/** AEAT environment of a taxpayer: `test` = AEAT pre-production (no fiscal effect). */
export type VerifactuEnvironment = 'test' | 'production'

export type VerifactuInvoiceType = 'F1' | 'F2' | 'F3' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'

export type VerifactuRectificationType = 'S' | 'I'

export type VerifactuRecordType = 'alta' | 'anulacion'

export type VerifactuRecordStatus =
    | 'pending'
    | 'queued'
    | 'sent'
    | 'accepted'
    | 'accepted_with_warnings'
    | 'rejected'
    | 'failed'
    | 'annulled'

export type VerifactuAeatStatus = 'correcto' | 'aceptado_con_errores' | 'incorrecto'

/** `pdf`: registered by `sdk.pdf.invoice()`. */
export type VerifactuInvoiceSource = 'oruga' | 'api' | 'pdf'

/** Tax: 01 IVA, 02 IPSI (Ceuta/Melilla), 03 IGIC (Canarias), 05 Others. */
export type VerifactuTaxType = '01' | '02' | '03' | '05'

/** ClaveRegimen */
export type VerifactuRegimeKey =
    | '01'
    | '02'
    | '03'
    | '04'
    | '05'
    | '06'
    | '07'
    | '08'
    | '09'
    | '10'
    | '11'
    | '12'
    | '13'
    | '14'
    | '15'
    | '17'
    | '18'
    | '19'
    | '20'
    | '21'

/** CalificacionOperacion (S1, S2, N1, N2) or OperacionExenta (E1-E8). */
export type VerifactuOperation =
    | 'S1'
    | 'S2'
    | 'N1'
    | 'N2'
    | 'E1'
    | 'E2'
    | 'E3'
    | 'E4'
    | 'E5'
    | 'E6'
    | 'E7'
    | 'E8'

/** Pagination and ordering shared by every `GET` list. */
export interface ListQuery {
    /** @default 1 */
    page?: number
    /** 1-100. @default 15 */
    limit?: number
    /** Sort field (each resource allows its own). @default 'id' */
    sort?: string
    /** @default 'asc' */
    order?: 'asc' | 'desc'
}

/** Every list answers `{ data, total_items }`. */
export interface ListResponse<T> {
    data: T[]
    total_items: number
}

/** Body of `POST …/search` (filter DSL: `{ field: value | { $op: value } }`, `$and`/`$or`). */
export interface SearchBody {
    filter?: Record<string, unknown>
    sort?: Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[]
    page?: number
    limit?: number
    /** Sparse fieldset (dot paths for relations). With it, rows are plain objects. */
    fields?: string[]
}

/** Error body of the API. */
export interface ApiErrorBody {
    status: number
    code: string
    message: string
    errors?: unknown[]
    details?: Record<string, unknown>
}

// ============================================================================
// Invoices — input
// ============================================================================

export interface VerifactuTaxLineInput {
    /** @default '01' */
    tax_type?: VerifactuTaxType
    /** Empty in IVA/IGIC = 01 */
    regime_key?: VerifactuRegimeKey
    /** If missing: S1 with rate > 0 (or base and tax 0), N2 otherwise. */
    operation?: VerifactuOperation
    /** Tax rate (%). */
    tax_rate?: DecimalInput
    /** Taxable base (negative in a credit note). */
    base: DecimalInput
    /** BaseImponibleACoste (regime 06). */
    base_at_cost?: DecimalInput
    tax_amount?: DecimalInput
    /** Equivalence surcharge rate (%). */
    surcharge_rate?: DecimalInput
    surcharge_amount?: DecimalInput
}

/** Recipient: a Spanish `nif`, or `id_type` + `id` (+ `country_code`) for IDOtro. */
export interface VerifactuRecipientInput {
    name: string
    /** Spanish NIF (9 alphanumeric). */
    nif?: string
    /** 02 NIF-IVA, 03 passport, 04 official doc., 05 residence, 06 other, 07 not registered. */
    id_type?: '02' | '03' | '04' | '05' | '06' | '07'
    id?: string
    /** ISO 3166-1 alpha-2 (required except for 02). */
    country_code?: string
}

/** A referenced invoice: by its ORUGA id, or by its IDFactura. */
export interface VerifactuInvoiceRefInput {
    /** `verifactu_invoice.id` of this workspace. */
    invoice_id?: number
    /** Issuer NIF (defaults to the taxpayer's). */
    issuer_nif?: string
    invoice_number?: string
    issue_date?: CalendarDate
}

export interface VerifactuRectifiedAmountsInput {
    base: DecimalInput
    tax: DecimalInput
    surcharge?: DecimalInput
}

/** `POST /verifactu/invoices` (`CreateVerifactuInvoiceDto`). */
export interface CreateVerifactuInvoiceInput {
    /** Issuing taxpayer (or `issuer_nif` + `environment`). */
    taxpayer_id?: number
    /** Issuer NIF, when `taxpayer_id` is not sent. */
    issuer_nif?: string
    /** With `issuer_nif`: the taxpayer's environment (needed if the NIF exists in both). */
    environment?: VerifactuEnvironment
    /** NumSerieFactura (1-60 chars, without `" ' < > =`). */
    invoice_number: string
    /** `YYYY-MM-DD`, or an ISO instant WITH zone (read in Europe/Madrid). */
    issue_date: string
    /** @default 'F1' */
    invoice_type?: VerifactuInvoiceType
    /** Required in R1-R5. */
    rectification_type?: VerifactuRectificationType
    /** R1-R5 */
    rectified_invoices?: VerifactuInvoiceRefInput[]
    /** F3 only */
    substituted_invoices?: VerifactuInvoiceRefInput[]
    /** ImporteRectificacion (required in a rectification by substitution, `S`). */
    rectified_amounts?: VerifactuRectifiedAmountsInput
    /** FechaOperacion, if different. */
    operation_date?: string
    /** DescripcionOperacion (defaults to «Factura <number>»). */
    description?: string
    /** FacturaSimplificadaArt7273 (F1, F3, R1-R4). */
    simplified_art_7273?: boolean
    /** FacturaSinIdentifDestinatarioArt61d (F2, R5). */
    unidentified_recipient_art_61d?: boolean
    billing_agreement_number?: string
    /** Required except in F2/R5. */
    recipients?: VerifactuRecipientInput[]
    /** 1-12 lines. */
    tax_lines: VerifactuTaxLineInput[]
    /** CuotaTotal. Optional: if sent, it must match the tax lines. */
    tax_total?: DecimalInput
    /** ImporteTotal */
    total: DecimalInput
    /** Id of the invoice in your ERP. */
    external_id?: string
    /** Webhook for the verdicts of this invoice (overrides the workspace webhook). */
    callback_url?: string
}

/**
 * `POST /verifactu/invoices/:id/correct` (subsanación): same data as the
 * creation without taxpayer, origin or callback. The IDFactura does not change:
 * `invoice_number`/`issue_date`, if sent, must be the invoice's.
 */
export type CorrectVerifactuInvoiceInput = Omit<
    CreateVerifactuInvoiceInput,
    | 'taxpayer_id'
    | 'issuer_nif'
    | 'environment'
    | 'external_id'
    | 'callback_url'
    | 'invoice_number'
    | 'issue_date'
> & {
    invoice_number?: string
    issue_date?: string
}

export interface ListVerifactuInvoicesQuery extends ListQuery {
    taxpayer_id?: number
    /** Status of the current record. */
    status?: VerifactuRecordStatus
    /** Type of the current record. */
    record_type?: VerifactuRecordType
    /** Contains (case insensitive). */
    invoice_number?: string
    /** Exact. */
    external_id?: string
    invoice_type?: VerifactuInvoiceType
    source?: VerifactuInvoiceSource
    /** issue_date from (inclusive). */
    date_from?: CalendarDate
    /** issue_date to (inclusive). */
    date_to?: CalendarDate
}

// ============================================================================
// Invoices — output
// ============================================================================

/** An invoice with its current record flattened (create, correct, annul, lists). */
export interface VerifactuInvoice {
    id: number
    taxpayer_id: number
    issuer_nif: string
    environment: VerifactuEnvironment
    source: VerifactuInvoiceSource
    source_invoice_id: number | null
    external_id: string | null
    invoice_number: string
    issue_date: CalendarDate
    invoice_type: VerifactuInvoiceType
    rectification_type: VerifactuRectificationType | null
    callback_url: string | null
    /** ValidarQR URL to print on the invoice. */
    qr_payload: string | null
    current_record_id: number | null
    record_type: VerifactuRecordType | null
    status: VerifactuRecordStatus | null
    chain_index: number | null
    hash: string | null
    aeat_status: VerifactuAeatStatus | null
    aeat_csv: string | null
    aeat_error_code: string | null
    aeat_error_description: string | null
    total: string | null
    tax_total: string | null
    sent_at: IsoDateTime | null
    responded_at: IsoDateTime | null
    created_at: IsoDateTime
    updated_at: IsoDateTime
}

export interface VerifactuRecordTaxLine {
    position: number
    tax_type: string
    regime_key: string | null
    operation: string
    tax_rate: string | null
    base: string | null
    base_at_cost: string | null
    tax_amount: string | null
    surcharge_rate: string | null
    surcharge_amount: string | null
}

/** A resolved invoice reference stored in a record (IDFactura). */
export interface VerifactuInvoiceRef {
    issuer_nif: string
    invoice_number: string
    issue_date: CalendarDate
}

/** A record (chain link) with its tax lines. */
export interface VerifactuRecord {
    id: number
    workspace_id: number
    taxpayer_id: number
    invoice_id: number
    record_type: VerifactuRecordType
    status: VerifactuRecordStatus
    correction: boolean
    previous_rejection: 'N' | 'S' | 'X' | null
    corrected_record_id: number | null
    chain_index: number
    hash: string
    previous_hash: string
    generated_at: string
    issuer_nif: string
    issuer_name: string
    customer_name: string | null
    customer_tax_id: string | null
    recipients: VerifactuRecipientInput[] | null
    invoice_type: VerifactuInvoiceType | null
    rectification_type: VerifactuRectificationType | null
    rectified_invoices: VerifactuInvoiceRef[] | null
    substituted_invoices: VerifactuInvoiceRef[] | null
    rectified_base: string | null
    rectified_tax: string | null
    rectified_surcharge: string | null
    operation_date: CalendarDate | null
    description: string | null
    simplified_art_7273: boolean
    unidentified_recipient_art_61d: boolean
    billing_agreement_number: string | null
    tax_total: string | null
    total: string | null
    batch_id: number | null
    retry_count: number
    next_attempt_at: IsoDateTime | null
    sent_at: IsoDateTime | null
    responded_at: IsoDateTime | null
    aeat_status: VerifactuAeatStatus | null
    aeat_csv: string | null
    aeat_error_code: string | null
    aeat_error_description: string | null
    last_error: string | null
    created_at: IsoDateTime
    updated_at: IsoDateTime
    /** Present in invoice detail, invoice records and record detail. */
    tax_lines?: VerifactuRecordTaxLine[]
}

/** `GET /verifactu/invoices/:id` — the invoice plus its record history. */
export interface VerifactuInvoiceDetail extends VerifactuInvoice {
    records: VerifactuRecord[]
}

/** `POST /verifactu/invoices/bulk` — one result per invoice, in order. */
export interface VerifactuBulkResult {
    total: number
    succeeded: number
    failed: number
    results: Array<
        | { index: number; success: true; data: VerifactuInvoice }
        | { index: number; success: false; error: ApiErrorBody }
    >
}

/** `GET /verifactu/invoices/:id/qr` */
export interface VerifactuQr {
    invoice_id: number
    qr_payload: string
    /** SVG image of the QR. */
    svg: string
}

// ============================================================================
// Records
// ============================================================================

export interface ListVerifactuRecordsQuery extends ListQuery {
    taxpayer_id?: number
    invoice_id?: number
    status?: VerifactuRecordStatus
    record_type?: VerifactuRecordType
}

/** `GET /verifactu/records/:id` */
export interface VerifactuRecordDetail extends VerifactuRecord {
    is_current: boolean
    invoice: { id: number; invoice_number: string; external_id: string | null }
    errors: VerifactuErrorRow[]
}

export interface VerifactuSubmission {
    id: number
    batch_id: number
    attempt: number
    request_xml: string
    response_xml: string | null
    http_status: number | null
    /** EstadoEnvio, or the SOAP Fault code. */
    response_code: string | null
    csv: string | null
    error: string | null
    duration_ms: number
    created_at: IsoDateTime
}

/** `GET /verifactu/records/:id/xml` — submissions of the record's current batch. */
export interface VerifactuRecordXml {
    record_id: number
    batch_id: number | null
    submissions: VerifactuSubmission[]
}

// ============================================================================
// Taxpayers and representations
// ============================================================================

export interface VerifactuTaxpayer {
    id: number
    workspace_id: number
    issuer_id: number | null
    nif: string
    legal_name: string
    environment: VerifactuEnvironment
    active: boolean
    own_certificate: boolean
    last_chain_index: number | null
    last_hash: string | null
    last_record_id: number | null
    next_send_at: IsoDateTime | null
    wait_seconds: number
    min_records: number
    created_at: IsoDateTime
    updated_at: IsoDateTime
}

/** `GET /verifactu/taxpayers/:id` */
export interface VerifactuTaxpayerDetail extends VerifactuTaxpayer {
    /** `null` for an `own_certificate` taxpayer (it does not need one). */
    has_current_representation: boolean | null
    /** Active and with a current representation (or own certificate). */
    can_send: boolean
}

export interface CreateVerifactuTaxpayerInput {
    /** NIF (9 chars). */
    nif: string
    /** Legal name EXACTLY as in the AEAT census (goes to the XML). */
    legal_name: string
    environment: VerifactuEnvironment
    /** Accounting issuer it belongs to, if any. */
    issuer_id?: number | null
    /** @default true */
    active?: boolean
    /** Platform OWNER only (JWT session): an API key can never set it. */
    own_certificate?: boolean
}

export type UpdateVerifactuTaxpayerInput = Partial<CreateVerifactuTaxpayerInput>

export interface ListVerifactuTaxpayersQuery extends ListQuery {
    environment?: VerifactuEnvironment
    active?: boolean
    /** Searches NIF and legal name. */
    search?: string
}

export interface VerifactuTaxpayerDeleteResult {
    id: number
    /** Deleted only when it had no invoices nor representations. */
    deleted: boolean
    /** Otherwise it is deactivated. */
    deactivated: boolean
}

export interface VerifactuRepresentation {
    id: number
    taxpayer_id: number
    model_version: string
    document_name: string | null
    document_mime_type: string | null
    signed_at: CalendarDate
    signer_name: string
    signer_nif: string
    valid_from: CalendarDate
    revoked_at: IsoDateTime | null
    verified_at: IsoDateTime | null
    verified_by_id: number | null
    created_by_id: number | null
    notes: string | null
    created_at: IsoDateTime
    updated_at: IsoDateTime
    has_document: boolean
    verified: boolean
    /** Verified, in force and not revoked: what sending requires. */
    current: boolean
}

export interface CreateVerifactuRepresentationInput {
    /** The signed model (PDF or image, max 20 MB). */
    file: Blob
    /** File name sent in the multipart (defaults to `representation.pdf`). */
    filename?: string
    /** e.g. `017` */
    model_version: string
    signed_at: CalendarDate
    signer_name: string
    signer_nif: string
    valid_from: CalendarDate
    notes?: string
}

export interface RevokeVerifactuRepresentationInput {
    /** When it stops being valid (`YYYY-MM-DD` or ISO instant with zone). Defaults to now. */
    revoked_at?: string
    notes?: string
}

/** Raw download of a signed representation model. */
export interface VerifactuDocument {
    data: ArrayBuffer
    contentType: string | null
    filename: string | null
}

// ============================================================================
// Errors inbox
// ============================================================================

export interface ListVerifactuErrorsQuery extends ListQuery {
    /** `false` = the pending inbox. */
    resolved?: boolean
    severity?: 'warning' | 'error'
    /** AEAT error code. */
    code?: string
    taxpayer_id?: number
    invoice_id?: number
    record_id?: number
}

/** A row of the errors table. */
export interface VerifactuErrorRow {
    id: number
    record_id: number | null
    batch_id: number | null
    code: string | null
    /** FATAL, PERMANENT, … */
    category: string
    severity: 'warning' | 'error'
    description: string
    suggested_action: string | null
    resolved: boolean
    resolved_at: IsoDateTime | null
    created_at: IsoDateTime
}

/** `GET /verifactu/errors` rows include a summary of their record. */
export interface VerifactuError extends VerifactuErrorRow {
    record: {
        id: number
        invoice_id: number
        taxpayer_id: number
        record_type: VerifactuRecordType
        status: VerifactuRecordStatus
        chain_index: number
        invoice: { invoice_number: string; external_id: string | null }
    } | null
}

// ============================================================================
// Webhook
// ============================================================================

/** `GET /verifactu/webhook` — never includes the secret. */
export interface VerifactuWebhookConfig {
    configured: boolean
    url: string | null
    active: boolean
    /** Last characters of the secret (`…abcd`). */
    secret_hint: string | null
    secret_rotated_at: IsoDateTime | null
    created_at: IsoDateTime | null
    updated_at: IsoDateTime | null
}

export interface UpdateVerifactuWebhookInput {
    /** Public http(s) URL; `null` removes it. */
    url?: string | null
    /** Pause or resume the notifications to the workspace URL. */
    active?: boolean
}

/** `PUT /verifactu/webhook` — `secret` comes only the first time (creation). */
export interface VerifactuWebhookUpdateResult extends VerifactuWebhookConfig {
    secret?: string
}

/** `POST /verifactu/webhook/rotate-secret` — the only time the new secret is shown. */
export interface VerifactuWebhookSecret {
    secret: string
    secret_hint: string
    secret_rotated_at: IsoDateTime
}

export interface ListVerifactuWebhookDeliveriesQuery extends ListQuery {
    status?: 'pending' | 'delivered' | 'failed'
    invoice_id?: number
    record_id?: number
}

export interface VerifactuWebhookDelivery {
    id: number
    workspace_id: number
    invoice_id: number | null
    record_id: number | null
    event: string
    url: string
    payload: VerifactuWebhookEvent
    status: 'pending' | 'delivered' | 'failed'
    attempts: number
    next_attempt_at: IsoDateTime | null
    last_status_code: number | null
    last_error: string | null
    delivered_at: IsoDateTime | null
    created_at: IsoDateTime
    updated_at: IsoDateTime
}

/**
 * Body POSTed to your webhook when a record reaches a verdict (`accepted`,
 * `accepted_with_warnings`, `rejected`, `failed`). The verdict is
 * `data.status`; the AEAT error code, if any, `data.aeat_error_code`.
 */
export interface VerifactuWebhookEvent {
    event: 'verifactu_record.status_changed'
    occurred_at: IsoDateTime
    /** Your `external_id`, or the ORUGA invoice id when there is none. */
    invoice_id: string
    data: {
        verifactu_invoice_id: number
        external_id: string | null
        taxpayer_id: number
        invoice_number: string
        issue_date: CalendarDate
        record_id: number
        record_type: VerifactuRecordType
        chain_index: number
        status: VerifactuRecordStatus
        aeat_status: VerifactuAeatStatus | null
        aeat_csv: string | null
        aeat_error_code: string | null
        aeat_error_description: string | null
    }
    /** Use it to discard duplicates (`X-Oruga-Delivery` header too). */
    delivery_id?: number
}
