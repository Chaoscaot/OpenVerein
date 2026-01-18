import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";
import { VereinSettings } from "@/components/verein/VereinSettings";

export default async function SettingsPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;
    const v = await fetchAuthQuery(api.verein.get, { id: verein as Id<"verein"> });

    return (
        <>
            <SiteHeader title="Vereinseinstellungen"></SiteHeader>
            <div className="p-4">
                <VereinSettings verein={v} />
            </div>
        </>
    );
}
