import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query, QueryCtx } from "./_generated/server";
import { requirePermission } from "./rbac";
import { buildKostenstellenOverview, validateKostenstellenAssignment } from "./kostenstellenUtils";

type Ctx = QueryCtx | MutationCtx;

function flattenTree<T extends { _id: string; name: string; children: T[] }>(points: T[]): T[] {
    return points.flatMap((point) => [point, ...flattenTree(point.children)]);
}

function sanitizeOptionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
}

function normalizeBudget(value: number) {
    if (!Number.isFinite(value) || value < 0) {
        throw new Error("Budget muss eine positive Zahl oder 0 sein");
    }

    return Math.round(value * 100) / 100;
}

function normalizeSortOrder(value?: number) {
    if (value === undefined) {
        return Date.now();
    }

    if (!Number.isFinite(value)) {
        throw new Error("Sortierung ist ungültig");
    }

    return Math.trunc(value);
}

async function getKostenstelleOrThrow(ctx: Ctx, kostenstelleId: Id<"kostenstelle">) {
    const kostenstelle = await ctx.db.get(kostenstelleId);
    if (!kostenstelle) {
        throw new Error("Kostenstelle nicht gefunden");
    }
    return kostenstelle as Doc<"kostenstelle">;
}

async function getAusgabenpunktOrThrow(ctx: Ctx, ausgabenpunktId: Id<"kostenstelle_ausgabenpunkt">) {
    const ausgabenpunkt = await ctx.db.get(ausgabenpunktId);
    if (!ausgabenpunkt) {
        throw new Error("Ausgabenpunkt nicht gefunden");
    }
    return ausgabenpunkt as Doc<"kostenstelle_ausgabenpunkt">;
}

async function loadOverview(ctx: Ctx, vereinId: Id<"verein">, onlyActive: boolean) {
    const kostenstellen = await ctx.db
        .query("kostenstelle")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect();

    const filteredKostenstellen = onlyActive ? kostenstellen.filter((kostenstelle) => kostenstelle.aktiv) : kostenstellen;

    const kostenstellenIds = new Set(filteredKostenstellen.map((kostenstelle) => kostenstelle._id));
    const ausgabenpunkte = (await ctx.db
        .query("kostenstelle_ausgabenpunkt")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect()) as Doc<"kostenstelle_ausgabenpunkt">[];
    const filteredAusgabenpunkte = ausgabenpunkte.filter((ausgabenpunkt) => kostenstellenIds.has(ausgabenpunkt.kostenstelleId));

    const buchungen = (await ctx.db
        .query("kassen_buchung")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect()) as Doc<"kassen_buchung">[];
    const filteredBuchungen = buchungen.filter((buchung) => !buchung.kostenstelleId || kostenstellenIds.has(buchung.kostenstelleId));

    return buildKostenstellenOverview({
        kostenstellen: filteredKostenstellen,
        ausgabenpunkte: filteredAusgabenpunkte,
        buchungen: filteredBuchungen,
    });
}

export const getOverview = query({
    args: {
        vereinId: v.id("verein"),
        onlyActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "kostenstelle.view");

        const overview = await loadOverview(ctx, args.vereinId, args.onlyActive ?? false);
        const kassen = await ctx.db
            .query("kasse")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId))
            .collect();
        const kassenById = new Map(kassen.map((kasse) => [kasse._id, kasse]));
        const unassignedExpenses = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId))
            .order("desc")
            .collect();

        return {
            ...overview,
            recentUnassignedExpenses: unassignedExpenses
                .filter((buchung) => buchung.betrag < 0 && !buchung.ausgabenpunktId)
                .slice(0, 8)
                .map((buchung) => ({
                    ...buchung,
                    kasseName: kassenById.get(buchung.kasseId)?.name ?? "Unbekannt",
                })),
        };
    },
});

export const getDetail = query({
    args: {
        kostenstelleId: v.id("kostenstelle"),
    },
    handler: async (ctx, args) => {
        const kostenstelle = await getKostenstelleOrThrow(ctx, args.kostenstelleId);
        await requirePermission(ctx, kostenstelle.vereinId, "kostenstelle.view");

        const overview = await loadOverview(ctx, kostenstelle.vereinId, false);
        const detail = overview.kostenstellen.find((entry) => entry._id === args.kostenstelleId);
        if (!detail) {
            throw new Error("Kostenstelle nicht gefunden");
        }

        const kassen = await ctx.db
            .query("kasse")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", kostenstelle.vereinId))
            .collect();
        const kassenById = new Map(kassen.map((kasse) => [kasse._id, kasse]));
        const buchungen = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", kostenstelle.vereinId))
            .order("desc")
            .collect();
        const ausgabenpunkteById = new Map(flattenTree(detail.ausgabenpunkte).map((point) => [point._id, point]));

        return {
            kostenstelle: detail,
            assignedBookings: buchungen
                .filter((buchung) => buchung.kostenstelleId === detail._id)
                .map((buchung) => ({
                    ...buchung,
                    kasseName: kassenById.get(buchung.kasseId)?.name ?? "Unbekannt",
                    ausgabenpunktName: buchung.ausgabenpunktId ? (ausgabenpunkteById.get(buchung.ausgabenpunktId)?.name ?? "Unbekannt") : undefined,
                })),
        };
    },
});

