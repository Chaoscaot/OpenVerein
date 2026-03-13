import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { QueryCtx, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";
import { hasPermission, requirePermission } from "./rbac";

async function resolveMitgliederAnzahl(ctx: QueryCtx, verein: Doc<"verein">) {
  if (verein.mitgliederAnzahl !== undefined) {
    return verein.mitgliederAnzahl;
  }

  const mitglieder = await ctx.db
    .query("mitglied")
    .withIndex("by_vereinId", (q) => q.eq("vereinId", verein._id))
    .collect();

  return mitglieder.length;
}

export const list = query({
  async handler(ctx) {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    const vereinList = await ctx.db
      .query("verein")
      .withIndex("by_owner", (q) => q.eq("owner", user.subject))
      .collect();

    const mitglidsVereine = await ctx.db
      .query("mitglied")
      .withIndex("by_userId", (q) => q.eq("userId", user.subject))
      .collect();

    const visibleMitgliedsVereine = (
      await Promise.all(
        mitglidsVereine.map(async (mitglied) => {
          const verein = await ctx.db.get(mitglied.vereinId);
          if (!verein) {
            return null;
          }

          const allowed = await hasPermission(ctx, verein._id, "verein.view");
          return allowed ? verein : null;
        }),
      )
    ).filter((verein) => verein !== null);

    const deduped = new Map<string, (typeof vereinList)[number]>();
    for (const verein of [...vereinList, ...visibleMitgliedsVereine]) {
      deduped.set(verein._id, verein);
    }

    return await Promise.all(
      Array.from(deduped.values()).map(async (verein) => ({
        ...verein,
        mitgliederAnzahl: await resolveMitgliederAnzahl(ctx, verein),
      })),
    );
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
  async handler(
    { db, auth, runQuery },
    { name, email, street, city, postalCode, country },
  ) {
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
      mitgliederAnzahl: 0,
    });
    return vereinId;
  },
});

export const get = query({
  args: {
    id: v.id("verein"),
  },
  async handler(ctx, { id }) {
    const access = await requirePermission(ctx, id, "verein.view");
    return {
      ...access.verein,
      mitgliederAnzahl: await resolveMitgliederAnzahl(ctx, access.verein),
    };
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
  async handler(ctx, args) {
    await requirePermission(ctx, args.id, "settings.edit");

    await ctx.db.patch(args.id, {
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
