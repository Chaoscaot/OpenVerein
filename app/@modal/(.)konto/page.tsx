import { KontoModal } from "@/components/account/KontoModal";
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function KontoModalPage() {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect(`/login?callbackURL=${encodeURIComponent("/konto")}`);
  }

  return <KontoModal />;
}
