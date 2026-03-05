import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./rbac";

export const list = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await requirePermission(ctx, vereinId, "beitragssatz.view");

        const beitragssaetze = await ctx.db
            .query("beitrags_satz")
            .withIndex("by_verein", (q) => q.eq("vereinId", vereinId))
            .collect();

        return beitragssaetze;
    },
});

export const get = query({
    args: {
        id: v.optional(v.id("beitrags_satz")),
    },
    handler: async (ctx, { id }) => {
        if (!id) {
            return null;
        }

        const beitragssatz = await ctx.db.get(id);
        if (!beitragssatz) {
            return null;
        }

        await requirePermission(ctx, beitragssatz.vereinId, "beitragssatz.view");
        return beitragssatz;
    },
});

export const create = mutation({
    args: {
        vereinId: v.id("verein"),
        name: v.string(),
        betrag: v.number(),
        waehrung: v.string(),
        beschreibung: v.optional(v.string()),
    },
    handler: async (ctx, values) => {
        await requirePermission(ctx, values.vereinId, "beitragssatz.create");

        const beitragssatzId = await ctx.db.insert("beitrags_satz", {
            vereinId: values.vereinId,
            name: values.name,
            betrag: values.betrag,
            waehrung: values.waehrung,
            beschreibung: values.beschreibung,
        });

        return beitragssatzId;
    },
});

export const update = mutation({
    args: {
        id: v.id("beitrags_satz"),
        name: v.string(),
        betrag: v.number(),
        waehrung: v.string(),
        beschreibung: v.optional(v.string()),
    },
    handler: async (ctx, values) => {
        const existing = await ctx.db.get(values.id);
        if (!existing) {
            throw new Error("Beitragssatz not found");
        }

        await requirePermission(ctx, existing.vereinId, "beitragssatz.edit");

        await ctx.db.patch(values.id, {
            name: values.name,
            betrag: values.betrag,
            waehrung: values.waehrung,
            beschreibung: values.beschreibung,
        });

        return values.id;
    },
});

export const remove = mutation({
    args: {
        id: v.id("beitrags_satz"),
    },
    handler: async (ctx, { id }) => {
        const beitragssatz = await ctx.db.get(id);
        if (!beitragssatz) {
            throw new Error("Beitragssatz not found");
        }

        await requirePermission(ctx, beitragssatz.vereinId, "beitragssatz.delete");

        // Check if any members use this beitragssatz
        const membersWithBeitragssatz = await ctx.db
            .query("mitglied")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", beitragssatz.vereinId))
            .filter((q) => q.eq(q.field("beitragsSatzId"), id))
            .first();

        if (membersWithBeitragssatz) {
            throw new Error("Beitragssatz wird noch von Mitgliedern verwendet");
        }

        const buchungMitBeitragssatz = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", beitragssatz.vereinId))
            .filter((q) => q.eq(q.field("beitragsSatzId"), id))
            .first();

        if (buchungMitBeitragssatz) {
            throw new Error("Beitragssatz wird noch in Buchungen verwendet");
        }

        await ctx.db.delete(id);
    },
});
