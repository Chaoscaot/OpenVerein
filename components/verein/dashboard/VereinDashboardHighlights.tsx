"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CelebrationItem, FinanceOverviewSummary, MemberStatGroup } from "@/lib/verein-dashboard";

type InvoiceUploadKasse = {
    id: string;
    name: string;
    currency: string;
    bookings: Array<{
        id: string;
        date: string;
        purpose: string;
        amount: number;
        currency: string;
        href: string;
    }>;
};

type VereinDashboardHighlightsProps = {
    canViewMembers: boolean;
    canViewFinance: boolean;
    memberGroups: MemberStatGroup[];
    finance: FinanceOverviewSummary | null;
    invoiceUpload: {
        fallbackHref: string;
        kassen: InvoiceUploadKasse[];
    };
    celebrations: {
        birthdays: CelebrationItem[];
        anniversaries: CelebrationItem[];
    };
    financeActions: {
        newExpenseHref: string | null;
        newInvoiceHref: string;
    };
};

const chartConfig = {
    income: {
        label: "Einnahmen",
        color: "var(--chart-2)",
    },
    expense: {
        label: "Ausgaben",
        color: "var(--chart-5)",
    },
} satisfies ChartConfig;

function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return "Ohne Datum";
    }

    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
    }).format(parsed);
}

function relationBadgeVariant(relation: CelebrationItem["relation"]) {
    if (relation === "today") {
        return "default" as const;
    }
    if (relation === "past") {
        return "secondary" as const;
    }
    return "outline" as const;
}

function relationLabel(relation: CelebrationItem["relation"]) {
    if (relation === "today") {
        return "Heute";
    }
    if (relation === "past") {
        return "Vergangen";
    }
    return "Demnächst";
}

