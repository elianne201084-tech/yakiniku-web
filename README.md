# Chasqui Market

Marketplace en línea para Ecuador, en español y pensado para celular. Vende productos de varios
proveedores (sin bodega propia), con **pago contra entrega** y seguimiento del pedido por WhatsApp.

> Nombre provisional. «Chasqui» era el mensajero del imperio inca: el que llevaba lo importante de
> un lugar a otro. Antes de usarlo como marca verifica su disponibilidad en el IEPI y el dominio
> (`chasqui.ec`, `chasquimarket.ec`…). Cambiarlo es sencillo: se edita en el panel (Configuración) y
> en `src/components/header.tsx`.

**Estado: etapa 1 de 6** (catálogo y pedido contra entrega, con panel mínimo). Ver [plan](docs/propuesta-arquitectura.md).

## Qué incluye la etapa 1

- Árbol de categorías (24 categorías y sus subcategorías; el tercer nivel se crea desde el panel).
- Buscador con sugerencias, tolerante a errores de escritura y a tildes; filtros por precio, talla,
  color, marca, valoración y plazo de entrega; orden y paginación. Medido con 30 000 productos en un equipo local: listados y búsquedas responden en menos de 0,3 s.
- Ficha de producto con variantes, stock, plazo de entrega, guía de tallas y botón de WhatsApp.
- Carrito y lista de deseos (en el navegador), compra sin registro (cédula validada), envío por
  provincia y total final visible antes de confirmar.
- Pedido dividido por proveedor, descuento de stock sin sobreventa, seguimiento por número + últimos
  4 dígitos del celular.
- WhatsApp automático: aviso de pedido recibido (el cliente responde «SI» para confirmar) y un
  mensaje en cada cambio de estado, con reintentos. Ver [docs/whatsapp.md](docs/whatsapp.md).
- Productos regulados: no se publican sin documento de respaldo aprobado y vigente; un proceso diario
  despublica los vencidos.
- Declaración de marca (original o genérico) obligatoria; marcas bloqueables.
- Panel: resumen, pedidos, productos (variantes, imágenes, documentos), categorías, configuración.
- Píxeles de Meta y TikTok configurables, solo con consentimiento. Seguridad: contraseñas argon2id,
  bloqueo por intentos, límite de intentos en base de datos, validación con zod, cabeceras HTTP.

## Cómo ejecutarlo en tu computador

Necesitas Node 22+ y PostgreSQL 15+.

```bash
cp .env.example .env          # y completa los valores
npm install
npx prisma migrate deploy     # crea las tablas
npm run db:seed               # categorías, provincias, tarifas de muestra, 300 productos ficticios y el admin
npm run dev                   # http://localhost:3000   ·   panel: /admin
```

Usuario inicial del panel: el de `ADMIN_EMAIL` / `ADMIN_PASSWORD` de tu `.env`. **Cámbialo antes de publicar.**

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas (reglas de negocio y base de datos; requieren la base con el seed) |
| `npm run lint` | Revisión de tipos |
| `npm run db:seed:load -- 30000` | Agrega 30 000 productos ficticios para pruebas de carga |
| `npm run build && npm start` + `node e2e/purchase.mjs` | Prueba completa de compra en un navegador con tamaño de celular |

## Publicarlo (no tienes cuentas todavía)

Necesitas crear tres cosas; yo no puedo hacerlo por ti porque requieren tus datos y tu tarjeta/verificación:

1. **Base de datos PostgreSQL**: crea una cuenta en [Neon](https://neon.tech) (o Supabase), un proyecto en la
   región más cercana a São Paulo, y copia la cadena de conexión.
   Respaldos con restauración a un punto en el tiempo: revisa que tu plan lo incluya.
2. **Vercel**: cuenta en [vercel.com](https://vercel.com), «Add New → Project», importa este repositorio de GitHub.
   Región de funciones: São Paulo (`gru1`). Variables de entorno: las de `.env.example`
   (`DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SITE_URL`, `WHATSAPP_*`).
   El build ejecuta las migraciones solo (`vercel-build`). Luego ejecuta el seed una vez desde tu computador
   apuntando a la base de producción (`DATABASE_URL=… npm run db:seed`) o crea el administrador a mano.
3. **Dominio**: cómpralo en un registrador (los `.ec` se gestionan con registradores acreditados) y agrégalo en
   Vercel → Settings → Domains. HTTPS se activa solo.

Tareas programadas (`vercel.json`): `compliance` (diaria) despublica productos con documento vencido;
`outbox` reintenta mensajes de WhatsApp. En el plan gratuito de Vercel solo se permiten tareas diarias; para
reintentos cada 5 minutos usa el plan Pro o un servicio externo (por ejemplo cron-job.org) que llame a
`/api/cron/outbox` con la cabecera `Authorization: Bearer <CRON_SECRET>`.

## Antes de vender (pendientes que dependen de ti)

- [ ] Completar en el panel → Configuración: razón social, RUC, dirección, teléfono, WhatsApp, textos legales
      (hoy dicen `[POR COMPLETAR]`). **Revisión de un abogado**: privacidad (LOPDP), garantía, devoluciones, términos.
- [ ] Tarifas de envío: las del seed son **de muestra**. Reemplázalas por las de tus empresas de courier.
- [ ] Confirmar con tu contador la tarifa de IVA (configurable) y la facturación electrónica (etapa 6).
- [ ] Cuenta de WhatsApp Business verificada y plantillas aprobadas por Meta ([guía](docs/whatsapp.md)).
- [ ] Contrato con cada proveedor: declaración de marcas originales, comunicación de datos del cliente, garantía.
- [ ] Verificar qué categorías necesitan documento de respaldo (ARCSA, INEN, ARCOTEL…); cada una se marca como regulada en el panel.
- [ ] Las valoraciones que se ven en el catálogo de ejemplo son ficticias (las reseñas reales llegan en la etapa 4).

## Estructura

```
prisma/            esquema, migraciones, datos de ejemplo (seed)
src/app/(tienda)/  tienda: inicio, categorías, producto, carrito, checkout, seguimiento, políticas
src/app/admin/     panel (login, resumen, pedidos, productos, categorías, configuración)
src/app/api/       webhook de WhatsApp, tareas programadas, sugerencias de búsqueda
src/modules/       reglas de negocio: catalog, orders, products, compliance, notifications
src/lib/           base de datos, sesiones, validaciones, precios, WhatsApp, configuración
tests/  e2e/       pruebas
```

## Decisiones técnicas que se apartan de la propuesta inicial

- Sesiones del panel con `jose` + cookie firmada (en vez de Auth.js): menos dependencias para un solo tipo de login.
- Carrito y lista de deseos en el navegador (sin tablas): no guardamos datos personales de quien solo mira.
- Límite de intentos en PostgreSQL (en vez de Redis): funciona en Vercel sin un servicio extra.
- Los totales, precios y stock **siempre** se recalculan en el servidor; el navegador nunca los decide.
