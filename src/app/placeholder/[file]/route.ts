/** Imágenes de marcador de posición para los datos de ejemplo (SVG ligero, sin servicios externos). */
const PALETTE = ["#f7d9c4", "#d4e7d0", "#d3e0f2", "#f2d3dc", "#efe3b8", "#d9d3f0", "#c8e6e3", "#f3cfc2"];

export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const name = file.replace(/\.svg$/, "").slice(0, 40);
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = PALETTE[h % PALETTE.length];
  const label = name.replace(/-\d+$/, "").replace(/[^a-z0-9ñ]/gi, " ").trim().toUpperCase().slice(0, 14);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="Imagen de ejemplo">
<rect width="600" height="600" fill="${bg}"/><circle cx="300" cy="260" r="110" fill="#fff" opacity=".55"/>
<path d="M210 330l70-90 50 60 40-45 70 75z" fill="#1b1b2f" opacity=".18"/>
<text x="300" y="470" font-family="system-ui,sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="#1b1b2f" opacity=".55">${label}</text>
<text x="300" y="515" font-family="system-ui,sans-serif" font-size="20" text-anchor="middle" fill="#1b1b2f" opacity=".4">imagen de ejemplo</text></svg>`;
  return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=31536000, immutable" } });
}
