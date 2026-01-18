import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { preloadAuthQuery } from "@/lib/auth-server";
import { MitgliederTable } from "./table";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { SepaExportButton } from "@/components/verein/mitglieder/SepaExportButton";

export default async function MitgliederPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;
    const preloaded = await preloadAuthQuery(api.mitglieder.list, { vereinId: verein as Id<"verein"> });

    return (
        <>
            <SiteHeader title="Mitglieder">
                <SepaExportButton vereinId={verein as Id<"verein">} />
            </SiteHeader>
            <div className="p-4">
                <MitgliederTable preloaded={preloaded} />
            </div>
        </>
    );
}
