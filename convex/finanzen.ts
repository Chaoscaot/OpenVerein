import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./rbac";

export const getKassen = query({
    args: { vereinId: v.id("verein") },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "kasse.view");

        return await ctx.db
            .query("kasse")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId))
            .collect();
    },
});

export const getKasse = query({
    args: { kasseId: v.id("kasse") },
    handler: async (ctx, args) => {
        const kasse = await ctx.db.get(args.kasseId);
        if (!kasse) {
            return null;
        }

        await requirePermission(ctx, kasse.vereinId, "kasse.view");
        return kasse;
    },
});

export const createKasse = mutation({
    args: {
        vereinId: v.id("verein"),
        name: v.string(),
        typ: v.union(v.literal("barkasse"), v.literal("bankkonto"), v.literal("kreditkarte"), v.literal("paypal"), v.literal("sonstiges")),
        iban: v.optional(v.string()),
        bic: v.optional(v.string()),
        waehrung: v.string(),
        anfangsbestand: v.number(),
        beschreibung: v.optional(v.string()),
        aktiv: v.boolean(),
    },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "kasse.create");

        return await ctx.db.insert("kasse", {
            ...args,
            aktuellerBestand: args.anfangsbestand,
        });
    },
});

export const updateKasse = mutation({
    args: {
        kasseId: v.id("kasse"),
        name: v.optional(v.string()),
        typ: v.optional(v.union(v.literal("barkasse"), v.literal("bankkonto"), v.literal("kreditkarte"), v.literal("paypal"), v.literal("sonstiges"))),
        iban: v.optional(v.string()),
        bic: v.optional(v.string()),
        waehrung: v.optional(v.string()),
        beschreibung: v.optional(v.string()),
        aktiv: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { kasseId, ...updates } = args;
        const kasse = await ctx.db.get(kasseId);
        if (!kasse) {
            throw new Error("Kasse nicht gefunden");
        }

        await requirePermission(ctx, kasse.vereinId, "kasse.edit");

        return await ctx.db.patch(kasseId, updates);
    },
});

export const deleteKasse = mutation({
    args: { kasseId: v.id("kasse") },
    handler: async (ctx, args) => {
        const kasse = await ctx.db.get(args.kasseId);
        if (!kasse) {
            throw new Error("Kasse nicht gefunden");
        }

        await requirePermission(ctx, kasse.vereinId, "kasse.delete");

        const buchungen = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_kasseId", (q) => q.eq("kasseId", args.kasseId))
            .first();

        if (buchungen) {
            throw new Error("Cannot delete Kasse with existing Buchungen.");
        }

        await ctx.db.delete(args.kasseId);
    },
});

export const getBuchungen = query({
    args: {
        vereinId: v.optional(v.id("verein")),
        kasseId: v.optional(v.id("kasse")),
    },
    handler: async (ctx, args) => {
        if (args.kasseId) {
            const kasse = await ctx.db.get(args.kasseId);
            if (!kasse) {
                return [];
            }
            await requirePermission(ctx, kasse.vereinId, "buchung.view");

            return await ctx.db
                .query("kassen_buchung")
                .withIndex("by_kasseId", (q) => q.eq("kasseId", args.kasseId!))
                .order("desc")
                .collect();
        } else if (args.vereinId) {
            await requirePermission(ctx, args.vereinId, "buchung.view");

            return await ctx.db
                .query("kassen_buchung")
                .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId!))
                .order("desc")
                .collect();
        }
        return [];
    },
});

export const createBuchung = mutation({
    args: {
        kasseId: v.id("kasse"),
        vereinId: v.id("verein"),
        betrag: v.number(),
        datum: v.string(),
        kategorie: v.optional(v.string()),
        zweck: v.string(),
        belegNummer: v.optional(v.string()),
        beitragsSatzId: v.optional(v.id("beitrags_satz")),
        mitgliedId: v.optional(v.id("mitglied")),
    },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "buchung.create");

        const kasse = await ctx.db.get(args.kasseId);
        if (!kasse || kasse.vereinId !== args.vereinId) {
            throw new Error("Kasse gehört nicht zum Verein");
        }

        const buchungId = await ctx.db.insert("kassen_buchung", args);

        await ctx.db.patch(args.kasseId, {
            aktuellerBestand: kasse.aktuellerBestand + args.betrag,
        });

        return buchungId;
    },
});

export const getBeitragsBuchungsUebersicht = query({
    args: { vereinId: v.id("verein") },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "finanzen.view");

        const buchungen = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId))
            .collect();

        const gesamt = buchungen.length;
        const mitBeitragssatz = buchungen.filter((b) => b.beitragsSatzId !== undefined).length;
        const mitMitglied = buchungen.filter((b) => b.mitgliedId !== undefined).length;

        return {
            gesamt,
            mitBeitragssatz,
            mitMitglied,
            ohneZuordnung: buchungen.filter((b) => b.beitragsSatzId === undefined && b.mitgliedId === undefined).length,
        };
    },
});

export const deleteBuchung = mutation({
    args: { buchungId: v.id("kassen_buchung") },
    handler: async (ctx, args) => {
        const buchung = await ctx.db.get(args.buchungId);
        if (!buchung) {
            return;
        }

        await requirePermission(ctx, buchung.vereinId, "buchung.delete");

        const kasse = await ctx.db.get(buchung.kasseId);
        if (kasse) {
            await ctx.db.patch(kasse._id, {
                aktuellerBestand: kasse.aktuellerBestand - buchung.betrag,
            });
        }

        await ctx.db.delete(args.buchungId);
    },
});

export const getVereinFinanzen = query({
    args: { vereinId: v.id("verein") },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "finanzen.view");

        const kassen = await ctx.db
            .query("kasse")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId))
            .collect();

        const total = kassen.reduce((sum, kasse) => sum + kasse.aktuellerBestand, 0);
        return total;
    },
});
