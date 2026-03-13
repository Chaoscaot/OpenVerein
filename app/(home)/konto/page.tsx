import { KontoPageContent } from "@/components/account/KontoPageContent";
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function KontoPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect(`/login?callbackURL=${encodeURIComponent("/konto")}`);
  }

  return (
    <main>
      <KontoPageContent />
    </main>
  );
}
