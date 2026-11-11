# ORUGA — SDK TypeScript (`oruga-sdk-ts`)

> **⚙️ Flujo de trabajo — léelo antes de tocar nada.**
> **Ramas + Pull Request, nunca commit directo a `main`.** Este repo no tiene
> rama `sandbox`, solo `main`. CI (`.github/workflows/build.yml`) corre build,
> typecheck y tests en cada push/PR a `main`; `publish.yml` publica a npm al
> empujar un tag `v*` (secreto `NPM_TOKEN`). Nadie publica a mano.

Paquete npm público **`@calltek/oruga-sdk`** (repo `calltek/oruga-sdk-ts`,
antes `invo-sdk-ts`) para que **ERPs de terceros** (copyexpress, vcs…) usen la
API de ORUGA (`https://api.oru.ga/v1`, backend `og-backend`). Cubre
VERI\*FACTU (`/v1/verifactu/*`; ver `og-backend/docs/architecture/verifactu.md`)
y el PDF de facturas de ERPs (`/v1/pdf/invoices`; ver
`og-backend/docs/architecture/services.md`).

Sustituye a `@calltek/invo-sdk` y **no tiene capa de compatibilidad con INVO**:
nada de `InvoSDK`, `store()`, DTOs camelCase, `apiToken`, `environment`,
`read()`/`pdf()` ni helpers JWT. La guía de migración desde invo-sdk 0.x
(con la tabla de campos `store()` → `invoices.create()`) está en el CHANGELOG.

---

## 1. Stack

| Capa | Elección |
| --- | --- |
| Lenguaje | TypeScript, **cero dependencias en runtime** (`fetch` nativo, `node:crypto`) |
| Build | Rollup (`@rollup/plugin-typescript` + `rollup-plugin-dts`) → `dist/index.js` (ESM) + `dist/index.cjs` (CommonJS) + `dist/index.d.ts` / `index.d.cts`. `node:*` es external |
| Tests | **vitest** con `fetch` simulado (`test/*.test.ts`), sin red |
| Tipos de la API | **Escritos a mano** desde los DTOs y presenters de og-backend (`src/types/verifactu.types.ts`). El `swagger.json` del backend no estaba al día; si algún día se generan desde el OpenAPI, que sea del tag Verifactu |
| Package manager | npm (CI, `package-lock.json`). bun sirve en local |
| Runtime objetivo | Node ≥ 18; Node 16.14+ pasando `config.fetch` (Las Garmillas corre en Node 16 con CommonJS). vitest/vite 7 piden ≥ 20.19 para correr los tests; en CI, Node 18 solo compila |

---

## 2. Estructura

```
src/
├── index.ts        ← superficie pública (export curado)
├── sdk.ts          ← OrugaSDK: config (apiKey ogk_ obligatoria), sdk.verifactu, request() genérico
├── pdf.ts          ← sdk.pdf.invoice(): POST /pdf/invoices → { data, filename, verifactu } (cabeceras X-Verifactu-*)
├── verifactu.ts    ← sdk.verifactu.{invoices,records,taxpayers(+representations),errors,webhook}, 1:1 con los controladores
├── http.ts         ← cliente HTTP: Bearer ogk_, timeout, Idempotency-Key automática, reintentos, errores tipados
├── webhook.ts      ← verifyWebhookSignature / constructWebhookEvent / signWebhookPayload / WEBHOOK_HEADERS (X-Oruga-*)
├── errors.ts       ← OrugaError → OrugaConfigError/OrugaValidationError, OrugaApiError (→ Auth/RateLimit), OrugaNetworkError (→ Timeout)
├── version.ts      ← SDK_VERSION (= package.json, lo comprueba un test) y DEFAULT_BASE_URL
└── types/
    ├── pdf.types.ts       ← tipos de /pdf (snake_case)
    ├── verifactu.types.ts ← tipos de la API de ORUGA (snake_case)
    └── sdk.types.ts       ← OrugaSDKConfig, RequestOptions
```

---

## 3. Cómo correrlo

```bash
npm install
npm run build       # rollup -c → dist/
npm test            # vitest
npm run typecheck   # src + tests
```

`dist/` no está en git (está en `.gitignore`).

---

## 4. Decisiones tomadas

- **API key** `ogk_…` obligatoria; si no empieza por `ogk_`, `OrugaConfigError`.
  Sin canje por JWT ni cabecera de workspace (la key lo implica).
- **Webhooks**: cabeceras `X-Oruga-Timestamp` / `X-Oruga-Signature`
  (`sha256=` HMAC-SHA256 de `"<timestamp>.<cuerpo crudo>"`, tolerancia 300 s),
  más `X-Oruga-Event` y `X-Oruga-Delivery`. El cuerpo no lleva `invo_status`:
  el veredicto va en `data.status`. Tiene que coincidir con
  `og-backend/src/modules/verifactu/webhook/webhook-signature.ts` (un test fija
  los nombres de las cabeceras).
- **Reintentos** solo en peticiones idempotentes (GET/PUT/DELETE, `search`,
  `errors.resolve` y escrituras con Idempotency-Key); 429 respeta `Retry-After`.
  `records.resend` y `taxpayers.create` no se reintentan.
- **`request()`** queda como vía de escape genérica, relativa a `baseUrl`.
- El `requestId` del error es la cabecera `X-Correlation-Id` del backend.
- `User-Agent: oruga-sdk-ts/<versión>`; el logger de `debug` nunca imprime la key.

---

## 5. Pendiente / fuera de alcance

- `docs/` solo tiene `PUBLISHING.md`; la documentación pública es el README.
- ESLint y Prettier siguen rotos (config vieja con ESLint 9; `.prettierrc.js`
  con `module.exports` en un paquete ESM). No corren en CI.
- Cuando cambie `og-backend/src/modules/pdf/dto/pdf-invoice.dto.ts`, hay que
  actualizar `src/types/pdf.types.ts` a mano.
- Cuando cambie un DTO del backend (`og-backend/src/modules/verifactu/**/dto`
  o los presenters `presentInvoice`/`presentRecord`), hay que actualizar
  `src/types/verifactu.types.ts` a mano.
- `@calltek/invo-sdk` en npm: deprecarlo apuntando a `@calltek/oruga-sdk`
  (`npm deprecate`) cuando se publique la 1.0.0.
