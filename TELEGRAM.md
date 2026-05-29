# Bots de Telegram - TallerPro

Referencia de configuración de los bots de Telegram del taller.

## Dominio de producción

```
https://tallerprosarmientoautomotriz.vercel.app
```

> Si cambiás el dominio en Vercel, hay que volver a registrar el webhook de **cada** bot (ver "Registrar / actualizar webhook").

## Bots

| Bot | Ruta (webhook) | Variable del token | Para qué sirve |
|-----|----------------|--------------------|----------------|
| **Gastos** | `/api/telegram` | `TELEGRAM_BOT_TOKEN` | Cargar gastos: enviar `monto descripción` y elegir categoría |
| **Cobranzas** | `/api/telegram-cobranzas` | `TELEGRAM_COBRANZAS_BOT_TOKEN` | Consultar cuentas por cobrar con `/saldos` |

## Variables de entorno (Vercel → Settings → Environment Variables)

- `TELEGRAM_BOT_TOKEN` — token del bot de gastos (de @BotFather).
- `TELEGRAM_COBRANZAS_BOT_TOKEN` — token del bot de cobranzas (de @BotFather).
- `TELEGRAM_ALLOWED_CHAT_IDS` — IDs de chat autorizados, separados por coma. Aplica a ambos bots.
- `TELEGRAM_COBRANZAS_ALLOWED_CHAT_IDS` *(opcional)* — IDs autorizados solo para el bot de cobranzas. Si no se define, usa `TELEGRAM_ALLOWED_CHAT_IDS`.
- `CRON_SECRET` — cadena aleatoria larga para proteger el reporte diario (ver más abajo). Vercel la envía como `Authorization: Bearer <CRON_SECRET>` al llamar el cron.

> Para obtener tu chat ID, escribile a **@userinfobot** en Telegram.
> Tras cambiar variables en Vercel, hacé **Redeploy** para que apliquen.

## Reporte diario automático de cobranzas

Un cron de Vercel (`vercel.json`) llama a `/api/cron/cobranzas` y envía el informe
de cuentas por cobrar (el mismo de `/saldos`) a todos los chats autorizados.

- **Horario:** `0 23 * * *` → 23:00 UTC. En Chile equivale a las **19hs** en
  horario estándar (otoño/invierno) y a las **20hs** en horario de verano, porque
  Vercel ejecuta los crons en hora UTC fija. Para cambiar el horario, editá el
  campo `schedule` en `vercel.json`.
- **Seguridad:** definí `CRON_SECRET` en Vercel. Si falta, el endpoint queda
  abierto (cualquiera podría disparar el envío llamando la URL).
- **Solo producción:** los crons de Vercel corren únicamente en deployments de
  producción, no en previews. En el plan gratuito se permite 1 ejecución diaria.
- **Probar a mano:** Vercel → pestaña **Cron Jobs** → botón **Run** del job
  `/api/cron/cobranzas`. (O un `GET` al endpoint con el header
  `Authorization: Bearer <CRON_SECRET>`.)

## Registrar / actualizar webhook

Pegar en el navegador, reemplazando `TOKEN` por el token del bot correspondiente.

Bot de gastos:
```
https://api.telegram.org/botTOKEN/setWebhook?url=https://tallerprosarmientoautomotriz.vercel.app/api/telegram
```

Bot de cobranzas:
```
https://api.telegram.org/botTOKEN/setWebhook?url=https://tallerprosarmientoautomotriz.vercel.app/api/telegram-cobranzas
```

Respuesta esperada: `{"ok":true,"result":true,"description":"Webhook was set"}`

## Verificar webhook

```
https://api.telegram.org/botTOKEN/getWebhookInfo
```

Revisar que `url` apunte a la ruta correcta y que `last_error_message` esté vacío.

## Comandos

**Bot de gastos**
- Enviar `3500 combustible` (o `combustible 3500`) → elegir categoría con los botones.
- `/start` o `/ayuda` → instrucciones.

**Bot de cobranzas**
- `/saldos` (o `/cobranzas`, `/cobrar`) → lista de cuentas por cobrar: cliente, patente, monto pendiente, estado y días de antigüedad, más el total.
- `/start` o `/ayuda` → instrucciones.

## Seguridad

- **Nunca** pegar los tokens en chats, código o commits. Solo viven en las variables de entorno de Vercel.
- Si un token se expone, revocarlo en @BotFather (`/mybots` → bot → API Token → Revoke), actualizar la variable en Vercel, redeploy y volver a correr el `setWebhook`.
