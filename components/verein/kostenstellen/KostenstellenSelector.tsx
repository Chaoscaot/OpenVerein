"use client";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { KostenstellenDashboard } from "@/components/verein/kostenstellen/KostenstellenDashboard";

function flattenPoints<
    T extends {
        _id: string;
        name: string;
        depth: number;
        remainingBudget: number;
        spentTotal: number;
        status: string;
        children: T[];
    },
>(points: T[]): T[] {
    return points.flatMap((point) => [point, ...flattenPoints(point.children)]);
}

function formatCurrency(value: number, waehrung = "EUR") {
    return `${value.toFixed(2)} ${waehrung}`;
}

const EMPTY_SELECTION = "__none__";

export function KostenstellenSelector({
    vereinId,
    kostenstelleId,
    ausgabenpunktId,
    onChange,
    disabled,
    onlyActive = true,
    compact = false,
}: {
    vereinId: Id<"verein">;
    kostenstelleId?: Id<"kostenstelle">;
    ausgabenpunktId?: Id<"kostenstelle_ausgabenpunkt">;
    onChange: (value: { kostenstelleId?: Id<"kostenstelle">; ausgabenpunktId?: Id<"kostenstelle_ausgabenpunkt"> }) => void;
    disabled?: boolean;
    onlyActive?: boolean;
    compact?: boolean;
}) {
    const overview = useQuery(api.kostenstellen.getOverview, {
        vereinId,
        onlyActive,
    });

    if (overview === undefined) {
        return <div className="text-sm text-muted-foreground">Lade Kostenstellen…</div>;
    }

    const selectedKostenstelle = overview.kostenstellen.find((entry) => entry._id === kostenstelleId);
    const flatSelectedPoints = selectedKostenstelle ? flattenPoints(selectedKostenstelle.ausgabenpunkte) : [];
    const selectedPoint = flatSelectedPoints.find((point) => point._id === ausgabenpunktId);
    const waehrung = overview.kostenstellen[0]?.waehrung ?? "EUR";
    const currentValue = ausgabenpunktId ?? EMPTY_SELECTION;

    return (
        <div className="space-y-4">
            <KostenstellenDashboard dashboard={overview.dashboard} waehrung={waehrung} compact={compact} />

            <div className={compact ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]" : "grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"}>
                <div className="grid min-w-0 gap-2">
                    <Label>Ausgabenpunkt</Label>
                    <Select
                        value={currentValue}
                        onValueChange={(value) => {
                            if (value === EMPTY_SELECTION) {
                                onChange({
                                    kostenstelleId: undefined,
                                    ausgabenpunktId: undefined,
                                });
                                return;
                            }

                            for (const entry of overview.kostenstellen) {
                                const point = flattenPoints(entry.ausgabenpunkte).find((candidate) => candidate._id === value);
                                if (point) {
                                    onChange({
                                        kostenstelleId: entry._id,
                                        ausgabenpunktId: point._id,
                                    });
                                    return;
                                }
                            }
                        }}
                        disabled={disabled || overview.kostenstellen.length === 0}
                    >
                        <SelectTrigger className="w-full min-w-0">
                            <SelectValue placeholder="Ausgabenpunkt wählen…" />
                        </SelectTrigger>
                        <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
                            <SelectItem value={EMPTY_SELECTION}>Keine Zuordnung</SelectItem>
                            {overview.kostenstellen.map((entry) => (
                                <SelectGroup key={entry._id}>
                                    <SelectLabel>{entry.name}</SelectLabel>
                                    {flattenPoints(entry.ausgabenpunkte).map((point) => (
                                        <SelectItem key={point._id} value={point._id}>
                                            {`${"— ".repeat(point.depth)}${point.name} · ${formatCurrency(point.remainingBudget, entry.waehrung)} frei`}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        {onlyActive ? "Es werden nur aktive Kostenstellen angeboten." : "Auch inaktive Kostenstellen werden angezeigt, damit bestehende Zuordnungen nachvollziehbar bleiben."} Buchungen
                        ohne Zuordnung tauchen im Dashboard als offener Klärungsbedarf auf.
                    </p>
                </div>

                <Card className="min-w-0">
                    <CardHeader className="pb-2">
                        <CardDescription>Aktuelle Auswahl</CardDescription>
                        <CardTitle className="break-words text-xl leading-tight">{selectedPoint?.name ?? "Noch kein Ausgabenpunkt"}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        {selectedKostenstelle ? (
                            <>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Kostenstelle</span>
                                    <span className="font-medium">{selectedKostenstelle.name}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Restbudget</span>
                                    <span>{formatCurrency(selectedPoint?.remainingBudget ?? selectedKostenstelle.remainingBudget, selectedKostenstelle.waehrung)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Verbrauch</span>
                                    <span>{formatCurrency(selectedPoint?.spentTotal ?? selectedKostenstelle.spentTotal, selectedKostenstelle.waehrung)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Status</span>
                                    <Badge variant={(selectedPoint?.status ?? selectedKostenstelle.status) === "ok" ? "secondary" : "destructive"}>
                                        {(selectedPoint?.status ?? selectedKostenstelle.status) === "overspent"
                                            ? "Über Budget"
                                            : (selectedPoint?.status ?? selectedKostenstelle.status) === "overplanned"
                                              ? "Überplant"
                                              : (selectedPoint?.status ?? selectedKostenstelle.status) === "warning"
                                                ? "Knapp"
                                                : "Im Plan"}
                                    </Badge>
                                </div>
                            </>
                        ) : (
                            <p className="text-muted-foreground">Wähle einen Ausgabenpunkt, um Budget, Verbrauch und Rest direkt im Buchungsdialog zu sehen.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
