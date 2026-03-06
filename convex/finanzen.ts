import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./rbac";
import { r2 } from "./files";

function roundToCent(value: number) {
    return Math.round(value * 100);
}

function isAmountMatching(buchungsBetrag: number, rechnungsBetrag: number) {
    return roundToCent(Math.abs(buchungsBetrag)) === roundToCent(Math.abs(rechnungsBetrag));
}

function amountDiff(buchungsBetrag: number, rechnungsBetrag: number) {
    return Math.abs(Math.abs(buchungsBetrag) - Math.abs(rechnungsBetrag));
}

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

export const createUmbuchung = mutation({
    args: {
        vereinId: v.id("verein"),
        vonKasseId: v.id("kasse"),
        zuKasseId: v.id("kasse"),
        betrag: v.number(),
        datum: v.string(),
        zweck: v.optional(v.string()),
        belegNummer: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "buchung.create");

        if (args.vonKasseId === args.zuKasseId) {
            throw new Error("Quelle und Ziel müssen unterschiedliche Kassen sein");
        }

        if (args.betrag <= 0) {
            throw new Error("Der Betrag muss größer als 0 sein");
        }

        const vonKasse = await ctx.db.get(args.vonKasseId);
        const zuKasse = await ctx.db.get(args.zuKasseId);

        if (!vonKasse || !zuKasse) {
            throw new Error("Kasse nicht gefunden");
        }

        if (vonKasse.vereinId !== args.vereinId || zuKasse.vereinId !== args.vereinId) {
            throw new Error("Kassen gehören nicht zum Verein");
        }

        if (vonKasse.waehrung !== zuKasse.waehrung) {
            throw new Error("Umbuchung nur zwischen Kassen mit gleicher Währung möglich");
        }

        const transferZweck = args.zweck?.trim();
        const vonZweck = transferZweck ? `Umbuchung an ${zuKasse.name}: ${transferZweck}` : `Umbuchung an ${zuKasse.name}`;
        const zuZweck = transferZweck ? `Umbuchung von ${vonKasse.name}: ${transferZweck}` : `Umbuchung von ${vonKasse.name}`;

        const vonBuchungId = await ctx.db.insert("kassen_buchung", {
            kasseId: args.vonKasseId,
            vereinId: args.vereinId,
            betrag: -Math.abs(args.betrag),
            datum: args.datum,
            kategorie: "Umbuchung",
            zweck: vonZweck,
            belegNummer: args.belegNummer,
        });

        const zuBuchungId = await ctx.db.insert("kassen_buchung", {
            kasseId: args.zuKasseId,
            vereinId: args.vereinId,
            betrag: Math.abs(args.betrag),
            datum: args.datum,
            kategorie: "Umbuchung",
            zweck: zuZweck,
            belegNummer: args.belegNummer,
        });

        await ctx.db.patch(args.vonKasseId, {
            aktuellerBestand: vonKasse.aktuellerBestand - Math.abs(args.betrag),
        });

        await ctx.db.patch(args.zuKasseId, {
            aktuellerBestand: zuKasse.aktuellerBestand + Math.abs(args.betrag),
        });

        return {
            vonBuchungId,
            zuBuchungId,
        };
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

        const rechnungen = await ctx.db
            .query("buchung_rechnung")
            .withIndex("by_buchungId", (q) => q.eq("buchungId", args.buchungId))
            .collect();

        await Promise.all(
            rechnungen.map(async (rechnung) => {
                await ctx.db.delete(rechnung._id);
                await r2.deleteObject(ctx, rechnung.fileId);
            }),
        );

        await ctx.db.delete(args.buchungId);
    },
});

export const getRechnungenByBuchung = query({
    args: { buchungId: v.id("kassen_buchung") },
    handler: async (ctx, args) => {
        const buchung = await ctx.db.get(args.buchungId);
        if (!buchung) {
            return [];
        }

        await requirePermission(ctx, buchung.vereinId, "buchung.view");

        return await ctx.db
            .query("buchung_rechnung")
            .withIndex("by_buchungId", (q) => q.eq("buchungId", args.buchungId))
            .order("desc")
            .collect();
    },
});