export const createKostenstelle = mutation({
    args: {
        vereinId: v.id("verein"),
        name: v.string(),
        budget: v.number(),
        waehrung: v.string(),
        beschreibung: v.optional(v.string()),
        startDatum: v.optional(v.string()),
        endDatum: v.optional(v.string()),
        aktiv: v.boolean(),
    },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "kostenstelle.create");

        const now = new Date().toISOString();
        return await ctx.db.insert("kostenstelle", {
            vereinId: args.vereinId,
            name: args.name.trim(),
            budget: normalizeBudget(args.budget),
            waehrung: args.waehrung.trim() || "EUR",
            beschreibung: sanitizeOptionalText(args.beschreibung),
            startDatum: args.startDatum,
            endDatum: args.endDatum,
            aktiv: args.aktiv,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateKostenstelle = mutation({
    args: {
        kostenstelleId: v.id("kostenstelle"),
        name: v.optional(v.string()),
        budget: v.optional(v.number()),
        waehrung: v.optional(v.string()),
        beschreibung: v.optional(v.string()),
        startDatum: v.optional(v.string()),
        endDatum: v.optional(v.string()),
        aktiv: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { kostenstelleId, ...rest } = args;
        const kostenstelle = await getKostenstelleOrThrow(ctx, kostenstelleId);
        await requirePermission(ctx, kostenstelle.vereinId, "kostenstelle.edit");

        const updates: Partial<Doc<"kostenstelle">> = {
            updatedAt: new Date().toISOString(),
        };

        if (rest.name !== undefined) updates.name = rest.name.trim();
        if (rest.budget !== undefined) updates.budget = normalizeBudget(rest.budget);
        if (rest.waehrung !== undefined) updates.waehrung = rest.waehrung.trim() || kostenstelle.waehrung;
        if (rest.beschreibung !== undefined) updates.beschreibung = sanitizeOptionalText(rest.beschreibung);
        if (rest.startDatum !== undefined) updates.startDatum = rest.startDatum;
        if (rest.endDatum !== undefined) updates.endDatum = rest.endDatum;
        if (rest.aktiv !== undefined) updates.aktiv = rest.aktiv;

        await ctx.db.patch(kostenstelleId, updates);
        return kostenstelleId;
    },
});

export const deleteKostenstelle = mutation({
    args: {
        kostenstelleId: v.id("kostenstelle"),
    },
    handler: async (ctx, args) => {
        const kostenstelle = await getKostenstelleOrThrow(ctx, args.kostenstelleId);
        await requirePermission(ctx, kostenstelle.vereinId, "kostenstelle.delete");

        const hasPoints = await ctx.db
            .query("kostenstelle_ausgabenpunkt")
            .withIndex("by_kostenstelleId", (q) => q.eq("kostenstelleId", args.kostenstelleId))
            .first();
        if (hasPoints) {
            throw new Error("Kostenstelle enthält noch Ausgabenpunkte");
        }

        const hasBookings = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_kostenstelleId", (q) => q.eq("kostenstelleId", args.kostenstelleId))
            .first();
        if (hasBookings) {
            throw new Error("Kostenstelle ist noch Buchungen zugeordnet");
        }

        await ctx.db.delete(args.kostenstelleId);
    },
});

export const createAusgabenpunkt = mutation({
    args: {
        kostenstelleId: v.id("kostenstelle"),
        parentId: v.optional(v.union(v.id("kostenstelle_ausgabenpunkt"), v.null())),
        name: v.string(),
        budget: v.number(),
        beschreibung: v.optional(v.string()),
        sortOrder: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const kostenstelle = await getKostenstelleOrThrow(ctx, args.kostenstelleId);
        await requirePermission(ctx, kostenstelle.vereinId, "kostenstelle.edit");

        if (args.parentId) {
            const parent = await getAusgabenpunktOrThrow(ctx, args.parentId);
            if (parent.kostenstelleId !== kostenstelle._id) {
                throw new Error("Übergeordneter Ausgabenpunkt gehört nicht zur Kostenstelle");
            }
        }

        const now = new Date().toISOString();
        return await ctx.db.insert("kostenstelle_ausgabenpunkt", {
            vereinId: kostenstelle.vereinId,
            kostenstelleId: kostenstelle._id,
            parentId: args.parentId ?? undefined,
            name: args.name.trim(),
            budget: normalizeBudget(args.budget),
            beschreibung: sanitizeOptionalText(args.beschreibung),
            sortOrder: normalizeSortOrder(args.sortOrder),
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateAusgabenpunkt = mutation({
    args: {
        ausgabenpunktId: v.id("kostenstelle_ausgabenpunkt"),
        parentId: v.optional(v.union(v.id("kostenstelle_ausgabenpunkt"), v.null())),
        name: v.optional(v.string()),
        budget: v.optional(v.number()),
        beschreibung: v.optional(v.string()),
        sortOrder: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { ausgabenpunktId, ...rest } = args;
        const ausgabenpunkt = await getAusgabenpunktOrThrow(ctx, ausgabenpunktId);
        await requirePermission(ctx, ausgabenpunkt.vereinId, "kostenstelle.edit");

        if (rest.parentId) {
            const parent = await getAusgabenpunktOrThrow(ctx, rest.parentId);
            if (parent.kostenstelleId !== ausgabenpunkt.kostenstelleId) {
                throw new Error("Übergeordneter Ausgabenpunkt gehört nicht zur Kostenstelle");
            }
            if (parent._id === ausgabenpunkt._id) {
                throw new Error("Ein Ausgabenpunkt kann nicht sein eigener Elternknoten sein");
            }

            let cursor = parent.parentId;
            while (cursor) {
                if (cursor === ausgabenpunkt._id) {
                    throw new Error("Zyklische Hierarchien sind nicht erlaubt");
                }
                const next = await ctx.db.get(cursor);
                cursor = next?.parentId;
            }
        }

        const updates: Partial<Doc<"kostenstelle_ausgabenpunkt">> = {
            updatedAt: new Date().toISOString(),
        };

        if (rest.parentId !== undefined) updates.parentId = rest.parentId ?? undefined;
        if (rest.name !== undefined) updates.name = rest.name.trim();
        if (rest.budget !== undefined) updates.budget = normalizeBudget(rest.budget);
        if (rest.beschreibung !== undefined) updates.beschreibung = sanitizeOptionalText(rest.beschreibung);
        if (rest.sortOrder !== undefined) updates.sortOrder = normalizeSortOrder(rest.sortOrder);

        await ctx.db.patch(ausgabenpunktId, updates);
        return ausgabenpunktId;
    },
});

export const deleteAusgabenpunkt = mutation({
    args: {
        ausgabenpunktId: v.id("kostenstelle_ausgabenpunkt"),
    },
    handler: async (ctx, args) => {
        const ausgabenpunkt = await getAusgabenpunktOrThrow(ctx, args.ausgabenpunktId);
        await requirePermission(ctx, ausgabenpunkt.vereinId, "kostenstelle.delete");

        const child = await ctx.db
            .query("kostenstelle_ausgabenpunkt")
            .withIndex("by_kostenstelleId", (q) => q.eq("kostenstelleId", ausgabenpunkt.kostenstelleId))
            .filter((q) => q.eq(q.field("parentId"), args.ausgabenpunktId))
            .first();
        if (child) {
            throw new Error("Ausgabenpunkt enthält noch Unterpunkte");
        }

        const booking = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_ausgabenpunktId", (q) => q.eq("ausgabenpunktId", args.ausgabenpunktId))
            .first();
        if (booking) {
            throw new Error("Ausgabenpunkt ist noch Buchungen zugeordnet");
        }

        await ctx.db.delete(args.ausgabenpunktId);
    },
});

export const assignBuchung = mutation({
    args: {
        buchungId: v.id("kassen_buchung"),
        kostenstelleId: v.optional(v.id("kostenstelle")),
        ausgabenpunktId: v.optional(v.id("kostenstelle_ausgabenpunkt")),
    },
    handler: async (ctx, args) => {
        const buchung = await ctx.db.get(args.buchungId);
        if (!buchung) {
            throw new Error("Buchung nicht gefunden");
        }

        await requirePermission(ctx, buchung.vereinId, "buchung.create");

        if (args.kostenstelleId === undefined && args.ausgabenpunktId === undefined) {
            await ctx.db.patch(args.buchungId, {
                kostenstelleId: undefined,
                ausgabenpunktId: undefined,
            });
            return args.buchungId;
        }

        await validateKostenstellenAssignment(ctx, {
            vereinId: buchung.vereinId,
            kostenstelleId: args.kostenstelleId,
            ausgabenpunktId: args.ausgabenpunktId,
            betrag: buchung.betrag,
        });

        await ctx.db.patch(args.buchungId, {
            kostenstelleId: args.kostenstelleId,
            ausgabenpunktId: args.ausgabenpunktId,
        });

        return args.buchungId;
    },
});
