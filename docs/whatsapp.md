# WhatsApp: confirmación automática y seguimiento

El sistema envía WhatsApp automáticos al cliente: al recibir el pedido, y en cada cambio de estado
(confirmado, en preparación, despachado con guía, entregado, cancelado, devuelto). Si el cliente responde
**«SI»** al primer mensaje, el pedido pasa solo a *Confirmado*.

Mientras `WHATSAPP_PROVIDER=console` los mensajes solo se registran en el log del servidor (desarrollo).

## Qué necesitas de tu lado (no se puede automatizar)

1. Una cuenta en [Meta Business](https://business.facebook.com) con la **empresa verificada**.
2. Una app de Meta con el producto **WhatsApp** y un número de teléfono propio para el negocio
   (no puede estar en uso en la app de WhatsApp normal).
3. Las 7 plantillas de abajo, categoría **Utilidad**, idioma **Español** (`es`), aprobadas por Meta.
   Los mensajes que inicia el negocio fuera de la ventana de 24 h solo pueden ser plantillas aprobadas.
4. Los costos de conversación de Meta (revisa la tarifa vigente para Ecuador en su sitio).

## Variables de entorno

| Variable | Valor |
|---|---|
| `WHATSAPP_PROVIDER` | `cloud` |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número (panel de Meta → WhatsApp → API) |
| `WHATSAPP_ACCESS_TOKEN` | Token permanente de un usuario del sistema |
| `WHATSAPP_APP_SECRET` | «Secreto de la app» (firma de los webhooks) |
| `WHATSAPP_VERIFY_TOKEN` | Texto que tú inventas; lo repites al registrar el webhook |

## Webhook (para recibir el «SI»)

En Meta → WhatsApp → Configuración → Webhook: URL `https://TU-DOMINIO/api/webhooks/whatsapp`, token de
verificación = `WHATSAPP_VERIFY_TOKEN`, y suscríbete al campo `messages`. El servidor **rechaza** cualquier
llamada sin firma válida.

## Plantillas a registrar (nombre exacto → texto)

Las variables `{{1}}`, `{{2}}`… van en el orden mostrado. Fuente: `src/lib/whatsapp/templates.ts`.

| Nombre | Texto |
|---|---|
| `pedido_recibido` | Hola {{1}}, recibimos tu pedido {{2}} por {{3}} (pago contra entrega). Para confirmarlo responde *SI*. Sigue tu pedido aquí: {{4}} |
| `pedido_confirmado` | ¡Listo {{1}}! Confirmamos tu pedido {{2}} y ya lo estamos preparando. Sigue tu pedido aquí: {{3}} |
| `pedido_enviado_proveedor` | {{1}}, tu pedido {{2}} ya está en preparación con nuestro proveedor. Te avisamos apenas salga en camino. Seguimiento: {{3}} |
| `pedido_despachado` | {{1}}, tu pedido {{2}} salió en camino con {{3}}. Guía: {{4}}. Seguimiento: {{5}} |
| `pedido_entregado` | {{1}}, entregamos tu pedido {{2}}. ¡Gracias por comprar con nosotros! Si algo no está bien, responde este mensaje. |
| `pedido_cancelado` | {{1}}, tu pedido {{2}} fue cancelado. Si tienes dudas o no lo solicitaste, responde este mensaje. |
| `pedido_devuelto` | {{1}}, registramos la devolución de tu pedido {{2}}. Te contactaremos para coordinar el reembolso o cambio. |

## Si un mensaje falla

Queda en cola con reintentos cada vez más espaciados (hasta 5). En el panel, en el detalle del pedido, ves el
estado de cada mensaje, el motivo del error y un botón **Reintentar envío**. El pedido nunca se pierde por un
fallo de WhatsApp.

## Pendiente (etapas siguientes)

Aviso al cliente de retrasos y recordatorios programados («tu pedido llega mañana»); respuestas a otros mensajes
del cliente; envío de la orden al proveedor por WhatsApp (etapa 3).
