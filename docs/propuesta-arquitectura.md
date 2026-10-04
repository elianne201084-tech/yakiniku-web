# Marketplace Ecuador: propuesta de arquitectura, modelo de datos y plan

Estado: **borrador para aprobación. No se ha escrito código.**
Convención: ✅ = verificado en fuente pública (enlaces al final) · ⚠️ = lo recomiendo, pero debe validarlo un abogado o contador ecuatoriano.

---

## Decisiones confirmadas por el cliente

1. **Garantía:** la empresa responde por ella, apoyándose en la garantía del sitio de origen del producto. (Ojo legal: ante el consumidor ecuatoriano responde igualmente el vendedor local; la garantía del origen no lo reemplaza. Redactar la política con un abogado.)
2. **Proveedores:** nacionales e internacionales (el modelo ya distingue origen, país y plazos de importación).
3. **Facturación electrónica del SRI:** etapa 6.
4. **WhatsApp:** confirmación automática y seguimiento continuo (implementado en la etapa 1; requiere cuenta de WhatsApp Business verificada).
5. **Cobro:** contra entrega con empresas de courier; además transferencia, depósito y tarjeta de crédito (etapa 5).
6. **Panel mínimo en la etapa 1** y marca «regulado» configurable por categoría: aceptado.
7. **Infraestructura:** se crea desde cero (Neon/Supabase, Vercel y dominio): ver README.
8. **Nombre:** Chasqui Market (provisional; verificar marca y dominio).

---

## 1. Resumen de decisiones técnicas

| Tema | Decisión | Por qué |
|---|---|---|
| App | Next.js (App Router) monolito modular, TypeScript | Una sola base de código para tienda, panel admin y portal proveedor; despliegue directo en Vercel |
| BD | PostgreSQL gestionado (Neon o Supabase) + Prisma | Respaldos con restauración a un punto en el tiempo; extensiones `pg_trgm` y `unaccent` para búsqueda |
| Región | Vercel `gru1` (São Paulo) y BD en la región más cercana | Es la más próxima a Ecuador; menos latencia en celular |
| Búsqueda | Postgres: full-text + `pg_trgm` (tolera errores de escritura) | Suficiente para decenas de miles de productos sin otro servicio. Si crece, se migra a Typesense/Meilisearch detrás de la misma interfaz |
| Imágenes | Almacenamiento de objetos (Vercel Blob o Cloudinary) + `next/image` (AVIF/WebP, `loading=lazy`, placeholder borroso) | Peso mínimo en datos móviles |
| Sesiones/Auth | Auth.js, contraseñas con argon2id, roles ADMIN/OPERADOR/PROVEEDOR/CLIENTE | |
| Seguridad | Zod en cada entrada, origen verificado en Server Actions (anti-CSRF), límite de intentos con Upstash Redis (en serverless no sirve memoria local), cabeceras CSP/HSTS, auditoría de cambios | |
| Tareas programadas | Vercel Cron + cola (Upstash QStash o Inngest) | Alertas de vencimiento de documentos, órdenes a proveedores, reintentos |
| Correo | Resend o similar | Órdenes a proveedor y confirmaciones |
| WhatsApp | Fase 1: enlaces `wa.me` con mensaje prellenado. Fase 2: WhatsApp Business Cloud API (plantillas aprobadas por Meta, con costo por conversación) | La API exige verificación de negocio en Meta; no conviene que bloquee el lanzamiento |
| Pagos | Interfaz `PaymentProvider` con adaptadores. Contra entrega y transferencia primero; pasarela en la etapa 5 | Nunca pasa un dato de tarjeta por nuestro servidor: se usa la página/campos alojados de la pasarela |
| Dinero | USD, enteros en centavos, IVA como porcentaje configurable | Evita errores de redondeo y cambios de tarifa |
| Idioma | Solo es-EC | |
| Móvil | Diseño mobile-first con Tailwind, botón de compra fijo, mínimo JS en listados, páginas cacheadas con ISR y revalidación por etiquetas | |

### Estructura de la app

```
app/
  (tienda)/        inicio, categorías, producto, carrito, checkout, seguimiento, cuenta
  admin/           categorías, productos, pedidos, proveedores, promociones, reportes, usuarios
  proveedor/       solo sus productos y sub-pedidos (misma app, otro layout)
  api/webhooks/    pasarela de pago, WhatsApp
src/
  modules/         catalog, orders, suppliers, promotions, payments, shipping, compliance
  lib/             db, auth, validation, rate-limit, storage, notifications
prisma/            schema.prisma, migrations, seed
```

