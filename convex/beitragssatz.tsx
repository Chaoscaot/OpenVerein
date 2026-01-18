import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async ({ db, auth }, { vereinId }) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const beitragssaetze = await db
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
    handler: async ({ db, auth }, { id }) => {
        if (!id) {
            return null;
        }

        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const beitragssatz = await db.get("beitrags_satz", id);
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
    handler: async ({ db, auth }, values) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const beitragssatzId = await db.insert("beitrags_satz", {
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
    handler: async ({ db, auth }, values) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const existing = await db.get("beitrags_satz", values.id);
        if (!existing) {
            throw new Error("Beitragssatz not found");
        }

        await db.patch("beitrags_satz", values.id, {
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
    handler: async ({ db, auth }, { id }) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const beitragssatz = await db.get("beitrags_satz", id);
        if (!beitragssatz) {
            throw new Error("Beitragssatz not found");
        }

        // Check if any members use this beitragssatz
        const membersWithBeitragssatz = await db
            .query("mitglied")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", beitragssatz.vereinId))
            .filter((q) => q.eq(q.field("beitragsSatzId"), id))
            .first();

        if (membersWithBeitragssatz) {
            throw new Error("Beitragssatz wird noch von Mitgliedern verwendet");
        }

        await db.delete("beitrags_satz", id);
    },
});
