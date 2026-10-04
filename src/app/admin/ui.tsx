export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <p role={error ? "alert" : "status"} className={`mb-4 rounded-lg p-3 text-sm font-semibold ${error ? "bg-brand-50 text-brand-700" : "bg-green-50 text-green-800"}`}>
      {error ?? ok}
    </p>
  );
}
export type PanelSP = { ok?: string; error?: string };
