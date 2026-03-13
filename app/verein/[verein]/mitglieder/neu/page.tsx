import { MitgliederEdit } from "@/components/verein/mitglieder/MitgliederEdit";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";

export default async function NewMitgliedPage({
  params,
}: {
  params: Promise<{ verein: string }>;
}) {
  const { verein } = await params;
  const v = await fetchAuthQuery(api.verein.get, {
    id: verein as Id<"verein">,
  });

  return (
    <>
      <SiteHeader title="Neues Mitglied"></SiteHeader>
      <div className="p-4">
        <MitgliederEdit verein={v} />
      </div>
    </>
  );
}
