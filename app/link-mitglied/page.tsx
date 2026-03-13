import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import { LinkMitgliedClientPage } from "./LinkMitgliedClientPage";

export default async function LinkMitgliedPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const normalizedToken = token ?? "";
  const callbackURL = normalizedToken
    ? `/link-mitglied?token=${encodeURIComponent(normalizedToken)}`
    : "/link-mitglied";
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  }

  return <LinkMitgliedClientPage token={normalizedToken} />;
}
