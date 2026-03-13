import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

type Ctx = QueryCtx | MutationCtx;

type AssignmentValidationArgs = {
    vereinId: Id<"verein">;
    kostenstelleId?: Id<"kostenstelle">;
    ausgabenpunktId?: Id<"kostenstelle_ausgabenpunkt">;
    betrag?: number;
};

type KostenstellenBuchung = Pick<Doc<"kassen_buchung">, "_id" | "kostenstelleId" | "ausgabenpunktId" | "betrag">;
type KostenstelleLike = Pick<Doc<"kostenstelle">, "_id" | "name" | "budget" | "aktiv" | "waehrung" | "beschreibung" | "startDatum" | "endDatum">;
type AusgabenpunktLike = Pick<Doc<"kostenstelle_ausgabenpunkt">, "_id" | "kostenstelleId" | "parentId" | "name" | "budget" | "sortOrder">;

type PointSummary = AusgabenpunktLike & {
    depth: number;
    children: PointSummary[];
    childBudgetTotal: number;
    spentDirect: number;
    spentTotal: number;
    remainingBudget: number;
    unallocatedBudget: number;
    bookingCountDirect: number;
    bookingCountTotal: number;
    utilizationPercent: number;
    status: "ok" | "warning" | "overspent" | "overplanned";
};

function roundCurrency(value: number) {
    return Math.round(value * 100) / 100;
}

function getExpenseAmount(buchung: KostenstellenBuchung) {
    return buchung.betrag < 0 ? Math.abs(buchung.betrag) : 0;
}

function getStatus({ remainingBudget, unallocatedBudget, budget }: { remainingBudget: number; unallocatedBudget: number; budget: number }) {
    if (remainingBudget < 0) {
        return "overspent" as const;
    }

    if (unallocatedBudget < 0) {
        return "overplanned" as const;
    }

    if (budget > 0 && remainingBudget <= budget * 0.1) {
        return "warning" as const;
    }

    return "ok" as const;
}

export async function validateKostenstellenAssignment(ctx: Ctx, args: AssignmentValidationArgs) {
    const hasKostenstelle = args.kostenstelleId !== undefined;
    const hasAusgabenpunkt = args.ausgabenpunktId !== undefined;

    if (!hasKostenstelle && !hasAusgabenpunkt) {
        return {
            kostenstelle: null,
            ausgabenpunkt: null,
        };
    }

    if (!hasKostenstelle || !hasAusgabenpunkt) {
        throw new Error("Kostenstelle und Ausgabenpunkt müssen gemeinsam gesetzt werden");
    }

    if (args.betrag !== undefined && args.betrag >= 0) {
        throw new Error("Nur Ausgaben können einer Kostenstelle zugewiesen werden");
    }

    const kostenstelle = await ctx.db.get(args.kostenstelleId!);
    if (!kostenstelle || kostenstelle.vereinId !== args.vereinId) {
        throw new Error("Kostenstelle nicht gefunden");
    }

    if (!kostenstelle.aktiv) {
        throw new Error("Nur aktive Kostenstellen können verwendet werden");
    }

    const ausgabenpunkt = await ctx.db.get(args.ausgabenpunktId!);
    if (!ausgabenpunkt || ausgabenpunkt.vereinId !== args.vereinId) {
        throw new Error("Ausgabenpunkt nicht gefunden");
    }

    if (ausgabenpunkt.kostenstelleId !== kostenstelle._id) {
        throw new Error("Ausgabenpunkt gehört nicht zur gewählten Kostenstelle");
    }

    return {
        kostenstelle,
        ausgabenpunkt,
    };
}

