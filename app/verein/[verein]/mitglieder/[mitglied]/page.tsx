import { MitgliederEdit } from "@/components/verein/mitglieder/MitgliederEdit";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";

export default async function EditMitgliedPage({ params }: { params: Promise<{ verein: string; mitglied: string }> }) {
    const { verein, mitglied } = await params;
    const v = await fetchAuthQuery(api.verein.get, { id: verein as Id<"verein"> });
    const m = await fetchAuthQuery(api.mitglieder.get, { id: mitglied as Id<"mitglied"> });

    if (!m) {
        return (
            <>
                <SiteHeader title="Mitglied nicht gefunden"></SiteHeader>
                <div className="p-4">
                    <p>Das angeforderte Mitglied wurde nicht gefunden.</p>
                </div>
            </>
        );
    }

    return (
        <>
            <SiteHeader title={`${m.vorname} ${m.nachname} bearbeiten`}></SiteHeader>
            <div className="p-4">
                <MitgliederEdit verein={v} mitglied={m} />
            </div>
        </>
    );
}
