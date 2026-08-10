# Camino B — Diseño técnico multi-taller (multi-tenant)

Convertir TallerPro de una app de **un solo taller** a un **SaaS que sirve a
muchos talleres desde un mismo deploy y una misma base de datos**, con cada
taller viendo únicamente sus datos.

> Contexto de negocio, fases, precios y arquitectura de hosting: ver el plan de
> producto (documento visual aparte). Este archivo es el diseño **de ingeniería**.

---

## 1. Principio de seguridad (lo más importante)

En un producto pagado, **que un taller vea datos de otro es el peor fallo
posible**. El aislamiento se diseña con dos ideas:

1. **Barrera principal — la aplicación.** Cada consulta a datos de negocio
   filtra por el `taller_id` de la sesión. Sin excepción.
2. **Red de seguridad — la base de datos.** RLS de Postgres *cuando aplique*
   (ver §7: hoy la conexión con rol privilegiado la ignora, así que la barrera
   real es la #1).

La consecuencia práctica: **un solo `WHERE taller_id` olvidado = fuga de datos.**
Por eso el trabajo grueso es mecánico pero exige rigor y verificación.

---

## 2. Modelo de datos

### Tablas nuevas
| Tabla | Rol |
|---|---|
| `talleres` | Registro de cada taller (tenant): nombre, branding para PDFs, IVA/zona horaria, plan y estado de suscripción. |
| `taller_usuarios` | Mapea `auth.users.id` → `taller_id` + `rol`. Reemplaza/extiende `user_roles`. |

### Columna `taller_id` en cada tabla de negocio
`servicios`, `presupuestos`, `gastos`, `empleados`, `abonos_empleados`,
`estados_servicio`, `precios_pintura`, `piezas_pintura`, `clientes`,
`vehiculos`, `proveedores`, `gastos_fijos_plantillas`, `plantillas_servicio`
(y `solicitudes` si existe).

La DDL aditiva está en **`scripts/16-multi-tenant-esquema.sql`** (idempotente,
NULLABLE + backfill al "taller principal", así la app actual no se rompe
durante la migración).

### Índices y unicidad
- Índices compuestos con `taller_id` **como primera columna** (ya en el script).
- Los `UNIQUE` que hoy son globales pasan a ser **únicos por taller**:
  - `estados_servicio.nombre` → `UNIQUE (taller_id, nombre)`
  - `piezas_pintura` (scripts/05) → incluir `taller_id`
  - `user_roles` → sustituido por `taller_usuarios`

---

## 3. Cómo se resuelve el taller de la sesión

Hoy `lib/auth-server.ts::getSessionUser()` devuelve `{ userId, role }`. Pasa a
devolver `{ userId, tallerId, role }`, leyendo de `taller_usuarios`:

```ts
export async function getSessionUser():
  Promise<{ userId: string; tallerId: string; role: Role | null } | null> {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("taller_usuarios")
    .select("taller_id, rol")
    .eq("user_id", user.id)
    .single()
  if (!data) return null                     // usuario sin taller → sin acceso
  return { userId: user.id, tallerId: data.taller_id, role: data.rol as Role }
}
```

`requireRole()` pasa a devolver también el `tallerId` (o un 403 si el usuario no
tiene taller). Cada route handler obtiene el `tallerId` de ahí y lo baja a las
funciones de `lib/database.ts`. **El cliente nunca envía su `taller_id`** — se
deriva siempre de la sesión en el servidor (igual que hoy no se confía en el
cliente para `anticipo`/`saldo_pendiente`).

---

## 4. Scoping de las consultas (el trabajo grueso)

Cada función de `lib/database.ts` que toca datos de negocio recibe `tallerId` y
lo agrega al `WHERE` / al `INSERT`.

**Antes:**
```ts
export async function getServicios() {
  const sql = getSQL()
  return sql`SELECT * FROM servicios ORDER BY fecha_ingreso DESC`
}
```
**Después:**
```ts
export async function getServicios(tallerId: string) {
  const sql = getSQL()
  return sql`
    SELECT * FROM servicios
    WHERE taller_id = ${tallerId}
    ORDER BY fecha_ingreso DESC`
}
```

Puntos que **no** son un simple `WHERE`:

- **INSERTs**: `createServicio`, `createGasto`, etc. deben setear `taller_id`.
- **Upserts de cliente/vehículo** (`upsertClienteYVehiculo`): la búsqueda por
  patente y el upsert van scopeados por taller (dos talleres pueden tener la
  misma patente).
- **Idempotency guard** de `createServicio` (misma patente+cliente en 30s):
  incluir `taller_id` en la comparación.
- **Numeración de OT** (`numero_ot`): hoy es una **secuencia global**
  (`servicios_numero_ot_seq`). Cada taller quiere su propia numeración desde 1.
  → pasar a un contador por taller (columna `talleres.next_numero_ot` con
  bloqueo, o `MAX(numero_ot)+1` por taller dentro de la transacción de creación).
- **Conversión presupuesto→servicio** (`convertPresupuestoToServicio`): propaga
  el `taller_id` del presupuesto al servicio, dentro de la misma transacción.
- **`getById`** (servicio/gasto/presupuesto): además del `id`, exigir
  `taller_id` para que un taller no pueda leer un registro de otro por UUID.

### Helper para no olvidar el filtro
Para reducir el riesgo de un scope olvidado, envolver la conexión:

```ts
// lib/database.ts
export function forTaller(tallerId: string) {
  // devuelve un objeto con las funciones ya "curried" con el tallerId,
  // de modo que las rutas no puedan llamar una query sin taller.
}
```
Aunque el helper ayude, la verificación manual (§8) sigue siendo obligatoria.

---

## 5. Cachés y estado de proceso

Hay estado en variables globales del proceso que **hoy es compartido** y se
cruzaría entre talleres:

| Dónde | Hoy | Cambio |
|---|---|---|
| `lib/dashboard-cache.ts` (`global._dashboardCache`) | `Map` global; `invalidate` hace `.clear()` de todo | Clave por `taller_id` (`${tallerId}:${mes}`); invalidar solo el taller que mutó |
| Caché de `estados_servicio` (30s, en `database.ts`) | Un set global de estados | Cachear por `taller_id` |
| Idempotency guard de `createServicio` | patente+cliente+30s | Incluir `taller_id` |
| `chartDataInFlight` / dedupe (`api-client.ts`) | Clave por mes | Clave por `taller_id`+mes |

---

## 6. Configuración y branding por taller

Lo que hoy es global o está hardcodeado pasa a vivir por taller:

- **Config de negocio**: `estados_servicio`, `precios_pintura`,
  `plantillas_servicio`, `gastos_fijos_plantillas`, `proveedores` → filtradas
  por `taller_id`. Al crear un taller nuevo se **siembran valores por defecto**
  (estados base, precios en 0, etc.).
- **PDFs** (`lib/pdf-orden-trabajo.ts`, `pdf-presupuesto.ts`, `pdf-recibo.ts`):
  nombre, logo, RUT, dirección y teléfono salen de la fila `talleres`, no de
  constantes.
- **IVA 19% y timezone** (`getSQL`): hoy fijos para Chile. Quedan como columnas
  en `talleres` (`iva_porcentaje`, `timezone`) para el día que se venda fuera de
  Chile. **No es urgente**: mientras el mercado sea Chile, el default sirve.

---

## 7. RLS: por qué no es la barrera principal (honestidad técnica)

La app usa `postgres.js` conectado con un **rol privilegiado** vía el pooler.
Ese rol **hace bypass de RLS**, así que una política basada en `auth.uid()`
**no protegería nada** tal como está montado hoy.

**Decisión:** la barrera real es el **scoping en la aplicación** (§4), aplicado
con rigor y auditado (§8). RLS queda como mejora opcional posterior, y solo
sirve si se conecta con un rol que respete RLS y se hace
`SET LOCAL app.current_taller = '<uuid>'` al inicio de cada transacción (ver
PASO 3 del script). No te confíes en RLS mientras la conexión sea la actual.

---

## 8. Cómo verificar el aislamiento (no hay suite de tests)

El repo no tiene tests automatizados, así que la verificación es deliberada:

1. **Prueba de dos talleres**: crear Taller A y Taller B con datos distintos.
   Recorrer *cada pantalla* logueado como A y confirmar que **nunca** aparece
   nada de B (servicios, dashboard, reportes, clientes, PDFs, búsqueda por
   patente, historial).
2. **Prueba por UUID**: intentar abrir un `servicio`/`gasto` de B usando su id
   estando logueado como A → debe dar 404, no el registro.
3. **Auditoría de código**: revisar que **ninguna** query en `lib/database.ts`
   que lea/escriba datos de negocio quede sin `taller_id`. Un grep de apoyo:
   ```bash
   grep -nE "FROM (servicios|presupuestos|gastos|clientes|vehiculos|empleados)" lib/database.ts
   ```
   y verificar que cada una tenga su `WHERE taller_id`.
4. **`tsc --noEmit`**: hacer que las funciones exijan `tallerId` como parámetro
   obligatorio hace que el compilador marque cualquier llamada que lo olvide.

---

## 9. Migración de datos existentes

1. Correr **PASO 1** del script (crea tablas, agrega `taller_id` nullable,
   siembra "Taller principal", backfillea todas las filas y migra `user_roles`).
2. Desplegar la app ya scopeada (leyendo `tallerId` de la sesión y filtrando).
3. Correr **PASO 2** (NOT NULL + FK + UNIQUE por taller), tabla por tabla.

Tu taller actual sigue funcionando igual en todo momento: es el "Taller
principal" y conserva todos sus datos.

---

## 10. Orden de implementación (sub-fases)

| Sub-fase | Qué | Riesgo |
|---|---|---|
| **3a** | Esquema aditivo — `scripts/16` PASO 1 | Bajo (no rompe nada) |
| **3b** | `auth-server.ts`: resolver `tallerId` en sesión; `requireRole` lo devuelve | Bajo |
| **3c** | Scopear todas las consultas de `lib/database.ts` + rutas (por módulo: servicios → presupuestos → gastos → empleados → clientes/vehículos → config) | **Alto** — el grueso |
| **3d** | Cachés e idempotencia por taller | Medio |
| **3e** | Config + branding por taller (siembra al alta; PDFs desde `talleres`) | Medio |
| **3f** | Alta de taller (onboarding) + siembra de defaults | Medio |
| **3g** | Suscripciones + cobro (Flow/Mercado Pago/Transbank) + bloqueo si vencida | Medio |
| **3h** | Endurecer BD — `scripts/16` PASO 2 (NOT NULL/FK/UNIQUE) | Medio |
| **3i** | Verificación de aislamiento (§8) | — |

Recomendado abordar **3c por módulos**, cada uno con su verificación, en vez de
un solo cambio gigante.

---

## 11. Fuera de alcance por ahora
- RLS real (requiere cambiar el rol de conexión — §7).
- Multi-país / multi-moneda (el default Chile alcanza).
- Un usuario administrando varios talleres (hoy: un usuario = un taller).
- Subdominios por taller (el `slug` ya queda reservado para cuando se quiera).
