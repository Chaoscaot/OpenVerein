import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { validateKostenstellenAssignment } from "./kostenstellenUtils";
import { requirePermission } from "./rbac";
import { r2 } from "./files";
import { compareKontoNummern, getDefaultSkr42AccountNumberForKasseType, SKR42_BASE_ACCOUNTS } from "../lib/skr42";

function roundToCent(value: number) {
    return Math.round(value * 100);
}

function isAmountMatching(buchungsBetrag: number, rechnungsBetrag: number) {
    return roundToCent(Math.abs(buchungsBetrag)) === roundToCent(Math.abs(rechnungsBetrag));
}

function amountDiff(buchungsBetrag: number, rechnungsBetrag: number) {
    return Math.abs(Math.abs(buchungsBetrag) - Math.abs(rechnungsBetrag));
}

type BuchhaltungKontoDoc = Doc<"buchhaltung_konto">;
type KasseDoc = Doc<"kasse">;
type Ctx = QueryCtx | MutationCtx;

async function loadKontenplan(ctx: Ctx, vereinId: Id<"verein">) {
    const konten = await ctx.db
        .query("buchhaltung_konto")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect();

    return konten.sort((a, b) => a.sortOrder - b.sortOrder || compareKontoNummern(a.nummer, b.nummer));
}

async function getBuchhaltungKontoOrThrow(ctx: Ctx, kontoId: Id<"buchhaltung_konto">, vereinId: Id<"verein">) {
    const konto = await ctx.db.get(kontoId);
    if (!konto || konto.vereinId !== vereinId) {
        throw new Error("Sachkonto nicht gefunden");
    }
    return konto;
}

async function resolveKassenKontoOrThrow(ctx: Ctx, kasse: KasseDoc) {
    if (!kasse.buchhaltungKontoId) {
        throw new Error("Für diese Kasse ist noch kein SKR42-Liquiditätskonto hinterlegt");
    }

    const konto = await ctx.db.get(kasse.buchhaltungKontoId);
    if (!konto || konto.vereinId !== kasse.vereinId) {
        throw new Error("Das verknüpfte Liquiditätskonto ist nicht mehr verfügbar");
    }

    return konto;
}

function buildKontierung(betrag: number, liquiditaetskontoId: Id<"buchhaltung_konto">, gegenkontoId: Id<"buchhaltung_konto">) {
    return betrag < 0
        ? {
              sollKontoId: gegenkontoId,
              habenKontoId: liquiditaetskontoId,
          }
        : {
              sollKontoId: liquiditaetskontoId,
              habenKontoId: gegenkontoId,
          };
}

async function validateGegenkontoForBuchung(
    ctx: Ctx,
    args: {
        vereinId: Id<"verein">;
        betrag: number;
        gegenkontoId?: Id<"buchhaltung_konto">;
    },
) {
    if (!args.gegenkontoId) {
        throw new Error("Bitte ein SKR42-Gegenkonto auswählen");
    }

    const konto = await getBuchhaltungKontoOrThrow(ctx, args.gegenkontoId, args.vereinId);

    if (!konto.aktiv) {
        throw new Error("Das ausgewählte SKR42-Konto ist deaktiviert");
    }

    const expectedType = args.betrag < 0 ? "expense" : "income";
    if (konto.typ !== expectedType) {
        throw new Error(args.betrag < 0 ? "Für Ausgaben muss ein Aufwandskonto verwendet werden" : "Für Einnahmen muss ein Ertragskonto verwendet werden");
    }

    return konto;
}

async function resolveDefaultKassenkontoId(ctx: Ctx, vereinId: Id<"verein">, typ: KasseDoc["typ"]) {
    const nummer = getDefaultSkr42AccountNumberForKasseType(typ);
    if (!nummer) {
        return undefined;
    }

    const konto = await ctx.db
        .query("buchhaltung_konto")
        .withIndex("by_vereinId_nummer", (q) => q.eq("vereinId", vereinId).eq("nummer", nummer))
        .first();

    return konto?._id;
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

export const getBuchhaltungOverview = query({
    args: { vereinId: v.id("verein") },
    handler: async (ctx, args) => {
        const access = await requirePermission(ctx, args.vereinId, "finanzen.view");

        const [konten, kassen] = await Promise.all([
            loadKontenplan(ctx, args.vereinId),
            ctx.db
                .query("kasse")
                .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId))
                .collect(),
        ]);

        const liquiditaetskonten = konten.filter((konto) => konto.isLiquiditaetskonto);
        const mappedKassen = kassen.filter((kasse) => kasse.buchhaltungKontoId).length;

        return {
            kontenrahmen: access.verein.buchhaltung?.kontenrahmen ?? null,
            version: access.verein.buchhaltung?.version ?? null,
            initializedAt: access.verein.buchhaltung?.initializedAt ?? null,
            kontenAnzahl: konten.length,
            liquiditaetskontenAnzahl: liquiditaetskonten.length,
            kassenAnzahl: kassen.length,
            mappedKassen,
            unmappedKassen: kassen.length - mappedKassen,
            isInitialized: konten.length > 0,
        };
    },
});

