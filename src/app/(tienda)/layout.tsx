import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StoreProvider } from "@/components/store-state";
import { ConsentAndPixels } from "@/components/pixels";
import { UtmCapture } from "@/components/utm-capture";
import { getSettings } from "@/lib/settings";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <StoreProvider>
      <UtmCapture />
      <Header />
      <main className="mx-auto max-w-7xl px-3 pb-8 pt-4">{children}</main>
      <Footer />
      <ConsentAndPixels metaPixelId={s.pixels.metaPixelId} tiktokPixelId={s.pixels.tiktokPixelId} />
    </StoreProvider>
  );
}