export const getRechnungenByKasse = query({
    args: { kasseId: v.id("kasse") },
    handler: async (ctx, args) => {
        const kasse = await ctx.db.get(args.kasseId);
        if (!kasse) {
            return [];
        }

        await requirePermission(ctx, kasse.vereinId, "buchung.view");

        const buchungen = await ctx.db
            .query("kassen_buchung")
            .withIndex("by_kasseId", (q) => q.eq("kasseId", args.kasseId))
            .collect();

        if (buchungen.length === 0) {
            return [];
        }

        const buchungIdSet = new Set(buchungen.map((buchung) => buchung._id));

        const rechnungen = await ctx.db
            .query("buchung_rechnung")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", kasse.vereinId))
            .collect();

        return rechnungen.filter((rechnung) => buchungIdSet.has(rechnung.buchungId));
    },
});

export const createRechnung = mutation({
    args: {
        buchungId: v.id("kassen_buchung"),
        fileId: v.string(),
        dateiname: v.string(),
        mimeType: v.optional(v.string()),
        format: v.union(v.literal("pdf"), v.literal("e-rechnung")),
        rechnungsnummer: v.optional(v.string()),
        rechnungsdatum: v.optional(v.string()),
        rechnungsempfaenger: v.optional(v.string()),
        betrag: v.number(),
        waehrung: v.string(),
        kommentar: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const buchung = await ctx.db.get(args.buchungId);
        if (!buchung) {
            throw new Error("Buchung nicht gefunden");
        }

        await requirePermission(ctx, buchung.vereinId, "buchung.create");

        const betragAbgleich = isAmountMatching(buchung.betrag, args.betrag);
        const abweichungBetrag = amountDiff(buchung.betrag, args.betrag);
        const now = new Date().toISOString();

        return await ctx.db.insert("buchung_rechnung", {
            buchungId: args.buchungId,
            vereinId: buchung.vereinId,
            fileId: args.fileId,
            dateiname: args.dateiname,
            mimeType: args.mimeType,
            format: args.format,
            rechnungsnummer: args.rechnungsnummer,
            rechnungsdatum: args.rechnungsdatum,
            rechnungsempfaenger: args.rechnungsempfaenger,
            betrag: args.betrag,
            waehrung: args.waehrung,
            kommentar: args.kommentar,
            betragAbgleich,
            abweichungBetrag,
            createdAt: now,
            updatedAt: now,
        });
    },
});

export const updateRechnung = mutation({
    args: {
        rechnungId: v.id("buchung_rechnung"),
        fileId: v.optional(v.string()),
        dateiname: v.optional(v.string()),
        mimeType: v.optional(v.string()),
        format: v.optional(v.union(v.literal("pdf"), v.literal("e-rechnung"))),
        rechnungsnummer: v.optional(v.string()),
        rechnungsdatum: v.optional(v.string()),
        rechnungsempfaenger: v.optional(v.string()),
        betrag: v.optional(v.number()),
        waehrung: v.optional(v.string()),
        kommentar: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { rechnungId, ...updates } = args;
        const rechnung = await ctx.db.get(rechnungId);
        if (!rechnung) {
            throw new Error("Rechnung nicht gefunden");
        }

        const buchung = await ctx.db.get(rechnung.buchungId);
        if (!buchung) {
            throw new Error("Zugehörige Buchung nicht gefunden");
        }

        await requirePermission(ctx, buchung.vereinId, "buchung.create");

        const nextBetrag = updates.betrag ?? rechnung.betrag;
        const nextFileId = updates.fileId ?? rechnung.fileId;
        const betragAbgleich = isAmountMatching(buchung.betrag, nextBetrag);
        const abweichungBetrag = amountDiff(buchung.betrag, nextBetrag);

        await ctx.db.patch(rechnungId, {
            ...updates,
            fileId: nextFileId,
            betrag: nextBetrag,
            betragAbgleich,
            abweichungBetrag,
            updatedAt: new Date().toISOString(),
        });

        if (updates.fileId && updates.fileId !== rechnung.fileId) {
            await r2.deleteObject(ctx, rechnung.fileId);
        }

        return rechnungId;
    },
});

export const deleteRechnung = mutation({
    args: { rechnungId: v.id("buchung_rechnung") },
    handler: async (ctx, args) => {
        const rechnung = await ctx.db.get(args.rechnungId);
        if (!rechnung) {
            return;
        }

        const buchung = await ctx.db.get(rechnung.buchungId);
        if (!buchung) {
            await ctx.db.delete(args.rechnungId);
            await r2.deleteObject(ctx, rechnung.fileId);
            return;
        }

        await requirePermission(ctx, buchung.vereinId, "buchung.delete");

        await ctx.db.delete(args.rechnungId);
        await r2.deleteObject(ctx, rechnung.fileId);
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
