# Configuración de TallerPro

TallerPro es una aplicación Next.js 15 (App Router) para gestionar un taller
automotriz. Se despliega en **Vercel** y usa **Supabase** (solo para
autenticación) más una **conexión directa a PostgreSQL** para toda la data de
negocio.

> ℹ️ Este documento cubre la puesta en marcha del proyecto. Para los bots de
> Telegram (gastos y cobranzas) ver [`TELEGRAM.md`](./TELEGRAM.md). Para el
> detalle de la arquitectura ver [`CLAUDE.md`](./CLAUDE.md).

## Requisitos previos

- Cuenta de **Supabase** activa (para auth y como host de PostgreSQL).
- Proyecto en **Vercel** (o entorno local con Node.js) donde configurar las
  variables de entorno.
- Cuenta de **Cloudinary** (para las fotos de ingreso/entrega).

## Arquitectura: dos clientes de base de datos

Es la distinción más importante del proyecto:

| Cliente | Archivo | Para qué |
|---|---|---|
| **Supabase** (`@supabase/ssr`) | `lib/supabase.ts` | **Solo autenticación**: sesiones, usuarios y roles (`user_roles`). Nunca consulta data de negocio. |
| **PostgreSQL directo** (`postgres` npm) | `lib/database.ts` | **Toda la data de negocio**: servicios, presupuestos, gastos, etc. Singleton configurado para el pooler de Supabase (PgBouncer, `prepare: false`). |

Por eso hacen falta **dos** cadenas de conexión distintas: las claves públicas
de Supabase (auth) y la URL directa de Postgres (data).

## Variables de entorno

Configúralas en Vercel (**Settings → Environment Variables**) o en un
`.env.local` para desarrollo.

### Base de datos (conexión directa Postgres) — **obligatoria**

```
DATABASE_URL=postgresql://...   # o POSTGRES_URL
```

- Cadena de conexión **directa** a PostgreSQL de Supabase, usando el **pooler en
  modo transacción (puerto 6543)**. El código acepta `DATABASE_URL` o, como
  alternativa, `POSTGRES_URL`.
- Sin esta variable la app no puede leer ni escribir data de negocio.

### Autenticación (Supabase) — **obligatoria**

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`: cliente de auth
  (login, sesión, lectura de rol).
- `SUPABASE_SERVICE_ROLE_KEY`: necesaria para administrar usuarios y roles desde
  `/api/usuarios` (crear usuarios, asignar rol). **Secreta** — nunca exponer al
  cliente.

### Fotos (Cloudinary) — **obligatoria si se usan fotos**

```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Usadas por `/api/upload` para subir/borrar las fotos de ingreso y entrega.

### Telegram y cron — **opcionales**

```
TELEGRAM_BOT_TOKEN=...                     # bot de gastos
TELEGRAM_COBRANZAS_BOT_TOKEN=...           # bot de cobranzas
TELEGRAM_ALLOWED_CHAT_IDS=123,456          # chat IDs autorizados (ambos bots)
TELEGRAM_COBRANZAS_ALLOWED_CHAT_IDS=...    # opcional, solo cobranzas
CRON_SECRET=...                            # protege el cron de cobranzas diario
GETAPI_API_KEY=...                         # consulta de datos de patente (si aplica)
```

Detalle completo de los bots y el cron en [`TELEGRAM.md`](./TELEGRAM.md).

> **Nota:** todos los valores de arriba son ejemplos. Reemplázalos por tus
> credenciales reales y nunca los subas al repositorio.

## Configuración de la base de datos

> ℹ️ **Contexto histórico:** el proyecto se armó originalmente en v0 / el
> dashboard de Supabase, y varias tablas quedaron creadas "a mano" sin capturarse
> como migración. Por eso `02-runtime-migration.sql` referenciaba `vehiculos` sin
> que ningún script la creara. Ese hueco ahora está cubierto por
> `00-tablas-base-faltantes.sql` (ver el paso 1), que crea las tablas `clientes`,
> `vehiculos`, `empleados`, `abonos_empleados`, `user_roles`, `proveedores`,
> `precios_pintura` y `piezas_pintura`.

### Cómo correr los scripts

Todos los cambios de esquema se ejecutan **manualmente** en el **SQL Editor** de
Supabase (Dashboard → SQL Editor → pegar → Run). **Nunca** se corre DDL desde el
código de la aplicación.

1. **`scripts/00-tablas-base-faltantes.sql`** — crea las tablas base que el resto
   del esquema asume (`clientes`, `vehiculos`, `empleados`, `abonos_empleados`,
   `user_roles`, `proveedores`, `precios_pintura`, `piezas_pintura`).
   **Idempotente** (`CREATE TABLE IF NOT EXISTS` + guards): sobre un proyecto que
   ya las tenga es un no-op y no toca datos. **En una base vacía, empieza por acá.**

