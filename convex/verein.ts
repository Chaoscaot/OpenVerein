import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

export const list = query({
    async handler({ db, auth }) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const vereinList = await db
            .query("verein")
            .withIndex("by_owner", (q) => q.eq("owner", user.subject))
            .collect();

        const mitglidsVereine = await db
            .query("mitglied")
            .withIndex("by_userId", (q) => q.eq("userId", user.subject))
            .collect();

        const mitglidsVereinIds = (
            await Promise.all(
                mitglidsVereine.map(async (mitglied) => {
                    const verein = await db.get(mitglied.vereinId);
                    return verein;
                })
            )
        ).filter((v) => v !== null);

        return [...vereinList, ...mitglidsVereinIds];
    },
});

export const nameExists = query({
    args: { name: v.string() },
    async handler({ db }, { name }) {
        const existing = await db
            .query("verein")
            .withIndex("by_name", (q) => q.eq("name", name))
            .first();
        return existing !== null;
    },
});

export const create = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        street: v.string(),
        city: v.string(),
        postalCode: v.string(),
        country: v.string(),
    },
    async handler({ db, auth, runQuery }, { name, email, street, city, postalCode, country }) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const nameTaken = runQuery(api.verein.nameExists, { name });
        if (await nameTaken) {
            throw new Error("Vereinsname ist bereits vergeben");
        }

        const vereinId = await db.insert("verein", {
            name,
            contact: {
                email,
            },
            owner: user.subject,
            address: {
                street,
                city,
                postalCode,
                country,
            },
            mitgliederCounter: 1,
        });
        return vereinId;
    },
});

export const get = query({
    args: {
        id: v.id("verein"),
    },
    async handler({ db, auth }, { id }) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }
        const verein = await db.get("verein", id);
        if (!verein) {
            throw new Error("Verein not found");
        }

        if (verein.owner !== user.subject) {
            const mitglied = await db
                .query("mitglied")
                .withIndex("by_userId_vereinId", (q) => q.eq("userId", user.subject).eq("vereinId", id))
                .first();
            if (!mitglied) {
                throw new Error("Access denied");
            }
        }

        return verein;
    },
});

export const update = mutation({
    args: {
        id: v.id("verein"),
        name: v.string(),
        logo: v.optional(v.string()),
        street: v.string(),
        city: v.string(),
        postalCode: v.string(),
        country: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        sepaIban: v.optional(v.string()),
        sepaBic: v.optional(v.string()),
        sepaCreditorId: v.optional(v.string()),
    },
    async handler({ db, auth }, args) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const verein = await db.get(args.id);
        if (!verein) {
            throw new Error("Verein not found");
        }

        if (verein.owner !== user.subject) {
            throw new Error("Access denied");
        }

        await db.patch(args.id, {
            name: args.name,
            logo: args.logo,
            address: {
                street: args.street,
                city: args.city,
                postalCode: args.postalCode,
                country: args.country,
            },
            contact: {
                email: args.email,
                phone: args.phone,
            },
            sepa:
                args.sepaIban && args.sepaBic && args.sepaCreditorId
                    ? {
                          iban: args.sepaIban,
                          bic: args.sepaBic,
                          creditorId: args.sepaCreditorId,
                      }
                    : undefined,
        });

        return args.id;
    },
});
