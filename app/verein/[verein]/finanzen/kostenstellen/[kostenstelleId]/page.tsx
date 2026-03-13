"use client";

import { KostenstellenDashboard } from "@/components/verein/kostenstellen/KostenstellenDashboard";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type DetailPoint = {
    _id: Id<"kostenstelle_ausgabenpunkt">;
    parentId?: Id<"kostenstelle_ausgabenpunkt">;
    name: string;
    beschreibung?: string;
    budget: number;
    spentTotal: number;
    remainingBudget: number;
    childBudgetTotal: number;
    unallocatedBudget: number;
    bookingCountTotal: number;
    utilizationPercent: number;
    depth: number;
    status: "ok" | "warning" | "overspent" | "overplanned";
    children: DetailPoint[];
};

function flattenPoints(points: DetailPoint[]): DetailPoint[] {
    return points.flatMap((point) => [point, ...flattenPoints(point.children)]);
}

const ROOT_PARENT = "__root__";

export default function KostenstelleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const vereinId = params.verein as Id<"verein">;
    const kostenstelleId = params.kostenstelleId as Id<"kostenstelle">;

    const detail = useQuery(api.kostenstellen.getDetail, { kostenstelleId });
    const updateKostenstelle = useMutation(api.kostenstellen.updateKostenstelle);
    const deleteKostenstelle = useMutation(api.kostenstellen.deleteKostenstelle);
    const createAusgabenpunkt = useMutation(api.kostenstellen.createAusgabenpunkt);
    const updateAusgabenpunkt = useMutation(api.kostenstellen.updateAusgabenpunkt);
    const deleteAusgabenpunkt = useMutation(api.kostenstellen.deleteAusgabenpunkt);

    const [kostenstelleDialogOpen, setKostenstelleDialogOpen] = useState(false);
    const [pointDialogOpen, setPointDialogOpen] = useState(false);
    const [pointDeleteOpen, setPointDeleteOpen] = useState(false);
    const [editPointId, setEditPointId] = useState<Id<"kostenstelle_ausgabenpunkt"> | undefined>(undefined);
    const [pendingDeletePointId, setPendingDeletePointId] = useState<Id<"kostenstelle_ausgabenpunkt"> | undefined>(undefined);

    const [name, setName] = useState("");
    const [budget, setBudget] = useState("");
    const [waehrung, setWaehrung] = useState("EUR");
    const [beschreibung, setBeschreibung] = useState("");
    const [startDatum, setStartDatum] = useState("");
    const [endDatum, setEndDatum] = useState("");
    const [aktiv, setAktiv] = useState(true);

    const [pointName, setPointName] = useState("");
    const [pointBudget, setPointBudget] = useState("");
    const [pointBeschreibung, setPointBeschreibung] = useState("");
    const [pointParentId, setPointParentId] = useState<string>(ROOT_PARENT);

    const kostenstelle = detail?.kostenstelle;
    const flattenedPoints = useMemo(() => (kostenstelle ? flattenPoints(kostenstelle.ausgabenpunkte) : []), [kostenstelle]);
    const editPoint = flattenedPoints.find((point) => point._id === editPointId);

    const openKostenstelleEdit = () => {
        if (!kostenstelle) {
            return;
        }

        setName(kostenstelle.name);
        setBudget(kostenstelle.budget.toFixed(2));
        setWaehrung(kostenstelle.waehrung);
        setBeschreibung(kostenstelle.beschreibung ?? "");
        setStartDatum(kostenstelle.startDatum ? kostenstelle.startDatum.slice(0, 10) : "");
        setEndDatum(kostenstelle.endDatum ? kostenstelle.endDatum.slice(0, 10) : "");
        setAktiv(kostenstelle.aktiv);
        setKostenstelleDialogOpen(true);
    };

    const openCreatePoint = (parentId?: Id<"kostenstelle_ausgabenpunkt">) => {
        setEditPointId(undefined);
        setPointName("");
        setPointBudget("");
        setPointBeschreibung("");
        setPointParentId(parentId ?? ROOT_PARENT);
        setPointDialogOpen(true);
    };

    const openEditPoint = (pointId: Id<"kostenstelle_ausgabenpunkt">) => {
        const point = flattenedPoints.find((entry) => entry._id === pointId);
        if (!point) {
            return;
        }

        setEditPointId(pointId);
        setPointName(point.name);
        setPointBudget(point.budget.toFixed(2));
        setPointBeschreibung(point.beschreibung ?? "");
        setPointParentId(point.parentId ?? ROOT_PARENT);
        setPointDialogOpen(true);
    };

    const handleSaveKostenstelle = async () => {
        const parsedBudget = Number.parseFloat(budget);
        if (!kostenstelle || !name.trim() || Number.isNaN(parsedBudget) || parsedBudget < 0) {
            toast.error("Bitte gültige Stammdaten angeben");
            return;
        }

        try {
            await updateKostenstelle({
                kostenstelleId: kostenstelle._id,
                name,
                budget: parsedBudget,
                waehrung,
                beschreibung: beschreibung || undefined,
                startDatum: startDatum ? new Date(`${startDatum}T00:00:00`).toISOString() : undefined,
                endDatum: endDatum ? new Date(`${endDatum}T00:00:00`).toISOString() : undefined,
                aktiv,
            });
            setKostenstelleDialogOpen(false);
            toast.success("Kostenstelle aktualisiert");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Kostenstelle konnte nicht gespeichert werden");
        }
    };

    const handleDeleteKostenstelle = async () => {
        if (!kostenstelle) {
            return;
        }

        try {
            await deleteKostenstelle({ kostenstelleId: kostenstelle._id });
            toast.success("Kostenstelle gelöscht");
            router.push(`/verein/${vereinId}/finanzen/kostenstellen`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Kostenstelle konnte nicht gelöscht werden");
        }
    };

    const handleSavePoint = async () => {
        const parsedBudget = Number.parseFloat(pointBudget);
        if (!kostenstelle || !pointName.trim() || Number.isNaN(parsedBudget) || parsedBudget < 0) {
            toast.error("Bitte gültige Daten für den Ausgabenpunkt angeben");
            return;
        }

        try {
            if (editPointId) {
                await updateAusgabenpunkt({
                    ausgabenpunktId: editPointId,
                    name: pointName,
                    budget: parsedBudget,
                    beschreibung: pointBeschreibung || undefined,
                    parentId: pointParentId === ROOT_PARENT ? null : (pointParentId as Id<"kostenstelle_ausgabenpunkt">),
                });
                toast.success("Ausgabenpunkt aktualisiert");
            } else {
                await createAusgabenpunkt({
                    kostenstelleId: kostenstelle._id,
                    name: pointName,
                    budget: parsedBudget,
                    beschreibung: pointBeschreibung || undefined,
                    parentId: pointParentId === ROOT_PARENT ? undefined : (pointParentId as Id<"kostenstelle_ausgabenpunkt">),
                });
                toast.success("Ausgabenpunkt angelegt");
            }
            setPointDialogOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Ausgabenpunkt konnte nicht gespeichert werden");
        }
    };

    const handleDeletePoint = async () => {
        if (!pendingDeletePointId) {
            return;
        }

        try {
            await deleteAusgabenpunkt({ ausgabenpunktId: pendingDeletePointId });
            setPointDeleteOpen(false);
            setPendingDeletePointId(undefined);
            toast.success("Ausgabenpunkt gelöscht");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Ausgabenpunkt konnte nicht gelöscht werden");
        }
    };

    if (detail === undefined) {
        return <div>Lade Kostenstelle…</div>;
    }

    if (!kostenstelle) {
        return <div>Kostenstelle nicht gefunden</div>;
    }

    const pointParentOptions = flattenedPoints.filter((point) => point._id !== editPointId);

    return (
        <>
            <SiteHeader title={kostenstelle.name} />
            <div className="space-y-6 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="space-y-1">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/verein/${vereinId}/finanzen/kostenstellen`)}>
                            ← Zurück zur Übersicht
                        </Button>
                        <h2 className="text-3xl font-bold tracking-tight">{kostenstelle.name}</h2>
                        <p className="text-muted-foreground">{kostenstelle.beschreibung || "Verteile das Budget auf Ausgabenpunkte und prüfe den Verbrauch in Echtzeit."}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" onClick={openKostenstelleEdit}>
                            Kostenstelle bearbeiten
                        </Button>
                        <Button onClick={() => openCreatePoint()}>+ Ausgabenpunkt</Button>
                        <Button variant="destructive" onClick={handleDeleteKostenstelle}>
                            Löschen
                        </Button>
                    </div>
                </div>

                <KostenstellenDashboard
                    waehrung={kostenstelle.waehrung}
                    dashboard={{
                        totalBudget: kostenstelle.budget,
                        plannedBudget: kostenstelle.plannedBudget,
                        assignedSpent: kostenstelle.spentTotal,
                        remainingBudget: kostenstelle.remainingBudget,
                        unallocatedBudget: kostenstelle.unallocatedBudget,
                        assignedExpenseCount: kostenstelle.bookingCount,
                        unassignedExpenseCount: 0,
                        atRiskCount: kostenstelle.status === "ok" ? 0 : 1,
                        costCenterCount: 1,
                        activeCount: kostenstelle.aktiv ? 1 : 0,
                    }}
                />

                <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Budgetbaum</CardTitle>
                            <CardDescription>Unterteile das Gesamtbudget nach Phasen, Gewerken oder Aufgabenpaketen.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {kostenstelle.ausgabenpunkte.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Ausgabenpunkte vorhanden.</p>}
                            {kostenstelle.ausgabenpunkte.map((point) => (
                                <BudgetNodeCard
                                    key={point._id}
                                    point={point}
                                    waehrung={kostenstelle.waehrung}
                                    onCreateChild={openCreatePoint}
                                    onEdit={openEditPoint}
                                    onDelete={(id) => {
                                        setPendingDeletePointId(id);
                                        setPointDeleteOpen(true);
                                    }}
                                />
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Steuerung</CardTitle>
                            <CardDescription>Wichtige Kennzahlen für diese Kostenstelle.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <Badge variant={kostenstelle.status === "ok" ? "secondary" : "destructive"}>{getStatusLabel(kostenstelle.status)}</Badge>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Budget</span>
                                <span>{formatCurrency(kostenstelle.budget, kostenstelle.waehrung)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Noch nicht verplant</span>
                                <span>{formatCurrency(kostenstelle.unallocatedBudget, kostenstelle.waehrung)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Ausgabenpunkte</span>
                                <span>{kostenstelle.ausgabenpunktCount}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Zugeordnete Buchungen</span>
                                <span>{kostenstelle.bookingCount}</span>
                            </div>
                            <div className="rounded-lg border p-3 text-muted-foreground">
                                <p className="font-medium text-foreground">Workflow</p>
                                <ol className="mt-2 space-y-1 list-decimal pl-4">
                                    <li>Gesamtbudget festlegen</li>
                                    <li>Ausgabenpunkte planen</li>
                                    <li>Buchungen im Konto zuordnen</li>
                                </ol>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Zugeordnete Buchungen</CardTitle>
                        <CardDescription>Diese Ausgaben fließen bereits in das Budget dieser Kostenstelle ein.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Datum</TableHead>
                                    <TableHead>Zweck</TableHead>
                                    <TableHead>Konto</TableHead>
                                    <TableHead>Ausgabenpunkt</TableHead>
                                    <TableHead className="text-right">Betrag</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detail.assignedBookings.map((buchung) => (
                                    <TableRow key={buchung._id}>
                                        <TableCell>{new Date(buchung.datum).toLocaleDateString("de-DE")}</TableCell>
                                        <TableCell>{buchung.zweck}</TableCell>
                                        <TableCell>{buchung.kasseName}</TableCell>
                                        <TableCell>{buchung.ausgabenpunktName ?? "-"}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(Math.abs(buchung.betrag), kostenstelle.waehrung)}</TableCell>
                                    </TableRow>
                                ))}
                                {detail.assignedBookings.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Noch keine Buchungen zugeordnet.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={kostenstelleDialogOpen} onOpenChange={setKostenstelleDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Kostenstelle bearbeiten</DialogTitle>
                        <DialogDescription>Aktualisiere Budget, Zeitrahmen und Sichtbarkeit.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="ks-name">Name</Label>
                            <Input id="ks-name" value={name} onChange={(event) => setName(event.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="ks-budget">Budget</Label>
                                <Input id="ks-budget" type="number" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="ks-waehrung">Währung</Label>
                                <Input id="ks-waehrung" value={waehrung} onChange={(event) => setWaehrung(event.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="ks-start">Startdatum</Label>
                                <Input id="ks-start" type="date" value={startDatum} onChange={(event) => setStartDatum(event.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="ks-ende">Enddatum</Label>
                                <Input id="ks-ende" type="date" value={endDatum} onChange={(event) => setEndDatum(event.target.value)} />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="ks-beschreibung">Beschreibung</Label>
                            <Textarea id="ks-beschreibung" value={beschreibung} onChange={(event) => setBeschreibung(event.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="ks-aktiv" checked={aktiv} onCheckedChange={(checked) => setAktiv(Boolean(checked))} />
                            <Label htmlFor="ks-aktiv">Kostenstelle ist aktiv</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveKostenstelle}>Speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={pointDialogOpen} onOpenChange={setPointDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editPoint ? "Ausgabenpunkt bearbeiten" : "Ausgabenpunkt anlegen"}</DialogTitle>
                        <DialogDescription>Strukturiere die geplanten Ausgaben so fein oder grob, wie dein Projekt es braucht.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="point-name">Name</Label>
                            <Input id="point-name" value={pointName} onChange={(event) => setPointName(event.target.value)} placeholder="z. B. Catering" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="point-budget">Budget</Label>
                            <Input id="point-budget" type="number" step="0.01" value={pointBudget} onChange={(event) => setPointBudget(event.target.value)} placeholder="0.00" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Übergeordneter Punkt</Label>
                            <Select value={pointParentId} onValueChange={setPointParentId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Root wählen" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={ROOT_PARENT}>Direkt unter der Kostenstelle</SelectItem>
                                    {pointParentOptions.map((point) => (
                                        <SelectItem key={point._id} value={point._id}>
                                            {`${"— ".repeat(point.depth)}${point.name}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="point-description">Beschreibung</Label>
                            <Textarea id="point-description" value={pointBeschreibung} onChange={(event) => setPointBeschreibung(event.target.value)} placeholder="Optional" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSavePoint}>{editPoint ? "Speichern" : "Anlegen"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={pointDeleteOpen} onOpenChange={setPointDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Ausgabenpunkt löschen?</DialogTitle>
                        <DialogDescription>Das ist nur möglich, wenn keine Unterpunkte und keine zugeordneten Buchungen mehr existieren.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPointDeleteOpen(false)}>
                            Abbrechen
                        </Button>
                        <Button variant="destructive" onClick={handleDeletePoint}>
                            Löschen
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function BudgetNodeCard({
    point,
    waehrung,
    onCreateChild,
    onEdit,
    onDelete,
}: {
    point: DetailPoint;
    waehrung: string;
    onCreateChild: (parentId?: Id<"kostenstelle_ausgabenpunkt">) => void;
    onEdit: (id: Id<"kostenstelle_ausgabenpunkt">) => void;
    onDelete: (id: Id<"kostenstelle_ausgabenpunkt">) => void;
}) {
    return (
        <div className="space-y-4 rounded-xl border p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{point.name}</h3>
                        <Badge variant={point.status === "ok" ? "secondary" : "destructive"}>{getStatusLabel(point.status)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{point.beschreibung || "Kein Detailtext hinterlegt."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(point._id)}>
                        Bearbeiten
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => onCreateChild(point._id)}>
                        Unterpunkt
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={() => onDelete(point._id)}>
                        Löschen
                    </Button>
                </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4 text-sm">
                <MetricCard label="Budget" value={formatCurrency(point.budget, waehrung)} />
                <MetricCard label="Verbraucht" value={formatCurrency(point.spentTotal, waehrung)} />
                <MetricCard label="Rest" value={formatCurrency(point.remainingBudget, waehrung)} />
                <MetricCard label="Kinderbudget" value={formatCurrency(point.childBudgetTotal, waehrung)} />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Budgetauslastung</span>
                    <span>{point.utilizationPercent.toFixed(0)}%</span>
                </div>
                <Progress value={point.utilizationPercent} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>{point.bookingCountTotal} zugeordnete Buchungen</span>
                <span>{formatCurrency(point.unallocatedBudget, waehrung)} frei im Unterbaum</span>
            </div>
            {point.children.length > 0 && (
                <div className="space-y-3 border-l pl-4">
                    {point.children.map((child) => (
                        <BudgetNodeCard key={child._id} point={child} waehrung={waehrung} onCreateChild={onCreateChild} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MetricCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">{label}</div>
            <div className="text-base font-semibold">{value}</div>
        </div>
    );
}
