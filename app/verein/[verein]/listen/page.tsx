import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";

export default async function ListenPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;
    const acl = await fetchAuthQuery(api.permissions.getMyPermissions, { vereinId: verein as Id<"verein"> });
    const permissionSet = new Set(acl.permissions);

    const links = [
        {
            href: `/verein/${verein}/listen/verwaltung`,
            label: "Listenverwaltung",
            description: "Pflege automatische und benutzerdefinierte Verteilerlisten für deinen Verein.",
            visible: permissionSet.has("liste.view") || permissionSet.has("liste.manage") || permissionSet.has("mitglied.view"),
        },
        {
            href: `/verein/${verein}/listen/mail`,
            label: "Mailversand",
            description: "Versende Nachrichten an eine oder mehrere Listen inklusive Empfängervorschau und Anhängen.",
            visible: permissionSet.has("mail.send"),
        },
    ].filter((item) => item.visible);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Kommunikation</CardTitle>
                    <CardDescription>Wähle den Bereich, den du öffnen möchtest.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                    {links.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Für dieses Konto sind aktuell keine Kommunikationsbereiche freigeschaltet.</p>
                    ) : (
                        links.map((item) => (
                            <div key={item.href} className="rounded-lg border p-5 space-y-4">
                                <div className="space-y-2">
                                    <h2 className="text-lg font-semibold">{item.label}</h2>
                                    <p className="text-sm text-muted-foreground">{item.description}</p>
                                </div>
                                <Link href={item.href}>
                                    <Button variant="outline">Öffnen</Button>
                                </Link>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
