import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery, preloadAuthQuery } from "@/lib/auth-server";
import { MitgliederTable } from "./table";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { SepaExportButton } from "@/components/verein/mitglieder/SepaExportButton";

export default async function MitgliederPage({
  params,
}: {
  params: Promise<{ verein: string }>;
}) {
  const { verein } = await params;
  const preloaded = await preloadAuthQuery(api.mitglieder.list, {
    vereinId: verein as Id<"verein">,
  });
  const acl = await fetchAuthQuery(api.permissions.getMyPermissions, {
    vereinId: verein as Id<"verein">,
  });
  const canExportSepa = acl.permissions.includes("sepa.export");

  return (
    <>
      <SiteHeader title="Mitglieder">
        {canExportSepa ? (
          <SepaExportButton vereinId={verein as Id<"verein">} />
        ) : null}
      </SiteHeader>
      <div className="p-4">
        <MitgliederTable preloaded={preloaded} />
      </div>
    </>
  );
}
