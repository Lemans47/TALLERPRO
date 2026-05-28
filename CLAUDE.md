# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TallerPro is a Next.js 15 (App Router) web application for managing an auto repair shop (taller automotriz). It handles service orders, quotes (presupuestos), expenses, employees, clients/vehicles, and financial reporting. Deployed on Vercel, using Supabase for auth and a direct PostgreSQL connection for all data.

## Commands

```bash
npm run dev      # Start dev server (PWA disabled in dev)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

There is no test suite. Type-check manually with `npx tsc --noEmit`.

## Environment Variables

```
DATABASE_URL or POSTGRES_URL       # Direct Postgres connection string (Supabase pooler port 6543)
NEXT_PUBLIC_SUPABASE_URL           # Supabase project URL (auth only)
NEXT_PUBLIC_SUPABASE_ANON_KEY      # Supabase anon key (auth only)
CLOUDINARY_CLOUD_NAME              # Photo storage
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

## Architecture

### Two Separate Database Clients

This is the most important architectural distinction:

- **`lib/supabase.ts`**: Supabase browser client via `@supabase/ssr` — used **only for authentication** (sessions, user roles). Never used to query business data.
- **`lib/database.ts`**: Direct PostgreSQL client via the `postgres` npm package — used for **all business data**. Connection is a singleton (`global._pgSql`) configured for PgBouncer transaction mode: `prepare: false` is mandatory, `max: 20`.

API routes in `app/api/` call `lib/database.ts` functions directly. Client components call `lib/api-client.ts` fetch wrappers which hit those routes.

### Data Flow

```
Client component
  → lib/api-client.ts (fetch wrappers, organized under `api.*` namespace)
    → app/api/*/route.ts (Next.js API routes)
      → lib/database.ts (SQL queries via postgres.js)
```

### React Context Providers (app-shell.tsx)

Three global providers wrap all authenticated pages:

1. **`AuthProvider`** (`lib/auth-context.tsx`): Exposes `user`, `role` (`admin | supervisor | operador | null`), `loading`. Role is loaded asynchronously from `user_roles` table — don't gate UI on role sync with auth state.
2. **`EstadosProvider`** (`lib/estados.ts`): Loads configurable service states from `/api/estados-servicio`. Provides `useEstados()` hook with helpers: `esCerrado()`, `esPorCobrar()`, `esFinalizado()`, `esActivo()`, `colorOf()`. Falls back to hardcoded defaults if the API fails.
3. **`MonthProvider`** (`lib/month-context.tsx`): Global `selectedMonth` (YYYY-MM string) shared across dashboard, reports, and services list.

Public routes (`/login`, `/reset-password`, `/solicitar-presupuesto`) skip the auth check in `ShellContent`.

### Service States System

States are **not hardcoded** — they live in the `estados_servicio` table and are typed as `activo | por_cobrar | cerrado`. Always use `getNombresEstadosPorTipo(tipos)` in database functions to get current state names by type. This function has a 30-second in-memory cache; call `invalidateEstadosCache()` after any mutation to `estados_servicio`. Renaming a state automatically propagates to all `servicios` rows in a transaction.

### Financial Conventions

- All amounts are Chilean pesos (CLP), stored as `DECIMAL(12,0)` — no decimals.
- IVA = 19%. The `iva` field on servicios/presupuestos is `"con"` or `"sin"`.
- `monto_total_sin_iva` and `monto_total` (with IVA if applicable) are stored separately.
- KPI calculations are the **single source of truth** in `lib/reportes/kpis.ts`. Both `/api/dashboard` and `/app/reportes` import from there — never duplicate formulas.
- "Materiales pintura" cost items are excluded from direct cost calculations because they're tracked separately in `gastos` (see `isCostoRealItem()` in kpis.ts).

### JSONB Fields

`servicios` and `presupuestos` store structured data as JSONB: `cobros`, `costos`, `piezas_pintura`, `abonos`, `fotos_ingreso`, `fotos_entrega`, `observaciones_checkboxes`. Always serialize these via `safeJson()` (from `lib/database.ts`) before inserting/updating — it prevents double-encoding that occurs when Postgres returns values as strings.

### Database Migrations

**Never run DDL in application code.** All schema changes go in `scripts/*.sql` and must be run manually in Supabase SQL Editor. `scripts/02-runtime-migration.sql` is the primary idempotent migration script. The `ensurePrecioPinturaColumns()` function in database.ts is a legacy exception still in place.

### Photo Storage

Photos (fotos_ingreso, fotos_entrega) are stored on Cloudinary. Upload via `/api/upload` (POST), delete via `/api/upload` (DELETE). Stored as `{ url, publicId }` objects in JSONB arrays. When deleting a servicio, the route also deletes associated Cloudinary images.

### Patente Normalization

License plates are normalized via `REGEXP_REPLACE(patente, '[^A-Za-z0-9]', '', 'g')` + `UPPER()`. The `servicios` and `vehiculos` tables have a generated column `patente_norm` for indexed lookups. Use this pattern consistently when querying by plate.

### Dashboard Performance

The dashboard fires 11 parallel queries. Results are cached in a process-level `Map` (`global._dashboardCache`) with a 30s TTL to survive rapid month-switching. The client has a 60s timeout (`DashboardTimeoutError`); the Postgres connection has a 30s `statement_timeout`. Chart data deduplication is in `api-client.ts` (`chartDataInFlight` promise sharing).

### PDF Generation

`lib/pdf-orden-trabajo.ts`, `lib/pdf-presupuesto.ts`, and `lib/pdf-recibo.ts` generate PDFs client-side using jsPDF + jspdf-autotable. Previewed in `components/pdf-preview-modal.tsx` using pdfjs-dist.

### Key Tables

| Table | Purpose |
|---|---|
| `servicios` | Service orders (main entity) |
| `presupuestos` | Quotes — converted to servicios atomically via `convertPresupuestoToServicio()` |
| `gastos` | Operating expenses |
| `empleados` + `abonos_empleados` | Employees and salary advance payments |
| `estados_servicio` | Configurable service states |
| `clientes` + `vehiculos` | Auto-synced from servicios on create/update |
| `precios_pintura` + `piezas_pintura` | Paint job pricing config |
| `gastos_fijos_plantillas` | Fixed expense templates |
| `plantillas_servicio` | Reusable service charge/cost templates |
| `proveedores` | Suppliers |
| `user_roles` | Supabase user roles (`admin`, `supervisor`, `operador`) |

### Idempotency Guard

`createServicio()` checks for duplicate POSTs: same plate + client within 30 seconds returns the existing record instead of inserting a new one.