export function buildKostenstellenOverview({
    kostenstellen,
    ausgabenpunkte,
    buchungen,
}: {
    kostenstellen: KostenstelleLike[];
    ausgabenpunkte: AusgabenpunktLike[];
    buchungen: KostenstellenBuchung[];
}) {
    const costCenterBookings = new Map<string, KostenstellenBuchung[]>();
    const pointBookings = new Map<string, KostenstellenBuchung[]>();

    for (const buchung of buchungen) {
        if (buchung.kostenstelleId) {
            const key = buchung.kostenstelleId as string;
            const existing = costCenterBookings.get(key) ?? [];
            existing.push(buchung);
            costCenterBookings.set(key, existing);
        }

        if (buchung.ausgabenpunktId) {
            const key = buchung.ausgabenpunktId as string;
            const existing = pointBookings.get(key) ?? [];
            existing.push(buchung);
            pointBookings.set(key, existing);
        }
    }

    const pointsByKostenstelle = new Map<string, AusgabenpunktLike[]>();
    for (const point of ausgabenpunkte) {
        const key = point.kostenstelleId as string;
        const existing = pointsByKostenstelle.get(key) ?? [];
        existing.push(point);
        pointsByKostenstelle.set(key, existing);
    }

    const kostenstellenSummaries = kostenstellen
        .map((kostenstelle) => {
            const points = [...(pointsByKostenstelle.get(kostenstelle._id as string) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));
            const groupedByParent = new Map<string, AusgabenpunktLike[]>();

            for (const point of points) {
                const parentKey = point.parentId ? (point.parentId as string) : "root";
                const existing = groupedByParent.get(parentKey) ?? [];
                existing.push(point);
                groupedByParent.set(parentKey, existing);
            }

            const walk = (parentId?: Id<"kostenstelle_ausgabenpunkt">, depth = 0): PointSummary[] => {
                const groupKey = parentId ? (parentId as string) : "root";
                const siblings = [...(groupedByParent.get(groupKey) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "de"));

                return siblings.map((point): PointSummary => {
                    const children = walk(point._id, depth + 1);
                    const directBookings = pointBookings.get(point._id as string) ?? [];
                    const spentDirect = roundCurrency(directBookings.reduce((sum, buchung) => sum + getExpenseAmount(buchung), 0));
                    const bookingCountDirect = directBookings.length;
                    const childBudgetTotal = roundCurrency(children.reduce((sum: number, child: PointSummary) => sum + child.budget, 0));
                    const spentTotal = roundCurrency(spentDirect + children.reduce((sum: number, child: PointSummary) => sum + child.spentTotal, 0));
                    const bookingCountTotal = bookingCountDirect + children.reduce((sum: number, child: PointSummary) => sum + child.bookingCountTotal, 0);
                    const remainingBudget = roundCurrency(point.budget - spentTotal);
                    const unallocatedBudget = roundCurrency(point.budget - childBudgetTotal);
                    const utilizationPercent = point.budget <= 0 ? 0 : Math.min(100, Math.max(0, (spentTotal / point.budget) * 100));

                    return {
                        ...point,
                        depth,
                        children,
                        childBudgetTotal,
                        spentDirect,
                        spentTotal,
                        remainingBudget,
                        unallocatedBudget,
                        bookingCountDirect,
                        bookingCountTotal,
                        utilizationPercent,
                        status: getStatus({
                            remainingBudget,
                            unallocatedBudget,
                            budget: point.budget,
                        }),
                    };
                });
            };

            const tree = walk();
            const assignedBookings = costCenterBookings.get(kostenstelle._id as string) ?? [];
            const spentTotal = roundCurrency(assignedBookings.reduce((sum, buchung) => sum + getExpenseAmount(buchung), 0));
            const bookingCount = assignedBookings.length;
            const plannedBudget = roundCurrency(tree.reduce((sum: number, point: PointSummary) => sum + point.budget, 0));
            const remainingBudget = roundCurrency(kostenstelle.budget - spentTotal);
            const unallocatedBudget = roundCurrency(kostenstelle.budget - plannedBudget);
            const utilizationPercent = kostenstelle.budget <= 0 ? 0 : Math.min(100, Math.max(0, (spentTotal / kostenstelle.budget) * 100));

            return {
                ...kostenstelle,
                ausgabenpunkte: tree,
                ausgabenpunktCount: points.length,
                plannedBudget,
                spentTotal,
                remainingBudget,
                unallocatedBudget,
                bookingCount,
                utilizationPercent,
                status: getStatus({
                    remainingBudget,
                    unallocatedBudget,
                    budget: kostenstelle.budget,
                }),
            };
        })
        .sort((a, b) => Number(b.aktiv) - Number(a.aktiv) || a.name.localeCompare(b.name, "de"));

    const totalBudget = roundCurrency(kostenstellenSummaries.reduce((sum, kostenstelle) => sum + kostenstelle.budget, 0));
    const plannedBudget = roundCurrency(kostenstellenSummaries.reduce((sum, kostenstelle) => sum + kostenstelle.plannedBudget, 0));
    const assignedSpent = roundCurrency(kostenstellenSummaries.reduce((sum, kostenstelle) => sum + kostenstelle.spentTotal, 0));
    const remainingBudget = roundCurrency(kostenstellenSummaries.reduce((sum, kostenstelle) => sum + kostenstelle.remainingBudget, 0));
    const unallocatedBudget = roundCurrency(kostenstellenSummaries.reduce((sum, kostenstelle) => sum + kostenstelle.unallocatedBudget, 0));
    const assignedExpenseCount = buchungen.filter((buchung) => buchung.ausgabenpunktId !== undefined && buchung.betrag < 0).length;
    const unassignedExpenseCount = buchungen.filter((buchung) => buchung.ausgabenpunktId === undefined && buchung.betrag < 0).length;
    const atRiskCount = kostenstellenSummaries.filter((kostenstelle) => kostenstelle.status === "overspent" || kostenstelle.status === "overplanned").length;
    const activeCount = kostenstellenSummaries.filter((kostenstelle) => kostenstelle.aktiv).length;

    return {
        kostenstellen: kostenstellenSummaries,
        dashboard: {
            totalBudget,
            plannedBudget,
            assignedSpent,
            remainingBudget,
            unallocatedBudget,
            assignedExpenseCount,
            unassignedExpenseCount,
            atRiskCount,
            costCenterCount: kostenstellenSummaries.length,
            activeCount,
        },
    };
}
