"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function LinkMitgliedPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { data: session } = authClient.useSession();
    const [submitting, setSubmitting] = useState(false);

    const token = searchParams.get("token") ?? "";
    const callbackURL = `/link-mitglied?token=${encodeURIComponent(token)}`;

    const invite = useQuery(api.mitglieder.getAccountLinkInviteInfo, token ? { token } : "skip");
    const acceptInvite = useMutation(api.mitglieder.acceptAccountLinkInvite);

    if (!token) {
        return (
            <main className="p-4 flex justify-center">
                <Card className="max-w-xl w-full">
                    <CardHeader>
                        <CardTitle>Ungültiger Link</CardTitle>
                        <CardDescription>Es wurde kein Verknüpfungstoken übergeben.</CardDescription>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    if (invite === undefined) {
        return (
            <main className="p-4 flex justify-center">
                <Card className="max-w-xl w-full">
                    <CardHeader>
                        <CardTitle>Einladung wird geprüft...</CardTitle>
                    </CardHeader>
                </Card>
            </main>
        );
    }

    const status = invite.status;

    return (
        <main className="p-4 flex justify-center">
            <Card className="max-w-xl w-full">
                <CardHeader>
                    <CardTitle>Mitgliedschaft verknüpfen</CardTitle>
                    <CardDescription>{status === "pending" ? `Mitgliedschaft ${invite.mitgliedName} in ${invite.vereinName}` : "Diese Einladung kann nicht mehr verwendet werden."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {status === "pending" && !session ? (
                        <>
                            <p>Bitte melde dich zuerst an oder registriere dich, danach wird die Verknüpfung fortgesetzt.</p>
                            <div className="flex gap-2">
                                <Link href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`}>
                                    <Button>Anmelden</Button>
                                </Link>
                                <Link href={`/signup?callbackURL=${encodeURIComponent(callbackURL)}`}>
                                    <Button variant="outline">Registrieren</Button>
                                </Link>
                            </div>
                        </>
                    ) : null}

                    {status === "pending" && session ? (
                        <>
                            <p>Du bist als {session.user.email} angemeldet.</p>
                            <Button
                                disabled={submitting}
                                onClick={async () => {
                                    setSubmitting(true);
                                    try {
                                        await acceptInvite({ token });
                                        toast.success("Konto wurde mit dem Mitglied verknüpft");
                                        router.replace("/verein");
                                    } catch (error) {
                                        toast.error("Verknüpfung fehlgeschlagen");
                                    } finally {
                                        setSubmitting(false);
                                    }
                                }}
                            >
                                Jetzt verknüpfen
                            </Button>
                        </>
                    ) : null}

                    {status === "used" ? <p>Diese Einladung wurde bereits verwendet.</p> : null}
                    {status === "expired" ? <p>Diese Einladung ist abgelaufen. Bitte eine neue Einladung anfordern.</p> : null}
                    {status === "invalid" ? <p>Diese Einladung ist ungültig.</p> : null}
                </CardContent>
            </Card>
        </main>
    );
}
