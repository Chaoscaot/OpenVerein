import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    verein: defineTable({
        name: v.string(),
        owner: v.string(),
        logo: v.optional(v.string()),
        address: v.object({
            street: v.string(),
            city: v.string(),
            postalCode: v.string(),
            country: v.string(),
        }),
        contact: v.object({
            email: v.string(),
            phone: v.optional(v.string()),
        }),
        sepa: v.optional(
            v.object({
                iban: v.string(),
                bic: v.string(),
                creditorId: v.string(),
            })
        ),
        mitgliederCounter: v.number(),
    })
        .index("by_name", ["name"])
        .index("by_owner", ["owner"]),
    mitglied: defineTable({
        vereinId: v.id("verein"),
        userId: v.optional(v.string()),
        nummer: v.string(),
        foto: v.optional(v.string()),
        vorname: v.string(),
        nachname: v.string(),
        searchName: v.string(),
        titel: v.optional(v.string()),
        firma: v.boolean(),
        geburtsdatum: v.optional(v.string()),
        anschrift: v.object({
            street: v.string(),
            city: v.string(),
            postalCode: v.string(),
            country: v.string(),
        }),
        kontakt: v.object({
            email: v.string(),
            phone: v.optional(v.string()),
            phoneNote: v.optional(v.string()),
            phone2: v.optional(v.string()),
            phone2Note: v.optional(v.string()),
        }),
        beitrittsdatum: v.string(),
        austrittsdatum: v.optional(v.string()),
        ehrenmitglied: v.boolean(),
        familienstand: v.optional(v.string()),
        beruf: v.optional(v.string()),
        geschlecht: v.union(v.literal("m"), v.literal("w"), v.literal("d"), v.literal("n")),
        notiz: v.optional(v.string()),
        typ: v.union(v.literal("bewerber"), v.literal("mitglied"), v.literal("fördermitglied"), v.literal("kontakt"), v.literal("ausgeschieden")),
        beitragsSatzId: v.optional(v.id("beitrags_satz")),
        beitragsEinzug: v.optional(v.union(v.literal("r"), v.literal("l"), v.literal("b"), v.literal("p"))),
        datein: v.array(
            v.object({
                name: v.string(),
                id: v.string(),
            })
        ),
        alias: v.optional(v.string()),
        rollen: v.array(v.id("vereins_rollen")),
        parent: v.optional(v.id("mitglied")),
        sepaMandat: v.optional(
            v.object({
                erstelltAm: v.string(),
                iban: v.string(),
                bic: v.string(),
            })
        ),
    })
        .index("by_vereinId", ["vereinId"])
        .index("by_userId", ["userId"])
        .index("by_rolle", ["vereinId", "rollen"])
        .index("by_userId_vereinId", ["userId", "vereinId"])
        .searchIndex("mitglied_search", {
            searchField: "searchName",
            filterFields: ["vereinId"],
        }),
    beitrags_satz: defineTable({
        vereinId: v.id("verein"),
        name: v.string(),
        betrag: v.number(),
        waehrung: v.string(),
        beschreibung: v.optional(v.string()),
    }).index("by_verein", ["vereinId"]),
    zahlungseingang: defineTable({
        mitgliedId: v.id("mitglied"),
        typ: v.union(v.literal("beitrag"), v.literal("spende"), v.literal("sonstiges")),
        beitragsSatzId: v.optional(v.id("beitrags_satz")),
        betrag: v.number(),
        waehrung: v.string(),
        datum: v.string(),
        methode: v.union(v.literal("rechnung"), v.literal("lastschrift"), v.literal("bar")),
        notiz: v.optional(v.string()),
        referenz: v.optional(v.string()),
    }).index("by_mitgliedId", ["mitgliedId"]),
    mitglieder_liste: defineTable({
        vereinId: v.id("verein"),
        name: v.string(),
    }),
    listen_eintrag: defineTable({
        listeId: v.id("mitglieder_liste"),
        mitgliedId: v.id("mitglied"),
    }),
    vereins_rollen: defineTable({
        vereinId: v.id("verein"),
        name: v.string(),
        berechtigungen: v.array(v.string()),
    }),
});
