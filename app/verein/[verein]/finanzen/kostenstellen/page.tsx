"use client";

import { KostenstellenDashboard } from "@/components/verein/kostenstellen/KostenstellenDashboard";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function formatCurrency(value: number, waehrung = "EUR") {
    return `${value.toFixed(2)} ${waehrung}`;
}

function getStatusLabel(status: "ok" | "warning" | "overspent" | "overplanned") {
    switch (status) {
        case "overspent":
            return "Über Budget";
        case "overplanned":
            return "Überplant";
        case "warning":
            return "Knapp";
        default:
            return "Im Plan";
    }
}

export default function KostenstellenPage() {
    const params = useParams();
    const router = useRouter();
    const vereinId = params.verein as Id<"verein">;

    const overview = useQuery(api.kostenstellen.getOverview, { vereinId });
    const createKostenstelle = useMutation(api.kostenstellen.createKostenstelle);
    const updateKostenstelle = useMutation(api.kostenstellen.updateKostenstelle);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editId, setEditId] = useState<Id<"kostenstelle"> | undefined>(undefined);
    const [name, setName] = useState("");
    const [budget, setBudget] = useState("");
    const [waehrungInput, setWaehrungInput] = useState("EUR");
    const [beschreibung, setBeschreibung] = useState("");
    const [startDatum, setStartDatum] = useState("");
    const [endDatum, setEndDatum] = useState("");
    const [aktiv, setAktiv] = useState(true);

    const editKostenstelle = useMemo(() => overview?.kostenstellen.find((entry) => entry._id === editId), [editId, overview]);

    const openCreate = () => {
        setEditId(undefined);
        setName("");
        setBudget("");
        setWaehrungInput("EUR");
        setBeschreibung("");
        setStartDatum("");
        setEndDatum("");
        setAktiv(true);
        setDialogOpen(true);
    };

    const openEdit = (kostenstelleId: Id<"kostenstelle">) => {
        const entry = overview?.kostenstellen.find((candidate) => candidate._id === kostenstelleId);
        if (!entry) {
            return;
        }

        setEditId(kostenstelleId);
        setName(entry.name);
        setBudget(entry.budget.toFixed(2));
        setWaehrungInput(entry.waehrung);
        setBeschreibung(entry.beschreibung ?? "");
        setStartDatum(entry.startDatum ? entry.startDatum.slice(0, 10) : "");
        setEndDatum(entry.endDatum ? entry.endDatum.slice(0, 10) : "");
        setAktiv(entry.aktiv);
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        const parsedBudget = Number.parseFloat(budget);
        if (!name.trim() || Number.isNaN(parsedBudget) || parsedBudget < 0) {
            toast.error("Bitte Namen und gültiges Budget angeben");
            return;
        }

        try {
            if (editId) {
                await updateKostenstelle({
                    kostenstelleId: editId,
                    name,
                    budget: parsedBudget,
                    waehrung: waehrungInput,
                    beschreibung: beschreibung || undefined,
                    startDatum: startDatum ? new Date(`${startDatum}T00:00:00`).toISOString() : undefined,
                    endDatum: endDatum ? new Date(`${endDatum}T00:00:00`).toISOString() : undefined,
                    aktiv,
                });
                toast.success("Kostenstelle aktualisiert");
            } else {
                await createKostenstelle({
                    vereinId,
                    name,
                    budget: parsedBudget,
                    waehrung: waehrungInput,
                    beschreibung: beschreibung || undefined,
                    startDatum: startDatum ? new Date(`${startDatum}T00:00:00`).toISOString() : undefined,
                    endDatum: endDatum ? new Date(`${endDatum}T00:00:00`).toISOString() : undefined,
                    aktiv,
                });
                toast.success("Kostenstelle angelegt");
            }

            setDialogOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Kostenstelle konnte nicht gespeichert werden");
        }
    };

    if (overview === undefined) {
        return <div>Lade Kostenstellen…</div>;
    }

    const waehrung = overview.kostenstellen[0]?.waehrung ?? "EUR";

    return (
        <>
            <SiteHeader title="Kostenstellen" />
            <div className="space-y-6 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Kostenstellen Management</h2>
                        <p className="text-muted-foreground">Lege Projektbudgets fest, verteile geplante Ausgaben und finde ungeklärte Buchungen schneller.</p>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={openCreate}>+ Kostenstelle anlegen</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editKostenstelle ? "Kostenstelle bearbeiten" : "Neue Kostenstelle"}</DialogTitle>
                                <DialogDescription>Definiere den finanziellen Rahmen für ein Projekt oder Vorhaben.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="kostenstelle-name">Name</Label>
                                    <Input id="kostenstelle-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="z. B. Sommerfest 2026" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="kostenstelle-budget">Budget</Label>
                                        <Input id="kostenstelle-budget" type="number" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="0.00" />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="kostenstelle-waehrung">Währung</Label>
                                        <Input id="kostenstelle-waehrung" value={waehrungInput} onChange={(event) => setWaehrungInput(event.target.value)} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="kostenstelle-start">Startdatum</Label>
                                        <Input id="kostenstelle-start" type="date" value={startDatum} onChange={(event) => setStartDatum(event.target.value)} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="kostenstelle-ende">Enddatum</Label>
                                        <Input id="kostenstelle-ende" type="date" value={endDatum} onChange={(event) => setEndDatum(event.target.value)} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="kostenstelle-beschreibung">Beschreibung</Label>
                                    <Textarea
                                        id="kostenstelle-beschreibung"
                                        value={beschreibung}
                                        onChange={(event) => setBeschreibung(event.target.value)}
                                        placeholder="Wofür wird das Budget verwendet?"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox id="kostenstelle-aktiv" checked={aktiv} onCheckedChange={(checked) => setAktiv(Boolean(checked))} />
                                    <Label htmlFor="kostenstelle-aktiv">Kostenstelle ist aktiv</Label>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSubmit}>{editKostenstelle ? "Speichern" : "Anlegen"}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <KostenstellenDashboard dashboard={overview.dashboard} waehrung={waehrung} />

                <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <div className="grid gap-4 md:grid-cols-2">
                        {overview.kostenstellen.map((kostenstelle) => {
                            const spentPercent = kostenstelle.budget <= 0 ? 0 : Math.min(100, Math.max(0, (kostenstelle.spentTotal / kostenstelle.budget) * 100));
                            const plannedPercent = kostenstelle.budget <= 0 ? 0 : Math.min(100, Math.max(0, (kostenstelle.plannedBudget / kostenstelle.budget) * 100));

                            return (
                                <Card key={kostenstelle._id} className={!kostenstelle.aktiv ? "opacity-70" : ""}>
                                    <CardHeader className="space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <CardTitle>{kostenstelle.name}</CardTitle>
                                                <CardDescription>{kostenstelle.beschreibung || "Noch keine Beschreibung hinterlegt."}</CardDescription>
                                            </div>
                                            <Badge variant={kostenstelle.status === "ok" ? "secondary" : "destructive"}>{getStatusLabel(kostenstelle.status)}</Badge>
                                        </div>
                                        <div className="grid gap-1 text-sm text-muted-foreground">
                                            <div className="flex items-center justify-between">
                                                <span>Budget</span>
                                                <span>{formatCurrency(kostenstelle.budget, kostenstelle.waehrung)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Verplant</span>
                                                <span>{formatCurrency(kostenstelle.plannedBudget, kostenstelle.waehrung)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Bereits verbraucht</span>
                                                <span>{formatCurrency(kostenstelle.spentTotal, kostenstelle.waehrung)}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span>Restbudget</span>
                                                <span>{formatCurrency(kostenstelle.remainingBudget, kostenstelle.waehrung)}</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                <span>Planung</span>
                                                <span>{plannedPercent.toFixed(0)}%</span>
                                            </div>
                                            <Progress value={plannedPercent} />
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                <span>Verbrauch</span>
                                                <span>{spentPercent.toFixed(0)}%</span>
                                            </div>
                                            <Progress value={spentPercent} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-lg border p-3">
                                                <div className="text-muted-foreground">Ausgabenpunkte</div>
                                                <div className="text-lg font-semibold">{kostenstelle.ausgabenpunktCount}</div>
                                            </div>
                                            <div className="rounded-lg border p-3">
                                                <div className="text-muted-foreground">Buchungen</div>
                                                <div className="text-lg font-semibold">{kostenstelle.bookingCount}</div>
                                            </div>
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex items-center justify-between gap-2">
                                        <Button variant="outline" onClick={() => openEdit(kostenstelle._id)}>
                                            Bearbeiten
                                        </Button>
                                        <Button onClick={() => router.push(`/verein/${vereinId}/finanzen/kostenstellen/${kostenstelle._id}`)}>Details</Button>
                                    </CardFooter>
                                </Card>
                            );
                        })}
                        {overview.kostenstellen.length === 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Noch keine Kostenstellen</CardTitle>
                                    <CardDescription>Starte mit einem Projektbudget und verteile danach die geplanten Ausgaben auf Ausgabenpunkte.</CardDescription>
                                </CardHeader>
                            </Card>
                        )}
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Offene Ausgaben ohne Zuordnung</CardTitle>
                            <CardDescription>Diese Buchungen sollten einem Ausgabenpunkt zugeordnet werden, damit das Dashboard vollständig ist.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Datum</TableHead>
                                        <TableHead>Zweck</TableHead>
                                        <TableHead>Konto</TableHead>
                                        <TableHead className="text-right">Betrag</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {overview.recentUnassignedExpenses.map((buchung) => (
                                        <TableRow key={buchung._id}>
                                            <TableCell>{new Date(buchung.datum).toLocaleDateString("de-DE")}</TableCell>
                                            <TableCell>{buchung.zweck}</TableCell>
                                            <TableCell>{buchung.kasseName}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(Math.abs(buchung.betrag), waehrung)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {overview.recentUnassignedExpenses.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                Alle Ausgaben sind bereits zugeordnet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}