2. **`scripts/02-runtime-migration.sql`** — script principal, **idempotente**
   (se puede correr varias veces sin romper nada). Consolida columnas, secuencias
   (`numero_ot`), columnas generadas `patente_norm`, índices de rendimiento y las
   tablas `gastos_fijos_plantillas` y `plantillas_servicio`.

3. Luego, según lo que falte en tu proyecto, corre las migraciones incrementales
   en orden numérico (`03` … `15`). Cada una añade una capacidad puntual, por
   ejemplo:
   - `03-user-roles-unique.sql` — constraint UNIQUE en `user_roles(user_id)`.
   - `04-fecha-entregado.sql`, `06`/`07`/`09` — campos de presupuestos y fechas.
   - `08-abonos-multiples.sql`, `13-reconciliar-abonos-anticipo.sql`,
     `14-constraints-pagos.sql` — sistema de pagos (abonos, anticipo,
     saldo pendiente y sus CHECK constraints).
   - `11-fix-jsonb-double-encoding.sql` — backfill de JSONB (ya ejecutado en
     producción el 2026-07-05).
   - `12-indice-gin-costos.sql` — índice GIN para el prefiltro `@>` en
     `servicios.costos`.
   - `estados-servicio.sql` + `estados-servicio-color.sql` — tabla de estados
     configurables y sus colores.

   > Cada script es idempotente o de un solo uso; revisa el encabezado del
   > archivo antes de correrlo. Si tu proyecto ya está al día, muchos serán
   > no-ops.

4. **`scripts/01-create-tables.sql` — ⚠️ NO correr en un proyecto con datos.**
   Este script es **destructivo**: hace `DROP TABLE ... CASCADE` de `servicios`,
   `presupuestos`, `gastos` y `trabajadores`. Además está desactualizado (usa la
   tabla antigua `trabajadores` en vez de `empleados` y no crea las tablas
   modernas). Solo tiene valor histórico.

## Estados de servicio (configurables)

Los estados **no están hardcodeados**. Viven en la tabla `estados_servicio` y se
tipan como `activo | por_cobrar | cerrado`. Se administran desde la app y se
pueden renombrar (el cambio se propaga a todos los `servicios` en una
transacción). Ver la sección "Service States System" de `CLAUDE.md`.

## Roles de usuario

La app maneja tres roles: `admin`, `supervisor`, `operador`. El rol se guarda en
la tabla `user_roles` (leída vía Supabase, no por la conexión directa).

- Los usuarios y sus roles se administran desde la app en `/api/usuarios` (crea
  el usuario en Supabase Auth y hace upsert del rol). Requiere
  `SUPABASE_SERVICE_ROLE_KEY`.
- Para el **primer** usuario admin, créalo en Supabase Auth y agrega su fila en
  `user_roles` manualmente (`user_id`, `role = 'admin'`).

## Desarrollo local

```bash
npm install
npm run dev      # servidor de desarrollo (PWA desactivada en dev)
npm run build    # build de producción
npm run lint     # ESLint
npx tsc --noEmit # chequeo de tipos (no hay suite de tests)
```

## Convenciones financieras (resumen)

- Montos en **pesos chilenos (CLP)**, sin decimales (`DECIMAL(12,0)`).
- **IVA = 19%**; el campo `iva` es `"con"` o `"sin"`.
- `anticipo`, `saldo_pendiente` y `abonos[].monto` son **brutos** (IVA incluido);
  las KPIs de ingresos usan el **neto** `monto_total_sin_iva`.
- Invariante de pagos: `anticipo = Σ abonos` y
  `saldo_pendiente = max(0, monto_total − anticipo)`. Se aplica **server-side**;
  el cliente nunca escribe `anticipo` ni `saldo_pendiente`.

El detalle completo está en `CLAUDE.md` y en `lib/reportes/kpis.ts` (única fuente
de verdad de las KPIs).

## Solución de problemas

### "No se puede conectar a la base de datos"

1. Verifica `DATABASE_URL` / `POSTGRES_URL` (pooler en puerto **6543**, modo
   transacción).
2. Confirma que el proyecto Supabase esté activo.

### "No inicia sesión / no carga el rol"

1. Revisa `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. El rol se carga de forma asíncrona desde `user_roles`; verifica que el usuario
   tenga una fila ahí.

### "No puedo crear usuarios o asignar roles"

Falta `SUPABASE_SERVICE_ROLE_KEY` (o es incorrecta). Revísala en Vercel y haz
**Redeploy**.

### "No se puede cerrar el servicio"

Un servicio no puede pasar a un estado `cerrado` con saldo pendiente > 0. Registra
todos los abonos antes de cerrarlo.

### Tras cambiar variables en Vercel

Haz **Redeploy** para que apliquen.

## Soporte

- Documentación de Supabase: https://supabase.com/docs
- Documentación de Next.js: https://nextjs.org/docs
