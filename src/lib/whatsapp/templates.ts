/**
 * Plantillas de WhatsApp. Los mensajes que inicia el negocio fuera de la ventana de 24 h
 * deben ser plantillas aprobadas por Meta (categoría "Utilidad"). El `name` debe coincidir
 * con el de la plantilla creada en el Administrador de WhatsApp; las variables son {{1}}, {{2}}...
 * El cuerpo de abajo es el texto que hay que registrar en Meta (ver docs/whatsapp.md).
 */
export const TEMPLATES = {
  pedido_recibido:
    "Hola {{1}}, recibimos tu pedido {{2}} por {{3}} (pago contra entrega). Para confirmarlo responde *SI*. Sigue tu pedido aquí: {{4}}",
  pedido_confirmado:
    "¡Listo {{1}}! Confirmamos tu pedido {{2}} y ya lo estamos preparando. Sigue tu pedido aquí: {{3}}",
  pedido_enviado_proveedor:
    "{{1}}, tu pedido {{2}} ya está en preparación con nuestro proveedor. Te avisamos apenas salga en camino. Seguimiento: {{3}}",
  pedido_despachado:
    "{{1}}, tu pedido {{2}} salió en camino con {{3}}. Guía: {{4}}. Seguimiento: {{5}}",
  pedido_entregado:
    "{{1}}, entregamos tu pedido {{2}}. ¡Gracias por comprar con nosotros! Si algo no está bien, responde este mensaje.",
  pedido_cancelado:
    "{{1}}, tu pedido {{2}} fue cancelado. Si tienes dudas o no lo solicitaste, responde este mensaje.",
  pedido_devuelto:
    "{{1}}, registramos la devolución de tu pedido {{2}}. Te contactaremos para coordinar el reembolso o cambio.",
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function renderTemplate(name: TemplateName, vars: string[]): string {
  return TEMPLATES[name].replace(/\{\{(\d+)\}\}/g, (_, i) => vars[Number(i) - 1] ?? "");
}
