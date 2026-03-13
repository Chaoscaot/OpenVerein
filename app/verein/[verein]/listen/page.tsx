import { redirect } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";

export default async function ListenPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;
    const acl = await fetchAuthQuery(api.permissions.getMyPermissions, {
        vereinId: verein as Id<"verein">,
    });
    const permissionSet = new Set(acl.permissions);

    const canManageLists = permissionSet.has("liste.view") || permissionSet.has("liste.manage") || permissionSet.has("mitglied.view");
    const canSendMail = permissionSet.has("mail.send");

    if (canManageLists) {
        redirect(`/verein/${verein}/listen/verwaltung`);
    }

    if (canSendMail) {
        redirect(`/verein/${verein}/listen/mail`);
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Kein Zugriff</CardTitle>
                <CardDescription>Für dieses Konto sind aktuell weder Listenverwaltung noch Mailversand freigeschaltet.</CardDescription>
            </CardHeader>
        </Card>
    );
}
