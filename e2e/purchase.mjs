// Prueba de extremo a extremo en un navegador con tamaño de celular.
// Requisitos: app en marcha (npm run build && npm start) y base con datos (npm run db:seed).
// Uso:  node e2e/purchase.mjs [urlBase] [carpetaDeCapturas]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "e2e/shots";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@chasqui.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "CambiaEstaClave-2026";
mkdirSync(SHOTS, { recursive: true });

const log = (m) => console.log(`✓ ${m}`);
const assert = (c, m) => { if (!c) { console.error(`✗ ${m}`); process.exitCode = 1; throw new Error(m); } };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "es-EC" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

try {
  // 1. Inicio
  await page.goto(`${BASE}/`);
  assert(await page.locator("h1").first().isVisible(), "el inicio muestra el título");
  await page.screenshot({ path: `${SHOTS}/01-inicio.png` });
  log("inicio carga");

  // 2. Buscador con error de escritura
  await page.goto(`${BASE}/buscar?q=vestidoz`);
  const n = await page.locator("a[href^='/p/']").count();
  assert(n > 0, "la búsqueda con error de escritura devuelve productos");
  await page.screenshot({ path: `${SHOTS}/02-busqueda.png` });
  log(`búsqueda tolerante a errores: ${n} resultados para "vestidoz"`);

  // 3. Producto con stock (de la sección "más vendidos" del inicio)
  await page.goto(`${BASE}/`);
  await page.locator("a[href^='/p/']").first().click();
  await page.waitForURL(/\/p\//, { waitUntil: "commit" });
  await page.screenshot({ path: `${SHOTS}/03-producto.png` });
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByText("Agregado al carrito").waitFor();
  log("producto agregado al carrito");

  // 4. Carrito
  await page.goto(`${BASE}/carrito`);
  await page.getByRole("link", { name: "Continuar con la compra" }).waitFor();
  await page.screenshot({ path: `${SHOTS}/04-carrito.png` });
  await page.getByRole("link", { name: "Continuar con la compra" }).click();
  await page.waitForURL(/checkout/, { waitUntil: "commit" });

  // 5. Checkout: el total final se ve antes de confirmar
  await page.getByLabel("Nombre y apellido").fill("María Fernanda Pérez");
  await page.getByLabel("Cédula o RUC").fill("1710034065");
  await page.getByLabel("Celular (WhatsApp)").fill("0991234567");
  await page.getByLabel("Provincia").selectOption({ label: "Pichincha" });
  await page.getByLabel("Ciudad o cantón").fill("Quito");
  await page.getByLabel("Dirección").fill("Av. Amazonas N24-15 y Colón");
  await page.getByLabel("Referencia").fill("Frente al parque El Ejido");
  await page.locator("dt:has-text('Total a pagar') + dd").filter({ hasText: "$" }).waitFor();
  const total = await page.locator("dt:has-text('Total a pagar') + dd").innerText();
  assert(/\$/.test(total), "el total con envío es visible antes de confirmar");
  await page.getByLabel(/Acepto el/).check();
  await page.screenshot({ path: `${SHOTS}/05-checkout.png`, fullPage: true });
  log(`checkout muestra total final: ${total}`);

  // 6. Cédula inválida debe rechazarse
  await page.getByLabel("Cédula o RUC").fill("1710034066");
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await page.getByText("Cédula o RUC no válido").waitFor();
  log("cédula inválida rechazada");
  // Tras el error el formulario NO debe vaciarse.
  assert((await page.getByLabel("Nombre y apellido").inputValue()) === "María Fernanda Pérez", "el nombre se conserva tras el error");
  assert((await page.getByLabel("Dirección").inputValue()).startsWith("Av. Amazonas"), "la dirección se conserva tras el error");
  assert(await page.getByLabel(/Acepto el/).isChecked(), "el consentimiento se conserva tras el error");
  log("el formulario conserva lo escrito tras un error");
  await page.getByLabel("Cédula o RUC").fill("1710034065");

  // 7. Confirmar
  await page.getByRole("button", { name: "Confirmar pedido" }).click();
  await page.waitForURL(/\/pedido\//, { waitUntil: "commit" });
  await page.getByText("Recibimos tu pedido").waitFor();
  const number = (await page.locator("h1").innerText()).trim();
  assert(/^CH-\d+$/.test(number), `número de pedido válido (${number})`);
  await page.screenshot({ path: `${SHOTS}/06-confirmacion.png`, fullPage: true });
  log(`pedido creado: ${number}`);
  const trackingUrl = page.url().split("?")[0];

  // 8. El carrito quedó vacío
  await page.goto(`${BASE}/carrito`);
  await page.getByText("Tu carrito está vacío").waitFor();
  log("carrito vaciado tras la compra");

  // 9. Seguimiento por número + últimos 4 dígitos
  await page.goto(`${BASE}/seguimiento`);
  await page.getByLabel("Número de pedido").fill(number);
  await page.getByLabel(/Últimos 4/).fill("0000");
  await page.getByRole("button", { name: "Ver mi pedido" }).click();
  await page.getByText("No encontramos un pedido").waitFor();
  assert((await page.getByLabel("Número de pedido").inputValue()) === number, "el número de pedido se conserva tras el error");
  await page.getByLabel(/Últimos 4/).fill("4567");
  await page.getByRole("button", { name: "Ver mi pedido" }).click();
  await page.waitForURL(/\/pedido\//, { waitUntil: "commit" });
  log("seguimiento: rechaza teléfono incorrecto y acepta el correcto");

  // 10. Panel: login, confirmar, despachar y entregar
  const admin = await ctx.newPage();
  await admin.goto(`${BASE}/admin`);
  await admin.waitForURL(/admin\/login/, { waitUntil: "commit" });
  await admin.getByLabel("Correo").fill(ADMIN_EMAIL);
  await admin.getByLabel("Contraseña").fill("incorrecta-123");
  await admin.getByRole("button", { name: "Ingresar" }).click();
  await admin.getByText("Correo o contraseña incorrectos").waitFor();
  assert((await admin.getByLabel("Correo").inputValue()) === ADMIN_EMAIL, "el correo se conserva tras el error");
  await admin.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await admin.getByRole("button", { name: "Ingresar" }).click();
  await admin.waitForURL(/\/admin$/, { waitUntil: "commit" });
  await admin.screenshot({ path: `${SHOTS}/07-panel.png`, fullPage: true });
  log("login del panel (rechaza clave incorrecta, acepta la correcta)");

  await admin.goto(`${BASE}/admin/pedidos?q=${number}`);
  await admin.getByRole("link", { name: number }).click();
  await admin.getByRole("button", { name: "Pasar a: Confirmado" }).click();
  await admin.getByText("Estado actualizado").waitFor();
  await admin.getByRole("button", { name: "Pasar a: Enviado al proveedor" }).click();
  await admin.getByText("Estado actualizado").waitFor();
  await admin.getByPlaceholder("Empresa de courier").fill("Servientrega");
  await admin.getByPlaceholder("Número de guía").fill("E2E-12345");
  await admin.getByRole("button", { name: "Pasar a: Despachado" }).click();
  await admin.getByText("Estado actualizado").waitFor();
  await admin.screenshot({ path: `${SHOTS}/08-pedido-admin.png`, fullPage: true });
  log("pedido confirmado, enviado al proveedor y despachado desde el panel");

  // 11. El cliente ve el courier y la guía
  await page.goto(trackingUrl);
  await page.getByText("E2E-12345").waitFor();
  await page.screenshot({ path: `${SHOTS}/09-seguimiento-cliente.png`, fullPage: true });
  log("el cliente ve la guía del courier");

  await admin.getByRole("button", { name: "Pasar a: Entregado" }).click();
  await admin.getByText("Estado actualizado").waitFor();
  log("pedido entregado");

  // 12. Rutas protegidas
  const anon = await (await browser.newContext()).newPage();
  const r = await anon.goto(`${BASE}/admin/pedidos`);
  assert(anon.url().includes("/admin/login"), "el panel exige sesión");
  log("el panel exige sesión");

  const real = errors.filter((e) => !/favicon|Failed to load resource.*404/i.test(e));
  assert(real.length === 0, `sin errores de consola: ${real.join(" | ")}`);
  log("sin errores en la consola del navegador");
} finally {
  await browser.close();
}
console.log(process.exitCode ? "FALLÓ" : "TODO OK");