Regla clave: **todo acceso a datos pasa por una capa de servicio que recibe el usuario y aplica el alcance**. Un usuario PROVEEDOR siempre filtra por su `supplierId`; no se confía en la interfaz. Opcionalmente se refuerza con Row Level Security de Postgres.

---

## 2. Modelo de datos (resumen)

```
Category        id, parentId, level(1-3), path, slug, name, position, isVisible,
                isRegulated, requiredDocTypes[], sizeGuideId
AttributeDef    id, key, name, type(texto|número|lista|color), unit, isVariant, isFilterable
CategoryAttr    categoryId, attributeId, required, position   (se hereda hacia abajo en el árbol)
SizeGuide       id, name, tabla de medidas (json)
Brand           id, name

Supplier        id, legalName, ruc, email, whatsapp, province, defaultLeadDays, status
SupplierDoc     supplierId, type, fileUrl, expiresAt

Product         id, supplierId, categoryId, brandId, title, slug, description, status
                (borrador|en revisión|publicado|suspendido), brandDeclaration
                (ORIGINAL_AUTORIZADO|GENERICO_SIN_MARCA), declaredAt, declaredBy,
                leadDaysMin/Max, attributes(jsonb), weightGrams, ratingAvg, soldCount,
                searchVector, ivaRate
Variant         id, productId, sku, supplierSku, options(jsonb: talla, color…),
                costCents, priceCents, compareAtCents, stock, weightGrams
ProductImage    productId, url, position, alt
ComplianceDoc   productId, type(reg. sanitario|notif. sanitaria|INEN|ARCOTEL|otro),
                number, issuer, issuedAt, expiresAt, fileUrl, reviewStatus

Order           id, number, channel(web|whatsapp|facebook|instagram|tiktok), utm(json),
                status, customerName, idNumber(cédula), phone, province, city, address,
                reference, subtotal, discount, shipping, tax, total, paymentMethod,
                trackingToken, privacyConsentAt, userId?
SubOrder        id, orderId, supplierId, status, shippingCents, carrier, trackingCode,
                supplierNotifiedAt, dispatchedAt, deliveredAt
OrderItem       subOrderId, variantId, titleSnapshot, qty, unitPrice, unitCost  (cost congelado para margen real)
Payment         orderId, method(COD|TRANSFER|CARD), status, gatewayRef, amount
CodSettlement   subOrderId, collectedAmount, collectedAt, remittedAt, difference  (conciliación del contra entrega)
Return          subOrderId, reason, status, refundCents

ShippingRate    zone/province, weightBand, priceCents, etaDays, (supplier opcional)
Province, City  catálogo de las 24 provincias y cantones

Cart, CartItem, Wishlist
Coupon          code, type, value, minTotal, validFrom/To, usageLimit
Promotion       type(descuento por categoría|relámpago), startsAt, endsAt, items
Review          productId, orderItemId(compra verificada), rating, text, photos, moderation
Question/Answer productId, text, answeredBy, moderation

User            email, passwordHash, role, supplierId?, failedAttempts, lockedUntil
ConsentRecord   subject, purpose, textVersion, grantedAt, ip
AuditLog        userId, entity, action, diff, at
Setting         clave/valor (píxeles, datos de empresa, pasarela cifrada, políticas)
```

Reglas que el modelo hace cumplir:

- **Publicación bloqueada** si la categoría o subcategoría es regulada y no hay `ComplianceDoc` vigente, o si falta `brandDeclaration`. Se valida en la capa de servicio y con un chequeo en BD.
- **Vencimiento**: tarea diaria que avisa a 60, 30 y 7 días y despublica automáticamente al vencer.
- **Sub-pedidos**: al confirmar, el `Order` se divide por `supplierId`. El cliente ve un solo pedido y un solo total.
- **Margen real** por línea: usa el costo congelado en `OrderItem`, no el costo actual.
- **Árbol**: `path` materializado para consultar subárboles rápido. La carga inicial cubre los niveles 1 y 2; el nivel 3 ("tipo") queda vacío para que lo llenes desde el panel.

---

## 3. Plan por etapas

Cada etapa termina con algo desplegado y que puedes probar.

**Etapa 1: catálogo y pedido contra entrega** (incluye un panel mínimo, ver nota)
- Proyecto, CI, esquema, semillas: las 24 categorías y unos 300 productos ficticios; script que genera 30 000 para pruebas de carga.
- Inicio, árbol de categorías, buscador con sugerencias y tolerancia a errores, filtros y orden, ficha de producto, variantes, carrito, lista de deseos.
- Checkout sin registro (validación de cédula con módulo 10), envío por provincia, total visible antes de confirmar, seguimiento por número, botón de WhatsApp, políticas y aviso de privacidad con consentimiento.
- Píxeles Meta y TikTok condicionados al consentimiento.
- Panel mínimo: login, lista de pedidos con cambio de estado y CRUD básico de categorías y productos.

