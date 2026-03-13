import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

function formatCurrency(value: number, waehrung = "EUR") {
    return `${value.toFixed(2)} ${waehrung}`;
}

export function KostenstellenDashboard({
    dashboard,
    waehrung = "EUR",
    compact = false,
}: {
    dashboard: {
        totalBudget: number;
        plannedBudget: number;
        assignedSpent: number;
        remainingBudget: number;
        unallocatedBudget: number;
        assignedExpenseCount: number;
        unassignedExpenseCount: number;
        atRiskCount: number;
        costCenterCount: number;
        activeCount: number;
    };
    waehrung?: string;
    compact?: boolean;
}) {
    const planPercent = dashboard.totalBudget <= 0 ? 0 : Math.min(100, Math.max(0, (dashboard.plannedBudget / dashboard.totalBudget) * 100));
    const spentPercent = dashboard.totalBudget <= 0 ? 0 : Math.min(100, Math.max(0, (dashboard.assignedSpent / dashboard.totalBudget) * 100));

    return (
        <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 md:grid-cols-2 xl:grid-cols-4"}>
            <Card className="min-w-0">
                <CardHeader className="pb-2">
                    <CardDescription>Budgetrahmen</CardDescription>
                    <CardTitle className="break-words text-xl leading-tight">{formatCurrency(dashboard.totalBudget, waehrung)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                        <span className="min-w-0 pr-2">Aktive Kostenstellen</span>
                        <Badge variant="secondary">
                            {dashboard.activeCount} / {dashboard.costCenterCount}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="min-w-0 pr-2">Offen zu verteilen</span>
                        <span className="text-right">{formatCurrency(dashboard.unallocatedBudget, waehrung)}</span>
                    </div>
                </CardContent>
            </Card>
            <Card className="min-w-0">
                <CardHeader className="pb-2">
                    <CardDescription>Planung</CardDescription>
                    <CardTitle className="break-words text-xl leading-tight">{formatCurrency(dashboard.plannedBudget, waehrung)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Progress value={planPercent} />
                    <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
                        <span className="min-w-0">{planPercent.toFixed(0)}% des Budgets verteilt</span>
                        <span className="shrink-0 text-right">{formatCurrency(dashboard.unallocatedBudget, waehrung)} frei</span>
                    </div>
                </CardContent>
            </Card>
            <Card className="min-w-0">
                <CardHeader className="pb-2">
                    <CardDescription>Verbrauch</CardDescription>
                    <CardTitle className="break-words text-xl leading-tight">{formatCurrency(dashboard.assignedSpent, waehrung)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <Progress value={spentPercent} />
                    <div className="flex items-start justify-between gap-3 text-sm text-muted-foreground">
                        <span className="min-w-0">{dashboard.assignedExpenseCount} zugeordnete Ausgaben</span>
                        <span className="shrink-0 text-right">{formatCurrency(dashboard.remainingBudget, waehrung)} Rest</span>
                    </div>
                </CardContent>
            </Card>
            <Card className="min-w-0">
                <CardHeader className="pb-2">
                    <CardDescription>Aufmerksamkeit nötig</CardDescription>
                    <CardTitle className="break-words text-xl leading-tight">{dashboard.atRiskCount}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                        <span className="min-w-0 pr-2">Ausgaben ohne Zuordnung</span>
                        <Badge variant={dashboard.unassignedExpenseCount > 0 ? "destructive" : "secondary"}>{dashboard.unassignedExpenseCount}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="min-w-0 pr-2">Gefährdete Kostenstellen</span>
                        <Badge variant={dashboard.atRiskCount > 0 ? "destructive" : "secondary"}>{dashboard.atRiskCount}</Badge>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
