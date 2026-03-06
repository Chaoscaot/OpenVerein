import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, MutationCtx, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission } from "./rbac";

async function ensureRoleIdsBelongToVerein(ctx: MutationCtx, vereinId: Id<"verein">, rollen: readonly Id<"vereins_rollen">[]) {
    for (const rolleId of rollen) {
        const rolle = await ctx.db.get(rolleId);
        if (!rolle || rolle.vereinId !== vereinId) {
            throw new Error("Mindestens eine Rolle gehört nicht zu diesem Verein");
        }
    }
}

function nowIso() {
    return new Date().toISOString();
}

function createLinkToken() {
    return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

export const list = query({
    args: {
        vereinId: v.id("verein"),
    },
    async handler(ctx, { vereinId }) {
        await requirePermission(ctx, vereinId, "mitglied.view");

        const mitglieder = await ctx.db
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
    async handler(ctx, { vereinId, searchTerm }) {
        await requirePermission(ctx, vereinId, "mitglied.view");

        if (searchTerm.trim().length === 0) {
            return await ctx.db
                .query("mitglied")
                .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
                .take(20);
        }

        const mitglieder = await ctx.db
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
    async handler(ctx, { id }) {
        if (!id) {
            return null;
        }

        const mitglied = await ctx.db.get("mitglied", id);
        if (!mitglied) {
            return null;
        }

        await requirePermission(ctx, mitglied.vereinId, "mitglied.view");
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
            }),
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
            }),
        ),
        parent: v.optional(v.id("mitglied")),
        userId: v.optional(v.string()),
        rollen: v.optional(v.array(v.id("vereins_rollen"))),
    },
    handler: async (ctx, values) => {
        await requirePermission(ctx, values.vereinId, "mitglied.create");

        const verein = await ctx.db.get("verein", values.vereinId);
        if (!verein) {
            throw new Error("Verein not found");
        }

        if (values.userId) {
            await requirePermission(ctx, values.vereinId, "mitglied.linkAccount");
        }

        if (values.rollen && values.rollen.length > 0) {
            await requirePermission(ctx, values.vereinId, "rolle.assign");
            await ensureRoleIdsBelongToVerein(ctx as MutationCtx, values.vereinId, values.rollen);
        }

        const mitgliedId = await ctx.db.insert("mitglied", {
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
            rollen: values.rollen ?? [],
            userId: values.userId,
        });

        await ctx.db.patch("verein", values.vereinId, {
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
            }),
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
            }),
        ),
        parent: v.optional(v.id("mitglied")),
        userId: v.optional(v.string()),
        rollen: v.optional(v.array(v.id("vereins_rollen"))),
    },
    handler: async (ctx, values) => {
        const existing = await ctx.db.get("mitglied", values.id);
        if (!existing) {
            throw new Error("Mitglied not found");
        }

        await requirePermission(ctx, existing.vereinId, "mitglied.edit");

        const patch: Partial<Doc<"mitglied">> = {
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
        };

        if (values.userId !== undefined) {
            await requirePermission(ctx, existing.vereinId, "mitglied.linkAccount");
            patch.userId = values.userId;
        }

        if (values.rollen !== undefined) {
            await requirePermission(ctx, existing.vereinId, "rolle.assign");
            await ensureRoleIdsBelongToVerein(ctx as MutationCtx, existing.vereinId, values.rollen);
            patch.rollen = values.rollen;
        }

        await ctx.db.patch("mitglied", values.id, patch);

        return values.id;
    },
});

export const remove = mutation({
    args: {
        id: v.id("mitglied"),
    },
    handler: async (ctx, { id }) => {
        const mitglied = await ctx.db.get("mitglied", id);
        if (!mitglied) {
            throw new Error("Mitglied not found");
        }

        await requirePermission(ctx, mitglied.vereinId, "mitglied.delete");

        // Delete associated files
        for (const file of mitglied.datein) {
            // Note: You may want to call a file deletion function here
        }

        const listenEintraege = await ctx.db
            .query("listen_eintrag")
            .withIndex("by_mitgliedId", (q) => q.eq("mitgliedId", id))
            .collect();

        await Promise.all(listenEintraege.map((eintrag) => ctx.db.delete(eintrag._id)));

        await ctx.db.delete("mitglied", id);
    },
});

