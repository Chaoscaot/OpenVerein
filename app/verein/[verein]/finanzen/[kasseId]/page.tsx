"use client";

import { KostenstellenSelector } from "@/components/verein/kostenstellen/KostenstellenSelector";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
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
    const searchParams = useSearchParams();
    const vereinId = params.verein as Id<"verein">;
    const kasseId = params.kasseId as Id<"kasse">;

    const kasse = useQuery(api.finanzen.getKasse, { kasseId });
    const buchungen = useQuery(api.finanzen.getBuchungen, { kasseId });
    const buchhaltungOverview = useQuery(api.finanzen.getBuchhaltungOverview, {
        vereinId,
    });
    const kontenplan = useQuery(api.finanzen.getKontenplan, { vereinId });
    const kostenstellenOverview = useQuery(api.kostenstellen.getOverview, {
        vereinId,
    });
    const mitglieder = useQuery(api.mitglieder.list, { vereinId });
    const beitragssaetze = useQuery(api.beitragssatz.list, { vereinId });

    const createBuchung = useMutation(api.finanzen.createBuchung);
    const assignBuchung = useMutation(api.kostenstellen.assignBuchung);
    const deleteKasse = useMutation(api.finanzen.deleteKasse);
    const deleteBuchung = useMutation(api.finanzen.deleteBuchung);

    const [isBuchungOpen, setIsBuchungOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isAssignOpen, setIsAssignOpen] = useState(false);

    const [zweck, setZweck] = useState("");
    const [betrag, setBetrag] = useState("");
    const [datum, setDatum] = useState<Date>(new Date());
    const [belegNummer, setBelegNummer] = useState("");
    const [kategorie, setKategorie] = useState("");
    const [typ, setTyp] = useState<"einnahme" | "ausgabe">("einnahme");
    const [gegenkontoId, setGegenkontoId] = useState<Id<"buchhaltung_konto"> | undefined>(undefined);
    const [mitgliedId, setMitgliedId] = useState<Id<"mitglied"> | undefined>(undefined);
    const [beitragsSatzId, setBeitragsSatzId] = useState<Id<"beitrags_satz"> | undefined>(undefined);
    const [kostenstelleId, setKostenstelleId] = useState<Id<"kostenstelle"> | undefined>(undefined);
    const [ausgabenpunktId, setAusgabenpunktId] = useState<Id<"kostenstelle_ausgabenpunkt"> | undefined>(undefined);
    const [selectedBuchungId, setSelectedBuchungId] = useState<Id<"kassen_buchung"> | undefined>(undefined);
    const [assignKostenstelleId, setAssignKostenstelleId] = useState<Id<"kostenstelle"> | undefined>(undefined);
    const [assignAusgabenpunktId, setAssignAusgabenpunktId] = useState<Id<"kostenstelle_ausgabenpunkt"> | undefined>(undefined);

    useEffect(() => {
        const createMode = searchParams.get("create");
        if (createMode !== "ausgabe" && createMode !== "einnahme") {
            return;
        }

        setTyp(createMode);
        setIsBuchungOpen(true);
        router.replace(`/verein/${vereinId}/finanzen/${kasseId}`);
    }, [kasseId, router, searchParams, vereinId]);

    const handleCreateBuchung = async () => {
        try {
            const numBetrag = parseFloat(betrag);
            if (isNaN(numBetrag) || numBetrag === 0) {
                toast.error("Bitte einen gültigen Betrag eingeben");
                return;
            }

            const finalBetrag = typ === "ausgabe" ? -Math.abs(numBetrag) : Math.abs(numBetrag);

            if (buchhaltungOverview?.kontenrahmen === "skr42" && !gegenkontoId) {
                toast.error("Bitte ein passendes SKR42-Gegenkonto auswählen");
                return;
            }

            await createBuchung({
                vereinId,
                kasseId,
                betrag: finalBetrag,
                datum: datum.toISOString(),
                zweck,
                kategorie: kategorie || undefined,
                belegNummer: belegNummer || undefined,
                gegenkontoId,
                mitgliedId,
                beitragsSatzId,
                kostenstelleId: typ === "ausgabe" ? kostenstelleId : undefined,
                ausgabenpunktId: typ === "ausgabe" ? ausgabenpunktId : undefined,
            });

            toast.success("Buchung erstellt");
            setIsBuchungOpen(false);
            setZweck("");
            setBetrag("");
            setDatum(new Date());
            setBelegNummer("");
            setKategorie("");
            setGegenkontoId(undefined);
            setMitgliedId(undefined);
            setBeitragsSatzId(undefined);
            setKostenstelleId(undefined);
            setAusgabenpunktId(undefined);
        } catch {
            toast.error("Fehler beim Erstellen der Buchung");
        }
    };

    const handleOpenAssignDialog = (buchungId: Id<"kassen_buchung">, nextKostenstelleId?: Id<"kostenstelle">, nextAusgabenpunktId?: Id<"kostenstelle_ausgabenpunkt">) => {
        setSelectedBuchungId(buchungId);
        setAssignKostenstelleId(nextKostenstelleId);
        setAssignAusgabenpunktId(nextAusgabenpunktId);
        setIsAssignOpen(true);
    };

    const handleAssignBuchung = async () => {
        if (!selectedBuchungId) {
            return;
        }

        try {
            await assignBuchung({
                buchungId: selectedBuchungId,
                kostenstelleId: assignKostenstelleId,
                ausgabenpunktId: assignAusgabenpunktId,
            });
            toast.success(assignAusgabenpunktId ? "Kostenstelle zugeordnet" : "Zuordnung entfernt");
            setIsAssignOpen(false);
            setSelectedBuchungId(undefined);
            setAssignKostenstelleId(undefined);
            setAssignAusgabenpunktId(undefined);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Zuordnung konnte nicht gespeichert werden");
        }
    };

    const handleDeleteKasse = async () => {
        try {
            await deleteKasse({ kasseId });
            toast.success("Kasse gelöscht");
            router.push(`/verein/${vereinId}/finanzen`);
        } catch {
            toast.error("Kasse konnte nicht gelöscht werden (evtl. noch Buchungen vorhanden)");
        }
    };

    const handleDeleteBuchung = async (id: Id<"kassen_buchung">) => {
        if (!window.confirm("Buchung wirklich löschen?")) return;
        try {
            await deleteBuchung({ buchungId: id });
            toast.success("Buchung gelöscht");
        } catch {
            toast.error("Fehler beim Löschen der Buchung");
        }
    };

    if (
        kasse === undefined ||
        buchungen === undefined ||
        buchhaltungOverview === undefined ||
        kontenplan === undefined ||
        kostenstellenOverview === undefined ||
        mitglieder === undefined ||
        beitragssaetze === undefined
    ) {
        return <div>Lade Kasse...</div>;
    }

    if (kasse === null) {
        return <div>Kasse nicht gefunden</div>;
    }

    const kostenstellenById = new Map(kostenstellenOverview.kostenstellen.map((kostenstelle) => [kostenstelle._id, kostenstelle]));
    const ausgabenpunkteById = new Map(kostenstellenOverview.kostenstellen.flatMap((kostenstelle) => flattenPoints(kostenstelle.ausgabenpunkte)).map((point) => [point._id, point]));
    const kontenById = new Map(kontenplan.map((konto) => [konto._id, konto]));
    const gegenkontoOptionen = kontenplan.filter((konto) => (typ === "ausgabe" ? konto.typ === "expense" : konto.typ === "income"));
    const kassenkonto = kasse.buchhaltungKontoId ? kontenById.get(kasse.buchhaltungKontoId) : undefined;

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
                        {kassenkonto && (
                            <p className="text-sm text-muted-foreground">
                                SKR42-Liquiditätskonto: {kassenkonto.nummer} · {kassenkonto.name}
                            </p>
                        )}
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
                                    {buchhaltungOverview.kontenrahmen === "skr42" && (
                                        <div className="grid gap-2">
                                            <Label htmlFor="gegenkonto">SKR42-Gegenkonto</Label>
                                            <Select value={gegenkontoId} onValueChange={(value) => setGegenkontoId(value as Id<"buchhaltung_konto">)}>
                                                <SelectTrigger id="gegenkonto">
                                                    <SelectValue placeholder={typ === "ausgabe" ? "Aufwandskonto wählen" : "Ertragskonto wählen"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {gegenkontoOptionen.map((konto) => (
                                                        <SelectItem key={konto._id} value={konto._id}>
                                                            {konto.nummer} · {konto.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                    {typ === "ausgabe" && (
                                        <KostenstellenSelector
                                            vereinId={vereinId}
                                            kostenstelleId={kostenstelleId}
                                            ausgabenpunktId={ausgabenpunktId}
                                            onChange={({ kostenstelleId: nextKostenstelleId, ausgabenpunktId: nextAusgabenpunktId }) => {
                                                setKostenstelleId(nextKostenstelleId);
                                                setAusgabenpunktId(nextAusgabenpunktId);
                                            }}
                                        />
                                    )}
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

                        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                                <DialogHeader>
                                    <DialogTitle>Buchung einer Kostenstelle zuordnen</DialogTitle>
                                    <DialogDescription>Ordne die Ausgabe einem Ausgabenpunkt zu oder entferne die Zuordnung wieder.</DialogDescription>
                                </DialogHeader>
                                <KostenstellenSelector
                                    vereinId={vereinId}
                                    kostenstelleId={assignKostenstelleId}
                                    ausgabenpunktId={assignAusgabenpunktId}
                                    compact
                                    onlyActive={false}
                                    onChange={({ kostenstelleId: nextKostenstelleId, ausgabenpunktId: nextAusgabenpunktId }) => {
                                        setAssignKostenstelleId(nextKostenstelleId);
                                        setAssignAusgabenpunktId(nextAusgabenpunktId);
                                    }}
                                />
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setAssignKostenstelleId(undefined);
                                            setAssignAusgabenpunktId(undefined);
                                        }}
                                    >
                                        Zuordnung entfernen
                                    </Button>
                                    <Button onClick={handleAssignBuchung}>Speichern</Button>
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
                                    <TableHead>SKR42</TableHead>
                                    <TableHead>Mitglied</TableHead>
                                    <TableHead>Beitragssatz</TableHead>
                                    <TableHead>Kostenstelle</TableHead>
                                    <TableHead className="text-right">Betrag</TableHead>
                                    <TableHead className="w-[220px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {buchungen.map((buchung) => {
                                    return (
                                        <TableRow key={buchung._id}>
                                            <TableCell>
                                                {format(new Date(buchung.datum), "dd.MM.yyyy")}
                                                <TableCell>
                                                    {buchung.sollKontoId && buchung.habenKontoId
                                                        ? `Soll ${kontenById.get(buchung.sollKontoId)?.nummer ?? "-"} / Haben ${kontenById.get(buchung.habenKontoId)?.nummer ?? "-"}`
                                                        : "-"}
                                                </TableCell>
                                            </TableCell>
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
                                            <TableCell>
                                                {buchung.kostenstelleId
                                                    ? `${kostenstellenById.get(buchung.kostenstelleId)?.name ?? "Unbekannt"}${buchung.ausgabenpunktId ? ` · ${ausgabenpunkteById.get(buchung.ausgabenpunktId)?.name ?? "Unbekannt"}` : ""}`
                                                    : "-"}
                                            </TableCell>
                                            <TableCell className={`text-right font-medium ${buchung.betrag < 0 ? "text-red-500" : "text-green-500"}`}>
                                                {buchung.betrag > 0 ? "+" : ""}
                                                {buchung.betrag.toFixed(2)} {kasse.waehrung}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-2">
                                                    {buchung.betrag < 0 && (
                                                        <Button variant="outline" size="sm" onClick={() => handleOpenAssignDialog(buchung._id, buchung.kostenstelleId, buchung.ausgabenpunktId)}>
                                                            Kostenstelle
                                                        </Button>
                                                    )}
                                                    <Button variant="outline" size="sm" onClick={() => router.push(`/verein/${vereinId}/finanzen/${kasseId}/rechnungen/${buchung._id}`)}>
                                                        Rechnungen
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => handleDeleteBuchung(buchung._id)}>
                                                        X
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {buchungen.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={10} className="h-24 text-center">
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

function flattenPoints<T extends { children: T[] }>(points: T[]): T[] {
    return points.flatMap((point) => [point, ...flattenPoints(point.children)]);
}
