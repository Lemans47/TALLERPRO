# Configuración de la Aplicación de Gestión del Taller

Esta aplicación requiere una base de datos PostgreSQL/Supabase configurada correctamente.

## Requisitos Previos

- Cuenta de Supabase activa
- Variables de entorno configuradas en Vercel

## Variables de Entorno Requeridas

Las siguientes variables de entorno deben estar configuradas en la sección "Vars" de v0 o en tu proyecto de Vercel:

\`\`\`
SUPABASE_NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_publica_aqui
\`\`\`

**Nota:** Reemplaza los valores de ejemplo con tus credenciales reales de Supabase.

## Configuración de la Base de Datos

### Paso 1: Ejecutar el Script SQL

1. Ve a tu proyecto de Supabase
2. Navega a la sección "SQL Editor"
3. Copia y pega el contenido del archivo `scripts/01-create-tables.sql`
4. Ejecuta el script

Este script creará:
- Tabla `servicios` con todos los campos necesarios
- Tabla `gastos` con categorías
- Triggers para cálculos automáticos (IVA, saldo pendiente, margen de rentabilidad)
- Validaciones (patente única en proceso, cierre solo con saldo $0)
- Índices para optimización
- Políticas RLS (Row Level Security)

### Paso 2: Verificar las Tablas

Después de ejecutar el script, verifica que las tablas se hayan creado correctamente:

\`\`\`sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
\`\`\`

Deberías ver:
- `servicios`
- `gastos`

### Paso 3: Verificar RLS

Verifica que Row Level Security esté habilitado:

\`\`\`sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
\`\`\`

Ambas tablas deberían tener `rowsecurity = true`.

## Características de la Base de Datos

### Tabla Servicios

- **Cálculos Automáticos**: IVA (19%), total con IVA, saldo pendiente, costo total, margen de rentabilidad
- **Validaciones**: 
  - Patente única para servicios en proceso (no cerrados)
  - No se puede cerrar un servicio con saldo pendiente
- **Estados**: En Cola, En Reparación, Control de Calidad, Entregado, Cerrado/Pagado

### Tabla Gastos

- **Categorías**: Materiales, Salarios, Servicios Básicos, Mantenimiento, Transporte, Arriendo, Seguros, Impuestos, Marketing, Otros
- **Formato**: Montos en CLP (pesos chilenos) sin decimales

## Uso de la Aplicación

### Módulo de Servicios

1. **Crear Servicio**: Completa el formulario con información del vehículo, cliente y montos
2. **Gestionar Estados**: Cambia el estado del servicio según el flujo de trabajo
3. **Registrar Pagos**: Usa el botón de pago para registrar abonos
4. **Cerrar Servicio**: Solo se puede cerrar cuando el saldo pendiente es $0

### Módulo de Gastos

1. **Registrar Gasto**: Selecciona categoría, descripción y monto
2. **Filtrar por Categoría**: Usa el selector para ver gastos por categoría
3. **Ver Resumen**: El resumen muestra el total gastado por categoría

### Dashboard

El dashboard muestra KPIs financieros en tiempo real:
- **Utilidad Operacional**: Ingresos sin IVA - Gastos totales
- **Margen de Utilidad Promedio**: Promedio de rentabilidad de todos los servicios
- **Total Por Cobrar**: Suma de saldos pendientes
- **Servicios Activos**: Servicios que no están cerrados

## Solución de Problemas

### Error: "No se puede conectar a Supabase"

1. Verifica que las variables de entorno estén configuradas correctamente
2. Asegúrate de que la URL y la clave anónima sean correctas
3. Verifica que el proyecto de Supabase esté activo

### Error: "No se pueden insertar datos"

1. Verifica que las políticas RLS estén configuradas correctamente
2. Asegúrate de que el usuario esté autenticado (si es necesario)
3. Revisa los logs de Supabase para más detalles

### Error: "No se puede cerrar el servicio"

Este error ocurre cuando intentas cerrar un servicio con saldo pendiente. Registra todos los pagos antes de cerrar el servicio.

## Soporte

Para más información sobre Supabase, visita: https://supabase.com/docs
