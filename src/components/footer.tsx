import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { waLink } from "@/lib/whatsapp/link";

export async function Footer() {
  const s = await getSettings();
  const wa = waLink(s.company.whatsapp, "Hola, necesito ayuda con mi compra.");
  return (
    <footer className="mt-16 bg-ink text-sm text-white/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="text-lg font-black text-white">{s.storeName}</p>
          <p className="mt-1">{s.tagline}</p>
          <p className="mt-3">{s.company.legalName}</p>
          <p>RUC: {s.company.ruc}</p>
          <p>{s.company.address}</p>
        </div>
        <div>
          <p className="font-bold text-white">Ayuda</p>
          <ul className="mt-2 space-y-2">
            <li><Link href="/seguimiento" className="underline">Seguir mi pedido</Link></li>
            <li><Link href="/politicas/devoluciones" className="underline">Devoluciones</Link></li>
            <li><Link href="/politicas/garantia" className="underline">Garantía</Link></li>
            <li><Link href="/politicas/privacidad" className="underline">Aviso de privacidad</Link></li>
            <li><Link href="/politicas/terminos" className="underline">Términos y condiciones</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-white">Contacto</p>
          <ul className="mt-2 space-y-2">
            <li>{s.company.phone}</li>
            <li>{s.company.email}</li>
            {wa && <li><a href={wa} className="btn btn-wa !min-h-10" target="_blank" rel="noopener noreferrer">Escríbenos por WhatsApp</a></li>}
          </ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs">© {new Date().getFullYear()} {s.storeName}. Hecho en Ecuador con talento ecuatoriano.</p>
    </footer>
  );
}