function CelebrationColumn({ title, description, items }: { title: string; description: string; items: CelebrationItem[] }) {
    return (
        <div className="space-y-3">
            <div>
                <h3 className="font-semibold tracking-tight">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Aktuell ist kein passendes Ereignis verfügbar.</div>
            ) : (
                <div className="space-y-3">
                    {items.map((item) => (
                        <div key={`${title}-${item.id}-${item.relation}`} className="flex items-start justify-between gap-3 rounded-2xl border p-4">
                            <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{item.name}</p>
                                    <Badge variant={relationBadgeVariant(item.relation)}>{relationLabel(item.relation)}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                                <p className="text-sm text-muted-foreground">{item.dateLabel}</p>
                            </div>
                            <Button asChild size="sm" variant="outline">
                                <Link href={item.href}>Profil</Link>
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function VereinDashboardHighlights({ canViewMembers, canViewFinance, memberGroups, finance, invoiceUpload, celebrations, financeActions }: VereinDashboardHighlightsProps) {
    const [memberGroupKey, setMemberGroupKey] = useState(memberGroups[0]?.key ?? "all");
    const [timeRange, setTimeRange] = useState<3 | 6 | 12>(6);
    const [selectedKasseId, setSelectedKasseId] = useState(invoiceUpload.kassen[0]?.id ?? "");
    const [selectedBuchungId, setSelectedBuchungId] = useState(invoiceUpload.kassen[0]?.bookings[0]?.id ?? "");

    useEffect(() => {
        if (!memberGroups.some((group) => group.key === memberGroupKey)) {
            setMemberGroupKey(memberGroups[0]?.key ?? "all");
        }
    }, [memberGroupKey, memberGroups]);

    useEffect(() => {
        if (!invoiceUpload.kassen.some((kasse) => kasse.id === selectedKasseId)) {
            const nextKasseId = invoiceUpload.kassen[0]?.id ?? "";
            setSelectedKasseId(nextKasseId);
            setSelectedBuchungId(invoiceUpload.kassen[0]?.bookings[0]?.id ?? "");
        }
    }, [invoiceUpload.kassen, selectedKasseId]);

    const selectedMemberGroup = memberGroups.find((group) => group.key === memberGroupKey) ?? memberGroups[0] ?? null;
    const selectedKasse = invoiceUpload.kassen.find((kasse) => kasse.id === selectedKasseId) ?? invoiceUpload.kassen[0] ?? null;

    useEffect(() => {
        if (!selectedKasse) {
            setSelectedBuchungId("");
            return;
        }

        if (!selectedKasse.bookings.some((booking) => booking.id === selectedBuchungId)) {
            setSelectedBuchungId(selectedKasse.bookings[0]?.id ?? "");
        }
    }, [selectedBuchungId, selectedKasse]);

    const selectedBuchung = selectedKasse?.bookings.find((booking) => booking.id === selectedBuchungId) ?? selectedKasse?.bookings[0] ?? null;
    const visibleChartData = useMemo(() => finance?.chart.slice(-timeRange) ?? [], [finance?.chart, timeRange]);

    return (
        <div className="space-y-6">
            <Card className="rounded-[2rem]">
                <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1.5">
                        <CardTitle>👥 Mitgliederstatistik</CardTitle>
                        <CardDescription>Kompakte Kennzahlen zum Mitgliederbestand. Die Ansicht schaltet zwischen Gesamt und vorhandenen Gruppen um.</CardDescription>
                    </div>
                    {canViewMembers && memberGroups.length > 0 ? (
                        <div className="w-full md:w-64">
                            <Select value={memberGroupKey} onValueChange={setMemberGroupKey}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Bereich wählen" />
                                </SelectTrigger>
                                <SelectContent>
                                    {memberGroups.map((group) => (
                                        <SelectItem key={group.key} value={group.key}>
                                            {group.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : null}
                </CardHeader>
                <CardContent>
                    {!canViewMembers || !selectedMemberGroup ? (
                        <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Für dieses Konto sind aktuell keine Mitgliederdaten sichtbar.</div>
                    ) : (
                        <div className="space-y-4">
                            {memberGroups.length === 1 ? (
                                <p className="text-sm text-muted-foreground">Weitere Filter erscheinen automatisch, sobald Gruppen oder Abteilungen mit Mitgliedern gepflegt sind.</p>
                            ) : null}
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-3xl border bg-background/80 p-5">
                                    <p className="text-sm text-muted-foreground">Mitglieder gesamt</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-tight">{selectedMemberGroup.summary.totalMembers}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {selectedMemberGroup.summary.activeMembers} aktiv · {selectedMemberGroup.summary.passiveMembers} passiv · {selectedMemberGroup.summary.formerMembers} ehemalig
                                    </p>
                                </div>
                                <div className="rounded-3xl border bg-background/80 p-5">
                                    <p className="text-sm text-muted-foreground">Durchschnittsalter</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-tight">{selectedMemberGroup.summary.averageAge ?? "–"}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Automatisch aus vorhandenen Geburtsdaten berechnet</p>
                                </div>
                                <div className="rounded-3xl border bg-background/80 p-5">
                                    <p className="text-sm text-muted-foreground">Verknüpfte Mitglieder</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-tight">{selectedMemberGroup.summary.linkedMembers}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Mit eigenem Kontozugriff zur Selbstverwaltung</p>
                                </div>
                                <div className="rounded-3xl border bg-background/80 p-5">
                                    <p className="text-sm text-muted-foreground">Kontakte</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-tight">{selectedMemberGroup.summary.contacts}</p>
                                    <p className="mt-2 text-sm text-muted-foreground">Externe Kontakte innerhalb des gewählten Bereichs</p>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
                <Card id="e-rechnung-upload" className="rounded-[2rem]">
                    <CardHeader>
                        <CardTitle>📄 E-Rechnungen hochladen</CardTitle>
                        <CardDescription>Wählen Sie zuerst Kasse und Buchung. Anschließend gelangen Sie direkt in die Upload- und Zuordnungsansicht.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {invoiceUpload.kassen.length === 0 ? (
                            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                                Es ist noch keine Kasse mit Buchungen vorhanden. Öffnen Sie zuerst den Finanzbereich.
                            </div>
                        ) : (
                            <>
                                <div className="grid gap-4">
                                    <div className="grid gap-2">
                                        <p className="text-sm font-medium">Kasse</p>
                                        <Select
                                            value={selectedKasse?.id ?? ""}
                                            onValueChange={(value) => {
                                                setSelectedKasseId(value);
                                                const nextKasse = invoiceUpload.kassen.find((kasse) => kasse.id === value);
                                                setSelectedBuchungId(nextKasse?.bookings[0]?.id ?? "");
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Kasse wählen" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {invoiceUpload.kassen.map((kasse) => (
                                                    <SelectItem key={kasse.id} value={kasse.id}>
                                                        {kasse.name} ({kasse.currency})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <p className="text-sm font-medium">Buchung</p>
                                        <Select value={selectedBuchung?.id ?? ""} onValueChange={setSelectedBuchungId} disabled={!selectedKasse || selectedKasse.bookings.length === 0}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Buchung wählen" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {selectedKasse?.bookings.map((booking) => (
                                                    <SelectItem key={booking.id} value={booking.id}>
                                                        {formatDate(booking.date)} · {booking.purpose}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {selectedBuchung ? (
                                    <div className="rounded-2xl border bg-background/80 p-4">
                                        <p className="font-medium">{selectedBuchung.purpose}</p>
                                        <p className="mt-1 text-sm text-muted-foreground">{formatDate(selectedBuchung.date)}</p>
                                        <p className="mt-2 text-sm text-muted-foreground">Betrag: {formatCurrency(Math.abs(selectedBuchung.amount), selectedBuchung.currency)}</p>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                                        Für die gewählte Kasse existiert noch keine Buchung für eine Rechnungszuordnung.
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-3">
                                    {selectedBuchung ? (
                                        <Button asChild>
                                            <Link href={selectedBuchung.href}>Zur Uploadansicht</Link>
                                        </Button>
                                    ) : (
                                        <Button disabled>Zur Uploadansicht</Button>
                                    )}
                                    <Button asChild variant="outline">
                                        <Link href={invoiceUpload.fallbackHref}>Finanzbereich öffnen</Link>
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem]">
                    <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1.5">
                            <CardTitle>💰 Finanzübersicht</CardTitle>
                            <CardDescription>Kurzstatistik zu Forderungen, Zahlungen, Kontoständen und der Entwicklung von Einnahmen und Ausgaben.</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[3, 6, 12].map((range) => (
                                <Button key={range} size="sm" variant={timeRange === range ? "default" : "outline"} onClick={() => setTimeRange(range as 3 | 6 | 12)}>
                                    {range} Monate
                                </Button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {!canViewFinance || !finance ? (
                            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Für dieses Konto sind aktuell keine Finanzdaten sichtbar.</div>
                        ) : (
                            <div className="space-y-5">
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                    <div className="rounded-3xl border bg-background/80 p-5">
                                        <p className="text-sm text-muted-foreground">Offene Forderungen</p>
                                        <p className="mt-2 text-2xl font-semibold tracking-tight">{formatCurrency(finance.openReceivables, finance.currency)}</p>
                                        <p className="mt-2 text-sm text-muted-foreground">Geschätztes Beitragsvolumen per Rechnung</p>
                                    </div>
                                    <div className="rounded-3xl border bg-background/80 p-5">
                                        <p className="text-sm text-muted-foreground">Anstehende Zahlungen</p>
                                        <p className="mt-2 text-2xl font-semibold tracking-tight">{formatCurrency(finance.upcomingPayments, finance.currency)}</p>
                                        <p className="mt-2 text-sm text-muted-foreground">Geplante Einzüge, Bar- oder Elternzahler</p>
                                    </div>
                                    <div className="rounded-3xl border bg-background/80 p-5">
                                        <p className="text-sm text-muted-foreground">Saldo</p>
                                        <p className="mt-2 text-2xl font-semibold tracking-tight">{formatCurrency(finance.saldo, finance.currency)}</p>
                                        <p className="mt-2 text-sm text-muted-foreground">Gesamter Bestand über alle sichtbaren Kassen</p>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="rounded-3xl border bg-background/80 p-5">
                                        <p className="text-sm text-muted-foreground">{finance.contributionAccount?.label ?? "Beitragskonto"}</p>
                                        <p className="mt-2 text-xl font-semibold tracking-tight">
                                            {finance.contributionAccount ? formatCurrency(finance.contributionAccount.balance, finance.contributionAccount.currency) : "–"}
                                        </p>
                                        <p className="mt-2 text-sm text-muted-foreground">{finance.contributionAccount?.name ?? "Noch kein passendes Konto erkannt"}</p>
                                    </div>
                                    <div className="rounded-3xl border bg-background/80 p-5">
                                        <p className="text-sm text-muted-foreground">{finance.paymentAccount?.label ?? "Payment"}</p>
                                        <p className="mt-2 text-xl font-semibold tracking-tight">
                                            {finance.paymentAccount ? formatCurrency(finance.paymentAccount.balance, finance.paymentAccount.currency) : "–"}
                                        </p>
                                        <p className="mt-2 text-sm text-muted-foreground">{finance.paymentAccount?.name ?? "Noch kein Payment-Konto erkannt"}</p>
                                    </div>
                                </div>

                                <div className="rounded-3xl border bg-background/80 p-4">
                                    {visibleChartData.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Für den gewählten Zeitraum liegen noch keine Buchungen vor.</div>
                                    ) : (
                                        <ChartContainer className="h-[260px] w-full !aspect-auto" config={chartConfig}>
                                            <BarChart accessibilityLayer data={visibleChartData} margin={{ left: 12, right: 12, top: 8 }}>
                                                <CartesianGrid vertical={false} />
                                                <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={8} />
                                                <YAxis axisLine={false} tickFormatter={(value) => `${Math.round(Number(value))}`} tickLine={false} width={42} />
                                                <ChartTooltip
                                                    content={
                                                        <ChartTooltipContent
                                                            formatter={(value, name) => [formatCurrency(Number(value), finance.currency), name === "income" ? "Einnahmen" : "Ausgaben"]}
                                                        />
                                                    }
                                                />
                                                <Bar dataKey="income" fill="var(--color-income)" radius={[8, 8, 0, 0]} />
                                                <Bar dataKey="expense" fill="var(--color-expense)" radius={[8, 8, 0, 0]} />
                                            </BarChart>
                                        </ChartContainer>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {financeActions.newExpenseHref ? (
                                        <Button asChild>
                                            <Link href={financeActions.newExpenseHref}>Neue Ausgabe</Link>
                                        </Button>
                                    ) : (
                                        <Button disabled>Neue Ausgabe</Button>
                                    )}
                                    <Button asChild variant="outline">
                                        <Link href={financeActions.newInvoiceHref}>Neue Rechnung</Link>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-[2rem]">
                <CardHeader>
                    <CardTitle>🎉 Jubiläen & Geburtstage</CardTitle>
                    <CardDescription>Jeweils eine vergangene, heutige und kommende Erinnerung für eine schnelle persönliche Übersicht.</CardDescription>
                </CardHeader>
                <CardContent>
                    {!canViewMembers ? (
                        <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Für dieses Konto sind aktuell keine Mitgliederereignisse sichtbar.</div>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-2">
                            <CelebrationColumn title="Geburtstage" description="Mehrfachtreffer pro Datum werden auf eine Person verdichtet." items={celebrations.birthdays} />
                            <CelebrationColumn title="Jubiläen" description="Vorschau auf Vereinszugehörigkeit rund um das heutige Datum." items={celebrations.anniversaries} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
