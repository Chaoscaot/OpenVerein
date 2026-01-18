import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
    args: {
        vereinId: v.id("verein"),
    },
    async handler({ db, auth }, { vereinId }) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const mitglieder = await db
            .query("mitglied")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
            .collect();
        return mitglieder;
    },
});

export const search = query({
    args: {
        vereinId: v.id("verein"),
        searchTerm: v.string(),
    },
    async handler({ db, auth }, { vereinId, searchTerm }) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        if (searchTerm.trim().length === 0) {
            return await db
                .query("mitglied")
                .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
                .take(20);
        }

        const mitglieder = await db
            .query("mitglied")
            .withSearchIndex("mitglied_search", (q) => q.search("searchName", searchTerm).eq("vereinId", vereinId))
            .take(20);
        return mitglieder;
    },
});

export const get = query({
    args: {
        id: v.optional(v.id("mitglied")),
    },
    async handler({ db, auth }, { id }) {
        if (!id) {
            return null;
        }

        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const mitglied = await db.get("mitglied", id);
        return mitglied;
    },
});

export const create = mutation({
    args: {
        vereinId: v.id("verein"),
        titel: v.optional(v.string()),
        nummer: v.string(),
        vorname: v.string(),
        nachname: v.string(),
        firma: v.boolean(),
        street: v.string(),
        city: v.string(),
        postalCode: v.string(),
        country: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        phoneNote: v.optional(v.string()),
        phone2: v.optional(v.string()),
        phone2Note: v.optional(v.string()),
        beitrittsdatum: v.string(),
        ehrenmitglied: v.boolean(),
        datein: v.array(
            v.object({
                name: v.string(),
                id: v.string(),
            })
        ),
        typ: v.union(v.literal("bewerber"), v.literal("mitglied"), v.literal("fördermitglied"), v.literal("kontakt"), v.literal("ausgeschieden")),
        geschlecht: v.union(v.literal("m"), v.literal("w"), v.literal("d"), v.literal("n")),
        austrittsdatum: v.optional(v.string()),
        beruf: v.optional(v.string()),
        familienstand: v.optional(v.string()),
        beitragsSatzId: v.optional(v.id("beitrags_satz")),
        beitragsEinzug: v.optional(v.union(v.literal("r"), v.literal("l"), v.literal("b"), v.literal("p"))),
        geburtsdatum: v.optional(v.string()),
        sepaMandat: v.optional(
            v.object({
                iban: v.string(),
                bic: v.string(),
                erstelltAm: v.string(),
            })
        ),
        parent: v.optional(v.id("mitglied")),
    },
    handler: async ({ db, auth }, values) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const verein = await db.get("verein", values.vereinId);
        if (!verein) {
            throw new Error("Verein not found");
        }

        const mitgliedId = await db.insert("mitglied", {
            vereinId: values.vereinId,
            nummer: values.nummer,
            vorname: values.vorname,
            nachname: values.nachname,
            searchName: `${values.vorname} ${values.nachname}`.toLowerCase(),
            titel: values.titel,
            firma: values.firma,
            geburtsdatum: values.geburtsdatum,
            anschrift: {
                street: values.street,
                city: values.city,
                postalCode: values.postalCode,
                country: values.country,
            },
            kontakt: {
                email: values.email,
                phone: values.phone,
                phoneNote: values.phoneNote,
                phone2: values.phone2,
                phone2Note: values.phone2Note,
            },
            beitrittsdatum: values.beitrittsdatum,
            austrittsdatum: values.austrittsdatum,
            ehrenmitglied: values.ehrenmitglied,
            familienstand: values.familienstand,
            beruf: values.beruf,
            geschlecht: values.geschlecht,
            typ: values.typ,
            beitragsSatzId: values.beitragsSatzId,
            beitragsEinzug: values.beitragsEinzug,
            datein: values.datein,
            parent: values.parent,
            sepaMandat: values.sepaMandat,
            rollen: [],
        });

        await db.patch("verein", values.vereinId, {
            mitgliederCounter: verein.mitgliederCounter + 1,
        });

        return mitgliedId;
    },
});

export const update = mutation({
    args: {
        id: v.id("mitglied"),
        titel: v.optional(v.string()),
        nummer: v.string(),
        vorname: v.string(),
        nachname: v.string(),
        firma: v.boolean(),
        street: v.string(),
        city: v.string(),
        postalCode: v.string(),
        country: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        phoneNote: v.optional(v.string()),
        phone2: v.optional(v.string()),
        phone2Note: v.optional(v.string()),
        beitrittsdatum: v.string(),
        ehrenmitglied: v.boolean(),
        datein: v.array(
            v.object({
                name: v.string(),
                id: v.string(),
            })
        ),
        typ: v.union(v.literal("bewerber"), v.literal("mitglied"), v.literal("fördermitglied"), v.literal("kontakt"), v.literal("ausgeschieden")),
        geschlecht: v.union(v.literal("m"), v.literal("w"), v.literal("d"), v.literal("n")),
        austrittsdatum: v.optional(v.string()),
        beruf: v.optional(v.string()),
        familienstand: v.optional(v.string()),
        beitragsSatzId: v.optional(v.id("beitrags_satz")),
        beitragsEinzug: v.optional(v.union(v.literal("r"), v.literal("l"), v.literal("b"), v.literal("p"))),
        geburtsdatum: v.optional(v.string()),
        sepaMandat: v.optional(
            v.object({
                iban: v.string(),
                bic: v.string(),
                erstelltAm: v.string(),
            })
        ),
        parent: v.optional(v.id("mitglied")),
    },
    handler: async ({ db, auth }, values) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const existing = await db.get("mitglied", values.id);
        if (!existing) {
            throw new Error("Mitglied not found");
        }

        await db.patch("mitglied", values.id, {
            nummer: values.nummer,
            vorname: values.vorname,
            nachname: values.nachname,
            searchName: `${values.vorname} ${values.nachname}`.toLowerCase(),
            titel: values.titel,
            firma: values.firma,
            geburtsdatum: values.geburtsdatum,
            anschrift: {
                street: values.street,
                city: values.city,
                postalCode: values.postalCode,
                country: values.country,
            },
            kontakt: {
                email: values.email,
                phone: values.phone,
                phoneNote: values.phoneNote,
                phone2: values.phone2,
                phone2Note: values.phone2Note,
            },
            beitrittsdatum: values.beitrittsdatum,
            austrittsdatum: values.austrittsdatum,
            ehrenmitglied: values.ehrenmitglied,
            familienstand: values.familienstand,
            beruf: values.beruf,
            geschlecht: values.geschlecht,
            typ: values.typ,
            beitragsSatzId: values.beitragsSatzId,
            beitragsEinzug: values.beitragsEinzug,
            datein: values.datein,
            parent: values.parent,
            sepaMandat: values.sepaMandat,
        });

        return values.id;
    },
});

export const remove = mutation({
    args: {
        id: v.id("mitglied"),
    },
    handler: async ({ db, auth }, { id }) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const mitglied = await db.get("mitglied", id);
        if (!mitglied) {
            throw new Error("Mitglied not found");
        }

        // Delete associated files
        for (const file of mitglied.datein) {
            // Note: You may want to call a file deletion function here
        }

        await db.delete("mitglied", id);
    },
});