export const getKontenplan = query({
    args: { vereinId: v.id("verein") },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "finanzen.view");
        return await loadKontenplan(ctx, args.vereinId);
    },
});

export const initializeSkr42 = mutation({
    args: { vereinId: v.id("verein") },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "settings.edit");

        const now = new Date().toISOString();
        const existingKonten = await loadKontenplan(ctx, args.vereinId);
        const kontoNummern = new Set(existingKonten.map((konto) => konto.nummer));

        let createdCount = 0;
        for (const vorlage of SKR42_BASE_ACCOUNTS) {
            if (kontoNummern.has(vorlage.nummer)) {
                continue;
            }

            await ctx.db.insert("buchhaltung_konto", {
                vereinId: args.vereinId,
                kontenrahmen: "skr42",
                nummer: vorlage.nummer,
                name: vorlage.name,
                typ: vorlage.typ,
                bereich: vorlage.bereich,
                beschreibung: vorlage.beschreibung,
                isLiquiditaetskonto: !!vorlage.isLiquiditaetskonto,
                aktiv: true,
                standard: true,
                sortOrder: vorlage.sortOrder,
                createdAt: now,
                updatedAt: now,
            });

            kontoNummern.add(vorlage.nummer);
            createdCount += 1;
        }

        const kassen = await ctx.db
            .query("kasse")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", args.vereinId))
            .collect();

        let mappedKassen = 0;
        for (const kasse of kassen) {
            if (kasse.buchhaltungKontoId) {
                mappedKassen += 1;
                continue;
            }

            const kontoId = await resolveDefaultKassenkontoId(ctx, args.vereinId, kasse.typ);
            if (!kontoId) {
                continue;
            }

            await ctx.db.patch(kasse._id, {
                buchhaltungKontoId: kontoId,
            });
            mappedKassen += 1;
        }

        await ctx.db.patch(args.vereinId, {
            buchhaltung: {
                kontenrahmen: "skr42",
                version: "base-2026-03",
                initializedAt: now,
            },
        });

        return {
            createdCount,
            mappedKassen,
            totalKonten: kontoNummern.size,
        };
    },
});

