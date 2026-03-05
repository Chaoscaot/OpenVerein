import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";
import Link from "next/link";

export default async function VereinPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;
    const acl = await fetchAuthQuery(api.permissions.getMyPermissions, { vereinId: verein as Id<"verein"> });
    const permissionSet = new Set(acl.permissions);

    const links = [
        {
            key: "mitglied.view",
            href: `/verein/${verein}/mitglieder`,
            label: "Mitglieder",
        },
        {
            key: "kasse.view",
            href: `/verein/${verein}/finanzen`,
            label: "Finanzen",
        },
        {
            key: "beitragssatz.view",
            href: `/verein/${verein}/finanzen/beitragssaetze`,
            label: "Beitragssätze",
        },
        {
            key: "settings.view",
            href: `/verein/${verein}/settings`,
            label: "Einstellungen",
        },
    ].filter((item) => permissionSet.has(item.key as (typeof acl.permissions)[number]));

    return (
        <>
            <SiteHeader title="Dashboard"></SiteHeader>
            <div className="p-4 space-y-3">
                <h1 className="text-2xl font-semibold">Vereins Dashboard</h1>
                {links.length === 0 ? (
                    <p className="text-muted-foreground">Für dieses Konto sind aktuell keine Dashboard-Bereiche freigeschaltet.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {links.map((item) => (
                            <Link key={item.href} href={item.href}>
                                <Button variant="outline">{item.label}</Button>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