**Etapa 2: panel de administración completo**
Categorías (crear, ordenar, ocultar), atributos, guías de tallas, productos con importación CSV/Excel y edición masiva de precios, documentos regulados con alertas de vencimiento, usuarios y roles, reportes básicos.

**Etapa 3: proveedores y sub-pedidos**
Fichas, documentos, desempeño, portal del proveedor con acceso restringido, división en sub-pedidos, orden al proveedor por correo y WhatsApp, conciliación del contra entrega, devoluciones.

**Etapa 4: promociones y reseñas**
Cupones, descuentos por categoría, ofertas relámpago con contador, reseñas con fotos (solo compra verificada, con moderación), preguntas y respuestas, reportes de margen y tasa de entrega.

**Etapa 5: pagos en línea**
Transferencia con comprobante y conciliación; adaptador de la pasarela elegida con webhook firmado, idempotencia y estados.

Cada etapa incluye pruebas unitarias de las reglas de negocio (precios, cupones, publicación regulada, división de pedidos), pruebas e2e del flujo de compra y documentación.

> **Nota sobre tu orden de etapas.** En tu plan, la etapa 1 recibe pedidos pero el panel llega en la 2. Sin panel no podrías ver ni gestionar un solo pedido, ni subir productos reales. Por eso propongo meter el panel mínimo en la etapa 1.

---

## 4. Lo que no mencionaste (legal y técnico)

**Datos personales (LOPDP).** La ley vigente exige consentimiento, aviso de privacidad, derechos de acceso/rectificación/eliminación, medidas de seguridad y notificar las vulneraciones de seguridad a la Superintendencia de Protección de Datos Personales ✅. No pude verificar el plazo exacto de notificación ni si estás obligado a designar un delegado de protección de datos ⚠️. Además, enviar nombre, cédula, teléfono y dirección a cada proveedor es una **comunicación de datos a terceros**: necesitas contrato o cláusula con cada proveedor y decirlo en el aviso de privacidad. Alojar en Vercel/Neon implica **transferencia internacional** de datos ⚠️.

**Píxeles y cookies.** Meta y TikTok son rastreo. Los activaremos solo tras consentimiento. Recomiendo además enviar eventos desde el servidor (Conversions API), porque el píxel de navegador pierde mucha señal.

**Facturación electrónica del SRI.** Como tú vendes al cliente final, eres tú quien factura, no el proveedor ⚠️. La factura a consumidor final solo vale hasta USD 50; sobre ese monto exige datos del comprador ✅, y esa es la razón de pedir la cédula. Desde enero de 2026 los comprobantes se transmiten en tiempo real ✅. Esto **no está en tu lista de requisitos** y es un trabajo importante (certificado de firma, integración directa con el SRI o con un proveedor de facturación). Propongo dejarlo como etapa 6 o integrarlo con un proveedor externo. Necesito tu decisión.

**Devoluciones.** El artículo 45 de la Ley Orgánica de Defensa del Consumidor da derecho a devolver o cambiar compras hechas por internet, teléfono o catálogo dentro de 15 días desde la recepción, si el producto conserva su estado original ✅. Tu política de devoluciones no puede ser más restrictiva que eso. Y al ser tú el vendedor, **respondes por la garantía** aunque el proveedor sea quien despacha ⚠️.

**Productos regulados.** Tu lista marca 6 categorías. Hay más que probablemente lo necesiten ⚠️, por lo que propongo que la marca "regulado" sea **configurable por categoría y subcategoría**, con tipos de documento definidos en el panel:
- ARCSA exige registro o notificación sanitaria para cosméticos, productos de higiene y dispositivos médicos ✅, y está fiscalizando activamente (clausuras y decomisos en 2025–2026) ✅. Ojo: los **masajeadores y soportes ortopédicos** pueden caer en dispositivos médicos, y ARCSA publicó nueva normativa de dispositivos médicos en abril de 2026 ✅.
- Candidatos adicionales: artículos para bebé (biberones, chupones), **celulares y accesorios** (cargadores, baterías externas: seguridad eléctrica y homologación de equipos inalámbricos ante ARCOTEL), audífonos y relojes inteligentes (ARCOTEL), textiles y calzado (etiquetado INEN), alimento para mascotas (Agrocalidad), iluminación, seguridad industrial (EPP). Estos los menciono por conocimiento general; **no los verifiqué** ⚠️. Un gestor de comercio exterior o un abogado debería confirmar la lista antes de publicar esas categorías.