export const requestAccountLinkInvite = mutation({
    args: {
        mitgliedId: v.id("mitglied"),
        email: v.string(),
    },
    handler: async (ctx, { mitgliedId, email }) => {
        const mitglied = await ctx.db.get(mitgliedId);
        if (!mitglied) {
            throw new Error("Mitglied not found");
        }

        await requirePermission(ctx, mitglied.vereinId, "mitglied.linkAccount");

        const verein = await ctx.db.get(mitglied.vereinId);
        if (!verein) {
            throw new Error("Verein not found");
        }

        const existingInvites = await ctx.db
            .query("mitglied_konto_link_invite")
            .withIndex("by_mitgliedId", (q) => q.eq("mitgliedId", mitgliedId))
            .collect();

        const usedAt = nowIso();
        await Promise.all(existingInvites.filter((invite) => !invite.usedAt).map((invite) => ctx.db.patch(invite._id, { usedAt })));

        const createdAt = nowIso();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
        const token = createLinkToken();

        const inviteId = await ctx.db.insert("mitglied_konto_link_invite", {
            vereinId: mitglied.vereinId,
            mitgliedId,
            email,
            token,
            createdAt,
            expiresAt,
        });

        const siteUrl = process.env.SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "http://localhost:3000";
        const link = `${siteUrl.replace(/\/$/, "")}/link-mitglied?token=${encodeURIComponent(token)}`;

        await ctx.scheduler.runAfter(0, internal.sendMails.sendMitgliedLinkInviteEmail, {
            to: email,
            link,
            vereinName: verein.name,
            mitgliedName: `${mitglied.vorname} ${mitglied.nachname}`,
        });

        return inviteId;
    },
});

export const removeAccountLink = mutation({
    args: {
        mitgliedId: v.id("mitglied"),
    },
    handler: async (ctx, { mitgliedId }) => {
        const mitglied = await ctx.db.get(mitgliedId);
        if (!mitglied) {
            throw new Error("Mitglied not found");
        }

        await requirePermission(ctx, mitglied.vereinId, "mitglied.linkAccount");

        await ctx.db.patch(mitgliedId, {
            userId: undefined,
        });

        return mitgliedId;
    },
});

export const getAccountLinkInviteInfo = query({
    args: {
        token: v.string(),
    },
    handler: async (ctx, { token }) => {
        const invite = await ctx.db
            .query("mitglied_konto_link_invite")
            .withIndex("by_token", (q) => q.eq("token", token))
            .first();

        if (!invite) {
            return { status: "invalid" as const };
        }

        if (invite.usedAt) {
            return { status: "used" as const };
        }

        if (new Date(invite.expiresAt).getTime() < Date.now()) {
            return { status: "expired" as const };
        }

        const mitglied = await ctx.db.get(invite.mitgliedId);
        const verein = await ctx.db.get(invite.vereinId);

        if (!mitglied || !verein) {
            return { status: "invalid" as const };
        }

        return {
            status: "pending" as const,
            vereinName: verein.name,
            mitgliedName: `${mitglied.vorname} ${mitglied.nachname}`,
            email: invite.email,
        };
    },
});

export const acceptAccountLinkInvite = mutation({
    args: {
        token: v.string(),
    },
    handler: async (ctx, { token }) => {
        const user = await ctx.auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const invite = await ctx.db
            .query("mitglied_konto_link_invite")
            .withIndex("by_token", (q) => q.eq("token", token))
            .first();

        if (!invite) {
            throw new Error("Einladung ungültig");
        }

        if (invite.usedAt) {
            throw new Error("Einladung wurde bereits verwendet");
        }

        if (new Date(invite.expiresAt).getTime() < Date.now()) {
            throw new Error("Einladung ist abgelaufen");
        }

        const mitglied = await ctx.db.get(invite.mitgliedId);
        if (!mitglied) {
            throw new Error("Mitglied not found");
        }

        await ctx.db.patch(invite.mitgliedId, {
            userId: user.subject,
        });

        await ctx.db.patch(invite._id, {
            usedAt: nowIso(),
        });

        return invite.mitgliedId;
    },
});
