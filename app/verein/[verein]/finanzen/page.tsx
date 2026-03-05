"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";

export default function FinanzenPage() {
    const params = useParams();
    const router = useRouter();
    const vereinId = params.verein as Id<"verein">;

    const kassen = useQuery(api.finanzen.getKassen, { vereinId });
    const totalBestand = useQuery(api.finanzen.getVereinFinanzen, { vereinId });
    const buchungen = useQuery(api.finanzen.getBuchungen, { vereinId });
    const buchungsUebersicht = useQuery(api.finanzen.getBeitragsBuchungsUebersicht, { vereinId });
    const mitglieder = useQuery(api.mitglieder.list, { vereinId });
    const beitragssaetze = useQuery(api.beitragssatz.list, { vereinId });

    const createKasse = useMutation(api.finanzen.createKasse);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [typ, setTyp] = useState<"barkasse" | "bankkonto" | "kreditkarte" | "paypal" | "sonstiges">("bankkonto");
    const [anfangsbestand, setAnfangsbestand] = useState("0");
    const [waehrung, setWaehrung] = useState("EUR");
    const [aktiv, setAktiv] = useState(true);

    const handleCreateKasse = async () => {
        await createKasse({
            vereinId,
            name,
            typ,
            waehrung,
            anfangsbestand: parseFloat(anfangsbestand),
            aktiv,
        });
        setIsCreateOpen(false);
        setName("");
        setAnfangsbestand("0");
    };

    if (kassen === undefined || totalBestand === undefined || buchungen === undefined || buchungsUebersicht === undefined || mitglieder === undefined || beitragssaetze === undefined) {
        return <div>Lade Finanzen...</div>;
    }

    return (
        <>
            <SiteHeader title="Kassen" />
            <div className="space-y-6 p-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Finanzen</h2>
                        <p className="text-muted-foreground">Verwalte die Kassen und Bankkonten des Vereins.</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-medium text-muted-foreground">Gesamtbestand</p>
                        <p className="text-2xl font-bold">
                            {totalBestand.toFixed(2)} {kassen[0]?.waehrung || "EUR"}
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => router.push(`/verein/${vereinId}/finanzen/beitragssaetze`)}>
                        Beitragsverwaltung
                    </Button>
                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button>+ Neue Kasse</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Neue Kasse anlegen</DialogTitle>
                                <DialogDescription>Erstelle eine neue Barkasse, ein Bankkonto oder ein anderes Finanzkonto.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Name / Bezeichnung</Label>
                                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Hauptkonto, Barkasse Fest" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="typ">Typ</Label>
                                    <Select value={typ} onValueChange={(val: any) => setTyp(val)}>
                                        <SelectTrigger id="typ">
                                            <SelectValue placeholder="Typ wählen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="barkasse">Barkasse</SelectItem>
                                            <SelectItem value="bankkonto">Bankkonto</SelectItem>
                                            <SelectItem value="kreditkarte">Kreditkarte</SelectItem>
                                            <SelectItem value="paypal">PayPal</SelectItem>
                                            <SelectItem value="sonstiges">Sonstiges</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="anfangsbestand">Anfangsbestand</Label>
                                        <Input id="anfangsbestand" type="number" step="0.01" value={anfangsbestand} onChange={(e) => setAnfangsbestand(e.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="waehrung">Währung</Label>
                                        <Input id="waehrung" value={waehrung} onChange={(e) => setWaehrung(e.target.value)} />
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="aktiv" checked={aktiv} onCheckedChange={(c) => setAktiv(!!c)} />
                                    <Label htmlFor="aktiv">Konto ist aktiv</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateKasse} disabled={!name}>
                                    Speichern
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Buchungen gesamt</CardDescription>
                            <CardTitle>{buchungsUebersicht.gesamt}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Mit Beitragssatz</CardDescription>
                            <CardTitle>{buchungsUebersicht.mitBeitragssatz}</CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Ohne Zuordnung</CardDescription>
                            <CardTitle>{buchungsUebersicht.ohneZuordnung}</CardTitle>
                        </CardHeader>
                    </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {kassen.map((kasse) => (
                        <Card key={kasse._id} className={!kasse.aktiv ? "opacity-60" : ""}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{kasse.name}</CardTitle>
                                <span className="text-xs text-muted-foreground capitalize">{kasse.typ}</span>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">
                                    {kasse.aktuellerBestand.toFixed(2)} {kasse.waehrung}
                                </div>
                                {kasse.iban && <p className="text-xs text-muted-foreground mt-1">{kasse.iban}</p>}
                            </CardContent>
                            <CardFooter>
                                <Button variant="outline" size="sm" className="w-full" onClick={() => router.push(`/verein/${vereinId}/finanzen/${kasse._id}`)}>
                                    Details anzeigen
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                    {kassen.length === 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Keine Kassen gefunden</CardTitle>
                            </CardHeader>
                            <CardContent>Legen Sie Ihre erste Kasse oder Bankkonto an.</CardContent>
                        </Card>
                    )}
                </div>

                <h3 className="text-xl font-bold tracking-tight mt-8 mb-4">Letzte Buchungen (Verein)</h3>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Datum</TableHead>
                                <TableHead>Zweck</TableHead>
                                <TableHead>Konto</TableHead>
                                <TableHead>Zuordnung</TableHead>
                                <TableHead className="text-right">Betrag</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {buchungen.slice(0, 10).map((buchung) => {
                                const kasse = kassen.find((k) => k._id === buchung.kasseId);
                                return (
                                    <TableRow key={buchung._id}>
                                        <TableCell>{new Date(buchung.datum).toLocaleDateString()}</TableCell>
                                        <TableCell>{buchung.zweck}</TableCell>
                                        <TableCell>{kasse?.name || "Unbekannt"}</TableCell>
                                        <TableCell>
                                            {[
                                                buchung.mitgliedId ? mitglieder.find((m) => m._id === buchung.mitgliedId) : null,
                                                buchung.beitragsSatzId ? beitragssaetze.find((s) => s._id === buchung.beitragsSatzId) : null,
                                            ]
                                                .filter(Boolean)
                                                .map((value) => ("vorname" in value! ? `${value.vorname} ${value.nachname}` : value!.name))
                                                .join(" · ") || "-"}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${buchung.betrag < 0 ? "text-red-500" : "text-green-500"}`}>
                                            {buchung.betrag > 0 ? "+" : ""}
                                            {buchung.betrag.toFixed(2)} {kasse?.waehrung || "EUR"}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {buchungen.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        Keine Buchungen gefunden.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    );
}
