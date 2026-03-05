"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { MitgliedSelector } from "@/components/verein/mitglieder/MitgliedSelector";
import { BeitragssatzSelector } from "@/components/verein/BeitragssatzSelector";

export default function KasseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const vereinId = params.verein as Id<"verein">;
    const kasseId = params.kasseId as Id<"kasse">;

    const kasse = useQuery(api.finanzen.getKasse, { kasseId });
    const buchungen = useQuery(api.finanzen.getBuchungen, { kasseId });
    const mitglieder = useQuery(api.mitglieder.list, { vereinId });
    const beitragssaetze = useQuery(api.beitragssatz.list, { vereinId });

    const createBuchung = useMutation(api.finanzen.createBuchung);
    const deleteKasse = useMutation(api.finanzen.deleteKasse);
    const deleteBuchung = useMutation(api.finanzen.deleteBuchung);

    const [isBuchungOpen, setIsBuchungOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const [zweck, setZweck] = useState("");
    const [betrag, setBetrag] = useState("");
    const [datum, setDatum] = useState<Date>(new Date());
    const [belegNummer, setBelegNummer] = useState("");
    const [kategorie, setKategorie] = useState("");
    const [typ, setTyp] = useState<"einnahme" | "ausgabe">("einnahme");
    const [mitgliedId, setMitgliedId] = useState<Id<"mitglied"> | undefined>(undefined);
    const [beitragsSatzId, setBeitragsSatzId] = useState<Id<"beitrags_satz"> | undefined>(undefined);

    const handleCreateBuchung = async () => {
        try {
            const numBetrag = parseFloat(betrag);
            if (isNaN(numBetrag) || numBetrag === 0) {
                toast.error("Bitte einen gültigen Betrag eingeben");
                return;
            }

            const finalBetrag = typ === "ausgabe" ? -Math.abs(numBetrag) : Math.abs(numBetrag);

            await createBuchung({
                vereinId,
                kasseId,
                betrag: finalBetrag,
                datum: datum.toISOString(),
                zweck,
                kategorie: kategorie || undefined,
                belegNummer: belegNummer || undefined,
                mitgliedId,
                beitragsSatzId,
            });

            toast.success("Buchung erstellt");
            setIsBuchungOpen(false);
            setZweck("");
            setBetrag("");
            setDatum(new Date());
            setBelegNummer("");
            setKategorie("");
            setMitgliedId(undefined);
            setBeitragsSatzId(undefined);
        } catch (error) {
            toast.error("Fehler beim Erstellen der Buchung");
        }
    };

    const handleDeleteKasse = async () => {
        try {
            await deleteKasse({ kasseId });
            toast.success("Kasse gelöscht");
            router.push(`/verein/${vereinId}/finanzen`);
        } catch (error) {
            toast.error("Kasse konnte nicht gelöscht werden (evtl. noch Buchungen vorhanden)");
        }
    };

    const handleDeleteBuchung = async (id: Id<"kassen_buchung">) => {
        if (!window.confirm("Buchung wirklich löschen?")) return;
        try {
            await deleteBuchung({ buchungId: id });
            toast.success("Buchung gelöscht");
        } catch (error) {
            toast.error("Fehler beim Löschen der Buchung");
        }
    };

    if (kasse === undefined || buchungen === undefined || mitglieder === undefined || beitragssaetze === undefined) {
        return <div>Lade Kasse...</div>;
    }

    if (kasse === null) {
        return <div>Kasse nicht gefunden</div>;
    }

    return (
        <>
            <SiteHeader title={kasse.name ?? "..."} />
            <div className="space-y-6 p-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm" onClick={() => router.push(`/verein/${vereinId}/finanzen`)}>
                        &larr; Zurück
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">{kasse.name}</h2>
                        <p className="text-muted-foreground capitalize">
                            {kasse.typ} · {kasse.waehrung}
                        </p>
                    </div>
                    <div className="ml-auto flex items-center gap-4">
                        <div className="text-right mr-4">
                            <p className="text-sm font-medium text-muted-foreground">Aktueller Bestand</p>
                            <p className="text-2xl font-bold">
                                {kasse.aktuellerBestand.toFixed(2)} {kasse.waehrung}
                            </p>
                        </div>

                        <Dialog open={isBuchungOpen} onOpenChange={setIsBuchungOpen}>
                            <DialogTrigger asChild>
                                <Button>+ Neue Buchung</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Neue Buchung erfassen</DialogTitle>
                                    <DialogDescription>Trage eine Einnahme oder Ausgabe für diese Kasse ein.</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="typ">Buchungsart</Label>
                                        <Select value={typ} onValueChange={(val: "einnahme" | "ausgabe") => setTyp(val)}>
                                            <SelectTrigger id="typ">
                                                <SelectValue placeholder="Typ wählen" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="einnahme">Einnahme (+)</SelectItem>
                                                <SelectItem value="ausgabe">Ausgabe (-)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="betrag">Betrag</Label>
                                        <Input id="betrag" type="number" step="0.01" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="zweck">Zweck / Beschreibung</Label>
                                        <Input id="zweck" value={zweck} onChange={(e) => setZweck(e.target.value)} placeholder="z.B. Büromaterial" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-2 flex-col flex">
                                            <Label htmlFor="datum">Datum</Label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !datum && "text-muted-foreground")}>
                                                        {datum ? format(datum, "PPP", { locale: de }) : <span>Datum wählen</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0">
                                                    <Calendar mode="single" selected={datum} onSelect={(d) => d && setDatum(d)} initialFocus />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="kategorie">Kategorie</Label>
                                            <Input id="kategorie" value={kategorie} onChange={(e) => setKategorie(e.target.value)} placeholder="z.B. Verwaltung" />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="belegNummer">Belegnummer</Label>
                                        <Input id="belegNummer" value={belegNummer} onChange={(e) => setBelegNummer(e.target.value)} placeholder="Optional" />
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="grid gap-2">
                                            <Label>Mitglied (optional)</Label>
                                            <MitgliedSelector vereinId={vereinId} value={mitgliedId} onChange={setMitgliedId} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Beitragssatz (optional)</Label>
                                            <BeitragssatzSelector vereinId={vereinId} value={beitragsSatzId} onChange={setBeitragsSatzId} />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleCreateBuchung} disabled={!zweck || !betrag}>
                                        Buchen
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                            <DialogTrigger asChild>
                                <Button variant="destructive" size="sm">
                                    Löschen
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Kasse löschen?</DialogTitle>
                                    <DialogDescription>Möchtest du die Kasse {kasse.name} wirklich löschen? Dies ist nur möglich, wenn keine Buchungen vorhanden sind.</DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                                        Abbrechen
                                    </Button>
                                    <Button variant="destructive" onClick={handleDeleteKasse} disabled={buchungen.length > 0}>
                                        Unwiderruflich löschen
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Buchungen</CardTitle>
                        <CardDescription>Alle Einnahmen und Ausgaben für dieses Konto.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Zweck</TableHead>
                                    <TableHead>Kategorie</TableHead>
                                    <TableHead>Beleg-Nr.</TableHead>
                                    <TableHead>Mitglied</TableHead>
                                    <TableHead>Beitragssatz</TableHead>
                                    <TableHead className="text-right">Betrag</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {buchungen.map((buchung) => (
                                    <TableRow key={buchung._id}>
                                        <TableCell>{format(new Date(buchung.datum), "dd.MM.yyyy")}</TableCell>
                                        <TableCell className="font-medium">{buchung.zweck}</TableCell>
                                        <TableCell>{buchung.kategorie || "-"}</TableCell>
                                        <TableCell>{buchung.belegNummer || "-"}</TableCell>
                                        <TableCell>
                                            {buchung.mitgliedId
                                                ? (() => {
                                                      const mitglied = mitglieder.find((m) => m._id === buchung.mitgliedId);
                                                      return mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : "-";
                                                  })()
                                                : "-"}
                                        </TableCell>
                                        <TableCell>{buchung.beitragsSatzId ? beitragssaetze.find((s) => s._id === buchung.beitragsSatzId)?.name || "-" : "-"}</TableCell>
                                        <TableCell className={`text-right font-medium ${buchung.betrag < 0 ? "text-red-500" : "text-green-500"}`}>
                                            {buchung.betrag > 0 ? "+" : ""}
                                            {buchung.betrag.toFixed(2)} {kasse.waehrung}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteBuchung(buchung._id)}>
                                                X
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {buchungen.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">
                                            Keine Buchungen vorhanden.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}
