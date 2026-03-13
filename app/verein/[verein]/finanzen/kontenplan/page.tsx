"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { BUCHHALTUNG_BEREICH_LABELS, BUCHHALTUNG_KONTO_TYP_LABELS } from "@/lib/skr42";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function KontenplanPage() {
    const params = useParams();
    const router = useRouter();
    const vereinId = params.verein as Id<"verein">;

    const buchhaltungOverview = useQuery(api.finanzen.getBuchhaltungOverview, {
        vereinId,
    });
    const kontenplan = useQuery(api.finanzen.getKontenplan, { vereinId });
    const kassen = useQuery(api.finanzen.getKassen, { vereinId });

    const initializeSkr42 = useMutation(api.finanzen.initializeSkr42);
    const assignKasseBuchhaltungKonto = useMutation(api.finanzen.assignKasseBuchhaltungKonto);

    if (buchhaltungOverview === undefined || kontenplan === undefined || kassen === undefined) {
        return <div>Lade Kontenplan...</div>;
    }

    const liquiditaetskonten = kontenplan.filter((konto) => konto.isLiquiditaetskonto);
    const kontenByBereich = new Map(
        Object.entries(BUCHHALTUNG_BEREICH_LABELS).map(([bereich, label]) => [
            bereich,
            {
                label,
                konten: kontenplan.filter((konto) => konto.bereich === bereich),
            },
        ]),
    );

    const handleInitialize = async () => {
        try {
            const result = await initializeSkr42({ vereinId });
            toast.success(`SKR42 initialisiert: ${result.totalKonten} Konten, ${result.mappedKassen} Kassen zugeordnet`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "SKR42 konnte nicht initialisiert werden");
        }
    };

    const handleAssignKasse = async (kasseId: Id<"kasse">, buchhaltungKontoId: string) => {
        try {
            await assignKasseBuchhaltungKonto({
                kasseId,
                buchhaltungKontoId: buchhaltungKontoId as Id<"buchhaltung_konto">,
            });
            toast.success("Liquiditätskonto gespeichert");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Zuordnung konnte nicht gespeichert werden");
        }
    };

    return (
        <>
            <SiteHeader title="SKR42-Kontenplan" />
            <div className="space-y-6 p-4">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">SKR42</h2>
                        <p className="text-muted-foreground">Kontenrahmen, Liquiditätskonten und Kassenzuordnungen des Vereins.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => router.push(`/verein/${vereinId}/finanzen`)}>
                            Zurück zu Finanzen
                        </Button>
                        <Button onClick={handleInitialize}>{buchhaltungOverview.isInitialized ? "SKR42-Basiskonten aktualisieren" : "SKR42 initialisieren"}</Button>
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Kontenrahmen</CardDescription>
                            <CardTitle>{buchhaltungOverview.kontenrahmen?.toUpperCase() ?? "Nicht aktiv"}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Konten insgesamt</CardDescription>
                            <CardTitle>{buchhaltungOverview.kontenAnzahl}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Kassen gemappt</CardDescription>
                            <CardTitle>
                                {buchhaltungOverview.mappedKassen}/{buchhaltungOverview.kassenAnzahl}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Liquiditätskonten je Kasse</CardTitle>
                        <CardDescription>Jede Kasse benötigt ein passendes SKR42-Liquiditätskonto für automatische Soll/Haben-Buchungen.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Kasse</TableHead>
                                    <TableHead>Typ</TableHead>
                                    <TableHead>Währung</TableHead>
                                    <TableHead>SKR42-Liquiditätskonto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {kassen.map((kasse) => (
                                    <TableRow key={kasse._id}>
                                        <TableCell className="font-medium">{kasse.name}</TableCell>
                                        <TableCell className="capitalize">{kasse.typ}</TableCell>
                                        <TableCell>{kasse.waehrung}</TableCell>
                                        <TableCell>
                                            <Select value={kasse.buchhaltungKontoId} onValueChange={(value) => handleAssignKasse(kasse._id, value)}>
                                                <SelectTrigger className="max-w-md">
                                                    <SelectValue placeholder="Liquiditätskonto wählen" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {liquiditaetskonten.map((konto) => (
                                                        <SelectItem key={konto._id} value={konto._id}>
                                                            {konto.nummer} · {konto.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {kassen.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            Keine Kassen vorhanden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {Array.from(kontenByBereich.entries()).map(([bereich, value]) => (
                    <Card key={bereich}>
                        <CardHeader>
                            <CardTitle>{value.label}</CardTitle>
                            <CardDescription>{value.konten.length} Konten in diesem Bereich.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nr.</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Typ</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Beschreibung</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {value.konten.map((konto) => (
                                        <TableRow key={konto._id}>
                                            <TableCell className="font-medium">{konto.nummer}</TableCell>
                                            <TableCell>{konto.name}</TableCell>
                                            <TableCell>{BUCHHALTUNG_KONTO_TYP_LABELS[konto.typ]}</TableCell>
                                            <TableCell>{konto.aktiv ? "Aktiv" : "Inaktiv"}</TableCell>
                                            <TableCell>{konto.beschreibung || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                    {value.konten.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-16 text-center">
                                                Keine Konten in diesem Bereich.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </>
    );
}
