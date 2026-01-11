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
    },
    handler: async ({ db, auth }, { vereinId, nummer, vorname, nachname, firma, street, city, postalCode, country, email, phone, phoneNote, phone2, phone2Note, beitrittsdatum, ehrenmitglied }) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const mitgliedId = await db.insert("mitglied", {
            vereinId,
            nummer,
            vorname,
            nachname,
            searchName: `${vorname} ${nachname}`.toLowerCase(),
            firma,
            anschrift: {
                street,
                city,
                country,
                postalCode,
            },
            kontakt: {
                email,
                phone,
                phoneNote,
                phone2,
                phone2Note,
            },
            beitrittsdatum: beitrittsdatum,
            ehrenmitglied,
            geschlecht: "m",
            typ: "kontakt",
            datein: [],
            rollen: [],
        });
        return mitgliedId;
    },
});
