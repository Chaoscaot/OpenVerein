import { KontoSettings } from "@/components/account/KontoSettings";

export function KontoPageContent({ modal = false }: { modal?: boolean }) {
  return (
    <div
      className={
        modal ? "w-full" : "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6"
      }
    >
      <div className="mb-8 max-w-3xl space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Konto</h1>
        <p className="text-muted-foreground">
          Verwalte dein Profil, deine Sicherheitseinstellungen und personliche
          App-Praferenzen.
        </p>
      </div>
      <KontoSettings />
    </div>
  );
}