**Contra entrega.** Es el riesgo operativo principal:
- Quién cobra el efectivo (transportista o proveedor) y cómo te lo devuelve. Por eso el modelo incluye `CodSettlement`.
- Pedidos rechazados o falsos. Propongo confirmar cada pedido por WhatsApp antes de enviar la orden al proveedor, y una lista de bloqueo de números y cédulas.
- Costo de la devolución cuando el cliente rechaza el paquete.

**Stock de terceros.** Tú no ves la bodega del proveedor, así que habrá sobreventa. Propongo: stock actualizable por CSV (y por API más adelante), "stock bajo" configurable y un paso de confirmación del proveedor con plazo.

**Envíos.** Galápagos y el Oriente tienen costos y plazos distintos. La tabla de tarifas por provincia y rango de peso lo cubre, pero necesito saber cómo cobran tus transportistas.

**Imitaciones.** La declaración de marca es solo un campo. Para que tenga fuerza real: aceptación explícita en el contrato con cada proveedor, revisión humana de productos con marcas conocidas, un listado de marcas bloqueadas y un canal de denuncia visible.

**Inconsistencias en tu lista de categorías.** Conviene corregirlas antes de la carga inicial:
- "Maternidad" aparece en Moda mujer y en Niños y bebés.
- "Bisutería" está en Arte y manualidades y también encaja en Joyería y accesorios.
- "Libros y música" solo trae instrumentos musicales, sin libros.
- Pediste tres niveles, pero la lista solo define dos. Dejo el tercero vacío, salvo que me indiques lo contrario.

**Respaldos.** Los de la base de datos los da el proveedor de Postgres (con restauración a un punto en el tiempo, que normalmente es de pago). Añadiría un volcado diario a un almacenamiento aparte. Lo mismo para las imágenes.

**Canales sociales.** Guardaremos el canal y los parámetros UTM en cada pedido. Opcional: generar el catálogo para Meta (Facebook/Instagram) y TikTok a partir de los productos.

---

## 5. Decisiones que necesito de ti

1. **¿Eres el vendedor ante el cliente** (facturas tú y respondes por la garantía) o los proveedores facturan directamente?
2. **¿Los proveedores son locales o importan?** Cambia los plazos de entrega y los trámites aduaneros.
3. **Facturación electrónica del SRI:** ¿la incluimos como etapa 6, la integramos con un proveedor externo o ya tienes un sistema?
4. **Pasarela de pago:** PayPhone, Kushki, PlacetoPay u otra. Lo habitual es elegir por comisión y facilidad de contrato. No es urgente: se decide antes de la etapa 5.
5. **WhatsApp:** ¿empezamos con enlaces `wa.me` (propuesto) o necesitas confirmación automática desde el primer día? Esto último requiere cuenta de WhatsApp Business verificada.
6. **Contra entrega:** ¿quién cobra y entrega el efectivo?
7. **Base de datos y hosting:** ¿Neon o Supabase? Ambos sirven. ¿Ya tienes cuenta en Vercel y dominio?
8. **Marca regulada:** ¿aceptas hacerla configurable por categoría y subcategoría, con la lista ampliada del apartado 4?
9. **Nombre comercial, RUC y textos legales:** los necesito para las políticas. Hasta que los tengas, se usarán marcadores de posición, no texto legal inventado.
10. **Panel mínimo dentro de la etapa 1:** ¿de acuerdo con el cambio de orden?

---

## Fuentes

- Notificación de vulneración de seguridad de datos personales (SPDP): https://www.gob.ec/spdp/tramites/notificacion-vulneracion-seguridad-datos-personales
- Ley Orgánica de Protección de Datos Personales: https://seps.gob.ec/wp-content/uploads/Ley-Orgánica-de-Protección-de-Datos-Personales-2022.pdf
- Límite de USD 50 para consumidor final: https://primicias.ec/noticias/economia/facturas-consumidor-final
- Facturación electrónica 2026: https://www.expreso.ec/actualidad/economia/factura-electronica-2026-el-cambio-obligatorio-del-sri-que-rige-desde-enero-269991.html
- Devolución en compras a distancia, art. 45 LODC (15 días): https://www.extra.ec/noticia/actualidad/cyberday-2025-garantizan-marcas-compras-seguras-devoluciones-ecuador-127132.html
- Productos sujetos a registro sanitario (ARCSA): https://faolex.fao.org/docs/pdf/ecu201458.pdf
- Normativa de dispositivos médicos 2026: https://www.lexis.com.ec/noticias/registro-oficial-del-dia-arcsa-regula-el-registro-sanitario-de-dispositivos-medicos-en-ecuador-1
- Control de ARCSA en cosméticos: https://www.teleamazonas.com/arcsa-decomiso-cosmeticos-productos-adulterados/