export const assignKasseBuchhaltungKonto = mutation({
    args: {
        kasseId: v.id("kasse"),
        buchhaltungKontoId: v.id("buchhaltung_konto"),
    },
    handler: async (ctx, args) => {
        const kasse = await ctx.db.get(args.kasseId);
        if (!kasse) {
            throw new Error("Kasse nicht gefunden");
        }

        await requirePermission(ctx, kasse.vereinId, "kasse.edit");

        const konto = await getBuchhaltungKontoOrThrow(ctx, args.buchhaltungKontoId, kasse.vereinId);

        if (!konto.isLiquiditaetskonto) {
            throw new Error("Der Kasse kann nur ein Liquiditätskonto zugeordnet werden");
        }

        await ctx.db.patch(args.kasseId, {
            buchhaltungKontoId: args.buchhaltungKontoId,
        });

        return args.kasseId;
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
        buchhaltungKontoId: v.optional(v.id("buchhaltung_konto")),
        aktiv: v.boolean(),
    },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "kasse.create");

        const verein = await ctx.db.get(args.vereinId);
        if (!verein) {
            throw new Error("Verein nicht gefunden");
        }

        let buchhaltungKontoId = args.buchhaltungKontoId;
        if (verein.buchhaltung?.kontenrahmen === "skr42") {
            buchhaltungKontoId ??= await resolveDefaultKassenkontoId(ctx, args.vereinId, args.typ);

            if (!buchhaltungKontoId) {
                throw new Error("Für die neue Kasse konnte kein passendes SKR42-Liquiditätskonto ermittelt werden");
            }

            const konto = await getBuchhaltungKontoOrThrow(ctx, buchhaltungKontoId, args.vereinId);

            if (!konto.isLiquiditaetskonto) {
                throw new Error("Für Kassen kann nur ein Liquiditätskonto gewählt werden");
            }
        }

        return await ctx.db.insert("kasse", {
            ...args,
            buchhaltungKontoId,
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
        buchhaltungKontoId: v.optional(v.id("buchhaltung_konto")),
        aktiv: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const { kasseId, ...updates } = args;
        const kasse = await ctx.db.get(kasseId);
        if (!kasse) {
            throw new Error("Kasse nicht gefunden");
        }

        await requirePermission(ctx, kasse.vereinId, "kasse.edit");

        if (updates.buchhaltungKontoId) {
            const konto = await getBuchhaltungKontoOrThrow(ctx, updates.buchhaltungKontoId, kasse.vereinId);

            if (!konto.isLiquiditaetskonto) {
                throw new Error("Für Kassen kann nur ein Liquiditätskonto gewählt werden");
            }
        }

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
        gegenkontoId: v.optional(v.id("buchhaltung_konto")),
        kostenstelleId: v.optional(v.id("kostenstelle")),
        ausgabenpunktId: v.optional(v.id("kostenstelle_ausgabenpunkt")),
    },
    handler: async (ctx, args) => {
        await requirePermission(ctx, args.vereinId, "buchung.create");

        const kasse = await ctx.db.get(args.kasseId);
        if (!kasse || kasse.vereinId !== args.vereinId) {
            throw new Error("Kasse gehört nicht zum Verein");
        }

        await validateKostenstellenAssignment(ctx, {
            vereinId: args.vereinId,
            kostenstelleId: args.kostenstelleId,
            ausgabenpunktId: args.ausgabenpunktId,
            betrag: args.betrag,
        });

        let gegenkontoId = args.gegenkontoId;
        let sollKontoId: Id<"buchhaltung_konto"> | undefined;
        let habenKontoId: Id<"buchhaltung_konto"> | undefined;

        const verein = await ctx.db.get(args.vereinId);
        if (!verein) {
            throw new Error("Verein nicht gefunden");
        }

        if (verein.buchhaltung?.kontenrahmen === "skr42") {
            const liquiditaetskonto = await resolveKassenKontoOrThrow(ctx, kasse);
            const gegenkonto = await validateGegenkontoForBuchung(ctx, {
                vereinId: args.vereinId,
                betrag: args.betrag,
                gegenkontoId,
            });

            gegenkontoId = gegenkonto._id;
            ({ sollKontoId, habenKontoId } = buildKontierung(args.betrag, liquiditaetskonto._id, gegenkonto._id));
        }

        const buchungId = await ctx.db.insert("kassen_buchung", {
            ...args,
            gegenkontoId,
            sollKontoId,
            habenKontoId,
        });

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

        const verein = await ctx.db.get(args.vereinId);
        if (!verein) {
            throw new Error("Verein nicht gefunden");
        }

        let vonSollKontoId: Id<"buchhaltung_konto"> | undefined;
        let vonHabenKontoId: Id<"buchhaltung_konto"> | undefined;
        let vonGegenkontoId: Id<"buchhaltung_konto"> | undefined;
        let zuSollKontoId: Id<"buchhaltung_konto"> | undefined;
        let zuHabenKontoId: Id<"buchhaltung_konto"> | undefined;
        let zuGegenkontoId: Id<"buchhaltung_konto"> | undefined;

        if (verein.buchhaltung?.kontenrahmen === "skr42") {
            const vonKonto = await resolveKassenKontoOrThrow(ctx, vonKasse);
            const zuKonto = await resolveKassenKontoOrThrow(ctx, zuKasse);

            vonSollKontoId = zuKonto._id;
            vonHabenKontoId = vonKonto._id;
            vonGegenkontoId = zuKonto._id;
            zuSollKontoId = zuKonto._id;
            zuHabenKontoId = vonKonto._id;
            zuGegenkontoId = vonKonto._id;
        }

        const vonBuchungId = await ctx.db.insert("kassen_buchung", {
            kasseId: args.vonKasseId,
            vereinId: args.vereinId,
            betrag: -Math.abs(args.betrag),
            datum: args.datum,
            kategorie: "Umbuchung",
            zweck: vonZweck,
            belegNummer: args.belegNummer,
            gegenkontoId: vonGegenkontoId,
            sollKontoId: vonSollKontoId,
            habenKontoId: vonHabenKontoId,
        });

        const zuBuchungId = await ctx.db.insert("kassen_buchung", {
            kasseId: args.zuKasseId,
            vereinId: args.vereinId,
            betrag: Math.abs(args.betrag),
            datum: args.datum,
            kategorie: "Umbuchung",
            zweck: zuZweck,
            belegNummer: args.belegNummer,
            gegenkontoId: zuGegenkontoId,
            sollKontoId: zuSollKontoId,
            habenKontoId: zuHabenKontoId,
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
