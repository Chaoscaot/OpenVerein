import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx, internalMutation, mutation, query } from "./_generated/server";
import { getVereinAccess, Permission } from "./rbac";

const SYSTEM_LISTS = [
    {
        key: "alle",
        name: "Alle",
        description: "Alle Personen im Verein unabhängig vom Status.",
    },
    {
        key: "mitglieder",
        name: "Mitglieder",
        description: "Alle aktiven Mitglieder und Fördermitglieder.",
    },
    {
        key: "ehemalige",
        name: "Ehemalige",
        description: "Personen mit Austrittsdatum oder dem Typ ausgeschieden.",
    },
    {
        key: "kontakte",
        name: "Kontakte",
        description: "Alle Personen vom Typ Kontakt.",
    },
] as const;

const LIST_READ_PERMISSIONS: Permission[] = ["liste.view", "liste.manage", "mail.send", "mitglied.view"];
const LIST_MANAGE_PERMISSIONS: Permission[] = ["liste.manage"];
const MAIL_SEND_PERMISSIONS: Permission[] = ["mail.send"];

type ReadCtx = QueryCtx | MutationCtx;
type SystemListKey = (typeof SYSTEM_LISTS)[number]["key"];
type RecipientTargetKind = "list" | "role" | "member";

type MitgliedSummary = {
    _id: Id<"mitglied">;
    vorname: string;
    nachname: string;
    email: string;
    typ: Doc<"mitglied">["typ"];
};

type RecipientTargetSummary = {
    key: string;
    name: string;
    kind: RecipientTargetKind;
    recipientCount: number;
    blockedCount: number;
};

type ResolvedRecipientTarget = {
    key: string;
    name: string;
    kind: RecipientTargetKind;
    members: Doc<"mitglied">[];
};

function toListKey(listId: Id<"mitglieder_liste">) {
    return `custom:${listId}`;
}

function toSystemListKey(key: SystemListKey) {
    return `system:${key}`;
}

function toRoleKey(roleId: Id<"vereins_rollen">) {
    return `role:${roleId}`;
}

function toMemberKey(memberId: Id<"mitglied">) {
    return `member:${memberId}`;
}

function trimAndNormalize(value: string) {
    return value.trim().replace(/\s+/g, " ");
}

function lower(value: string) {
    return trimAndNormalize(value).toLowerCase();
}

function nowIso() {
    return new Date().toISOString();
}

function toMitgliedSummary(mitglied: Doc<"mitglied">): MitgliedSummary {
    return {
        _id: mitglied._id,
        vorname: mitglied.vorname,
        nachname: mitglied.nachname,
        email: mitglied.kontakt.email,
        typ: mitglied.typ,
    };
}

function isAktivesMitglied(mitglied: Doc<"mitglied">) {
    return (mitglied.typ === "mitglied" || mitglied.typ === "fördermitglied") && !mitglied.austrittsdatum;
}

function isEhemalig(mitglied: Doc<"mitglied">) {
    return mitglied.typ === "ausgeschieden" || Boolean(mitglied.austrittsdatum);
}

function allowsListenEmails(mitglied: Doc<"mitglied">) {
    return mitglied.kommunikation?.listenEmails !== false;
}

function uniqueMemberIds(memberIds: readonly Id<"mitglied">[]) {
    return Array.from(new Set(memberIds));
}

async function requireAnyPermission(ctx: ReadCtx, vereinId: Id<"verein">, permissions: readonly Permission[]) {
    const access = await getVereinAccess(ctx, vereinId);
    if (access.isOwner) {
        return access;
    }

    if (!permissions.some((permission) => access.permissions.has(permission))) {
        throw new Error("Access denied");
    }

    return access;
}

async function loadMitglieder(ctx: ReadCtx, vereinId: Id<"verein">) {
    return await ctx.db
        .query("mitglied")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect();
}

function matchesSystemList(key: SystemListKey, mitglied: Doc<"mitglied">) {
    switch (key) {
        case "alle":
            return true;
        case "mitglieder":
            return isAktivesMitglied(mitglied);
        case "ehemalige":
            return isEhemalig(mitglied);
        case "kontakte":
            return mitglied.typ === "kontakt";
        default:
            return false;
    }
}

async function resolveSystemMembers(ctx: ReadCtx, vereinId: Id<"verein">, key: SystemListKey, mitglieder?: Doc<"mitglied">[]) {
    const resolvedMitglieder = mitglieder ?? (await loadMitglieder(ctx, vereinId));

    return resolvedMitglieder.filter((mitglied) => matchesSystemList(key, mitglied));
}

async function loadListOverviewEntries(ctx: ReadCtx, vereinId: Id<"verein">) {
    const [mitglieder, customLists] = await Promise.all([
        loadMitglieder(ctx, vereinId),
        ctx.db
            .query("mitglieder_liste")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
            .collect(),
    ]);

    const systemLists = SYSTEM_LISTS.map((definition) => ({
        key: toSystemListKey(definition.key),
        name: definition.name,
        description: definition.description,
        kind: "system" as const,
        memberCount: mitglieder.filter((mitglied) => matchesSystemList(definition.key, mitglied)).length,
    }));

    const customListSummaries = await Promise.all(
        customLists.map(async (liste) => {
            const eintraege = await ctx.db
                .query("listen_eintrag")
                .withIndex("by_listeId", (q) => q.eq("listeId", liste._id))
                .collect();

            return {
                key: toListKey(liste._id),
                name: liste.name,
                description: "Benutzerdefinierte Liste",
                kind: "custom" as const,
                memberCount: eintraege.length,
                listId: liste._id,
            };
        }),
    );

    return [...systemLists, ...customListSummaries.sort((left, right) => left.name.localeCompare(right.name, "de"))];
}

async function ensureUniqueListName(ctx: MutationCtx, vereinId: Id<"verein">, name: string, excludeId?: Id<"mitglieder_liste">) {
    const existing = await ctx.db
        .query("mitglieder_liste")
        .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
        .collect();

    const duplicate = existing.find((liste) => liste._id !== excludeId && lower(liste.name) === lower(name));
    if (duplicate) {
        throw new Error("Eine Liste mit diesem Namen existiert bereits");
    }
}

async function ensureMembersBelongToVerein(ctx: MutationCtx, vereinId: Id<"verein">, memberIds: readonly Id<"mitglied">[]) {
    const uniqueIds = uniqueMemberIds(memberIds);
    const members = await Promise.all(uniqueIds.map((mitgliedId) => ctx.db.get(mitgliedId)));

    for (const member of members) {
        if (!member || member.vereinId !== vereinId) {
            throw new Error("Mindestens ein ausgewähltes Mitglied gehört nicht zu diesem Verein");
        }
    }
}

async function loadCustomListMembers(ctx: ReadCtx, vereinId: Id<"verein">, listId: Id<"mitglieder_liste">) {
    const liste = await ctx.db.get(listId);
    if (!liste || liste.vereinId !== vereinId) {
        throw new Error("Liste nicht gefunden");
    }

    const eintraege = await ctx.db
        .query("listen_eintrag")
        .withIndex("by_listeId", (q) => q.eq("listeId", listId))
        .collect();

    const members = (
        await Promise.all(
            eintraege.map(async (eintrag) => {
                const mitglied = await ctx.db.get(eintrag.mitgliedId);
                if (!mitglied || mitglied.vereinId !== vereinId) {
                    return null;
                }
                return mitglied;
            }),
        )
    ).filter((mitglied): mitglied is Doc<"mitglied"> => mitglied !== null);

    return {
        liste,
        members,
    };
}

async function resolveMembersForListKey(
    ctx: ReadCtx,
    vereinId: Id<"verein">,
    listKey: string,
    options?: {
        mitglieder?: Doc<"mitglied">[];
        memberById?: Map<Id<"mitglied">, Doc<"mitglied">>;
    },
) {
    if (listKey.startsWith("system:")) {
        const systemKey = listKey.slice("system:".length) as SystemListKey;
        const definition = SYSTEM_LISTS.find((liste) => liste.key === systemKey);
        if (!definition) {
            throw new Error("Unbekannte Systemliste");
        }

        return {
            key: listKey,
            name: definition.name,
            members: await resolveSystemMembers(ctx, vereinId, systemKey, options?.mitglieder),
        };
    }

    if (listKey.startsWith("custom:")) {
        const listId = listKey.slice("custom:".length) as Id<"mitglieder_liste">;
        const { liste, members } = await loadCustomListMembers(ctx, vereinId, listId);
        return {
            key: listKey,
            name: liste.name,
            members,
        };
    }

    throw new Error("Ungültiger Listenschlüssel");
}

async function resolveRecipientTarget(
    ctx: ReadCtx,
    vereinId: Id<"verein">,
    targetKey: string,
    options?: {
        mitglieder?: Doc<"mitglied">[];
        memberById?: Map<Id<"mitglied">, Doc<"mitglied">>;
        roleById?: Map<Id<"vereins_rollen">, Doc<"vereins_rollen">>;
    },
): Promise<ResolvedRecipientTarget> {
    if (targetKey.startsWith("system:") || targetKey.startsWith("custom:")) {
        const resolvedList = await resolveMembersForListKey(ctx, vereinId, targetKey, options);

        return {
            ...resolvedList,
            kind: "list",
        };
    }

    if (targetKey.startsWith("role:")) {
        const roleId = targetKey.slice("role:".length) as Id<"vereins_rollen">;
        const rolle = options?.roleById?.get(roleId) ?? (await ctx.db.get(roleId));
        if (!rolle || rolle.vereinId !== vereinId) {
            throw new Error("Rolle nicht gefunden");
        }

        const mitglieder = options?.mitglieder ?? (await loadMitglieder(ctx, vereinId));
        return {
            key: targetKey,
            name: rolle.name,
            kind: "role",
            members: mitglieder.filter((mitglied) => mitglied.rollen.includes(roleId)),
        };
    }

    if (targetKey.startsWith("member:")) {
        const memberId = targetKey.slice("member:".length) as Id<"mitglied">;
        const mitglied = options?.memberById?.get(memberId) ?? (await ctx.db.get(memberId));
        if (!mitglied || mitglied.vereinId !== vereinId) {
            throw new Error("Person nicht gefunden");
        }

        return {
            key: targetKey,
            name: `${mitglied.vorname} ${mitglied.nachname}`.trim(),
            kind: "member",
            members: [mitglied],
        };
    }

    throw new Error("Ungültiges Empfängerziel");
}

async function collectRecipientsForTargetKeys(ctx: ReadCtx, vereinId: Id<"verein">, targetKeys: string[]) {
    const uniqueTargetKeys = Array.from(new Set(targetKeys));
    if (uniqueTargetKeys.length === 0) {
        return {
            targetKeys: uniqueTargetKeys,
            targetNames: [] as string[],
            targetSummaries: [] as RecipientTargetSummary[],
            recipients: [] as MitgliedSummary[],
            recipientEmails: [] as string[],
            recipientCount: 0,
            blockedCount: 0,
        };
    }

    const needsMitglieder = uniqueTargetKeys.some((targetKey) => targetKey.startsWith("system:") || targetKey.startsWith("role:") || targetKey.startsWith("member:"));
    const needsRollen = uniqueTargetKeys.some((targetKey) => targetKey.startsWith("role:"));

    const [mitglieder, rollen] = await Promise.all([
        needsMitglieder ? loadMitglieder(ctx, vereinId) : Promise.resolve([]),
        needsRollen
            ? ctx.db
                  .query("vereins_rollen")
                  .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
                  .collect()
            : Promise.resolve([]),
    ]);

    const memberById = new Map(mitglieder.map((mitglied) => [mitglied._id, mitglied]));
    const roleById = new Map(rollen.map((rolle) => [rolle._id, rolle]));
    const recipientsByEmail = new Map<string, MitgliedSummary>();
    const blockedEmails = new Set<string>();
    const targetNames: string[] = [];
    const targetSummaries: RecipientTargetSummary[] = [];

    for (const targetKey of uniqueTargetKeys) {
        const { name, kind, members } = await resolveRecipientTarget(ctx, vereinId, targetKey, {
            mitglieder,
            memberById,
            roleById,
        });

        targetNames.push(name);

        const membersWithEmail = members.filter((mitglied) => trimAndNormalize(mitglied.kontakt.email).length > 0);
        const sendableMembers = membersWithEmail.filter((mitglied) => allowsListenEmails(mitglied));
        const blockedMembers = membersWithEmail.filter((mitglied) => !allowsListenEmails(mitglied));

        targetSummaries.push({
            key: targetKey,
            name,
            kind,
            recipientCount: sendableMembers.length,
            blockedCount: blockedMembers.length,
        });

        for (const member of blockedMembers) {
            blockedEmails.add(member.kontakt.email.trim().toLowerCase());
        }

        for (const member of sendableMembers) {
            const email = member.kontakt.email.trim().toLowerCase();
            if (!recipientsByEmail.has(email)) {
                recipientsByEmail.set(email, toMitgliedSummary(member));
            }
        }
    }

    const recipients = Array.from(recipientsByEmail.values()).sort((left, right) => `${left.nachname} ${left.vorname}`.localeCompare(`${right.nachname} ${right.vorname}`, "de"));

    return {
        targetKeys: uniqueTargetKeys,
        targetNames,
        targetSummaries,
        recipients,
        recipientEmails: recipients.map((recipient) => recipient.email),
        recipientCount: recipients.length,
        blockedCount: blockedEmails.size,
    };
}

export const overview = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await requireAnyPermission(ctx, vereinId, LIST_READ_PERMISSIONS);

        return await loadListOverviewEntries(ctx, vereinId);
    },
});

export const recipientTargets = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await requireAnyPermission(ctx, vereinId, [...LIST_READ_PERMISSIONS, ...MAIL_SEND_PERMISSIONS]);

        const [listEntries, rollen, mitglieder] = await Promise.all([
            loadListOverviewEntries(ctx, vereinId),
            ctx.db
                .query("vereins_rollen")
                .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
                .collect(),
            loadMitglieder(ctx, vereinId),
        ]);

        const roleTargets = rollen
            .map((rolle) => {
                const membersWithEmail = mitglieder.filter((mitglied) => mitglied.rollen.includes(rolle._id) && trimAndNormalize(mitglied.kontakt.email).length > 0);
                const blockedCount = membersWithEmail.filter((mitglied) => !allowsListenEmails(mitglied)).length;

                return {
                    key: toRoleKey(rolle._id),
                    name: rolle.name,
                    description: blockedCount > 0 ? `${membersWithEmail.length - blockedCount} erreichbar · ${blockedCount} abgemeldet` : `${membersWithEmail.length} erreichbare Personen`,
                    kind: "role" as const,
                    recipientCount: membersWithEmail.length - blockedCount,
                    blockedCount,
                };
            })
            .sort((left, right) => left.name.localeCompare(right.name, "de"));

        const memberTargets = mitglieder
            .filter((mitglied) => trimAndNormalize(mitglied.kontakt.email).length > 0)
            .map((mitglied) => ({
                key: toMemberKey(mitglied._id),
                name: `${mitglied.vorname} ${mitglied.nachname}`.trim(),
                description: allowsListenEmails(mitglied) ? mitglied.kontakt.email.trim() : `${mitglied.kontakt.email.trim()} · abgemeldet`,
                kind: "member" as const,
                recipientCount: allowsListenEmails(mitglied) ? 1 : 0,
                blockedCount: allowsListenEmails(mitglied) ? 0 : 1,
            }))
            .sort((left, right) => left.name.localeCompare(right.name, "de"));

        const listTargets = listEntries.map((entry) => ({
            key: entry.key,
            name: entry.name,
            description: entry.memberCount === 1 ? `${entry.description} · 1 Person` : `${entry.description} · ${entry.memberCount} Personen`,
            kind: "list" as const,
            recipientCount: entry.memberCount,
            blockedCount: 0,
        }));

        return [...listTargets, ...roleTargets, ...memberTargets];
    },
});

export const customLists = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await requireAnyPermission(ctx, vereinId, LIST_MANAGE_PERMISSIONS);

        const listen = await ctx.db
            .query("mitglieder_liste")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
            .collect();

        const result = await Promise.all(
            listen.map(async (liste) => {
                const { members } = await loadCustomListMembers(ctx, vereinId, liste._id);
                const sortedMembers = members.slice().sort((left, right) => `${left.nachname} ${left.vorname}`.localeCompare(`${right.nachname} ${right.vorname}`, "de"));

                return {
                    _id: liste._id,
                    key: toListKey(liste._id),
                    name: liste.name,
                    members: sortedMembers.map(toMitgliedSummary),
                    memberIds: sortedMembers.map((mitglied) => mitglied._id),
                    memberCount: sortedMembers.length,
                };
            }),
        );

        return result.sort((left, right) => left.name.localeCompare(right.name, "de"));
    },
});

export const availableMembers = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await requireAnyPermission(ctx, vereinId, LIST_MANAGE_PERMISSIONS);

        const mitglieder = await loadMitglieder(ctx, vereinId);
        return mitglieder.map(toMitgliedSummary).sort((left, right) => `${left.nachname} ${left.vorname}`.localeCompare(`${right.nachname} ${right.vorname}`, "de"));
    },
});

export const create = mutation({
    args: {
        vereinId: v.id("verein"),
        name: v.string(),
        memberIds: v.array(v.id("mitglied")),
    },
    handler: async (ctx, { vereinId, name, memberIds }) => {
        await requireAnyPermission(ctx, vereinId, LIST_MANAGE_PERMISSIONS);

        const normalizedName = trimAndNormalize(name);
        if (!normalizedName) {
            throw new Error("Bitte gib einen Listennamen ein");
        }

        const uniqueIds = uniqueMemberIds(memberIds);
        await ensureUniqueListName(ctx, vereinId, normalizedName);
        await ensureMembersBelongToVerein(ctx, vereinId, uniqueIds);

        const listeId = await ctx.db.insert("mitglieder_liste", {
            vereinId,
            name: normalizedName,
        });

        await Promise.all(
            uniqueIds.map((mitgliedId) =>
                ctx.db.insert("listen_eintrag", {
                    listeId,
                    mitgliedId,
                }),
            ),
        );

        return listeId;
    },
});

export const update = mutation({
    args: {
        listeId: v.id("mitglieder_liste"),
        name: v.string(),
        memberIds: v.array(v.id("mitglied")),
    },
    handler: async (ctx, { listeId, name, memberIds }) => {
        const liste = await ctx.db.get(listeId);
        if (!liste) {
            throw new Error("Liste nicht gefunden");
        }

        await requireAnyPermission(ctx, liste.vereinId, LIST_MANAGE_PERMISSIONS);

        const normalizedName = trimAndNormalize(name);
        if (!normalizedName) {
            throw new Error("Bitte gib einen Listennamen ein");
        }

        const uniqueIds = uniqueMemberIds(memberIds);
        await ensureUniqueListName(ctx, liste.vereinId, normalizedName, listeId);
        await ensureMembersBelongToVerein(ctx, liste.vereinId, uniqueIds);

        const existingEntries = await ctx.db
            .query("listen_eintrag")
            .withIndex("by_listeId", (q) => q.eq("listeId", listeId))
            .collect();

        const existingIds = new Set(existingEntries.map((eintrag) => eintrag.mitgliedId));
        const nextIds = new Set(uniqueIds);

        await ctx.db.patch(listeId, { name: normalizedName });

        await Promise.all(existingEntries.filter((eintrag) => !nextIds.has(eintrag.mitgliedId)).map((eintrag) => ctx.db.delete(eintrag._id)));

        await Promise.all(
            uniqueIds
                .filter((mitgliedId) => !existingIds.has(mitgliedId))
                .map((mitgliedId) =>
                    ctx.db.insert("listen_eintrag", {
                        listeId,
                        mitgliedId,
                    }),
                ),
        );

        return listeId;
    },
});

export const remove = mutation({
    args: {
        listeId: v.id("mitglieder_liste"),
    },
    handler: async (ctx, { listeId }) => {
        const liste = await ctx.db.get(listeId);
        if (!liste) {
            throw new Error("Liste nicht gefunden");
        }

        await requireAnyPermission(ctx, liste.vereinId, LIST_MANAGE_PERMISSIONS);

        const entries = await ctx.db
            .query("listen_eintrag")
            .withIndex("by_listeId", (q) => q.eq("listeId", listeId))
            .collect();

        await Promise.all(entries.map((eintrag) => ctx.db.delete(eintrag._id)));
        await ctx.db.delete(listeId);

        return listeId;
    },
});

export const previewRecipients = query({
    args: {
        vereinId: v.id("verein"),
        targetKeys: v.array(v.string()),
    },
    handler: async (ctx, { vereinId, targetKeys }) => {
        await requireAnyPermission(ctx, vereinId, [...LIST_READ_PERMISSIONS, ...MAIL_SEND_PERMISSIONS]);

        const preview = await collectRecipientsForTargetKeys(ctx, vereinId, targetKeys);

        return {
            targetSummaries: preview.targetSummaries,
            recipients: preview.recipients,
            recipientCount: preview.recipientCount,
            blockedCount: preview.blockedCount,
        };
    },
});

export const sendMail = mutation({
    args: {
        vereinId: v.id("verein"),
        targetKeys: v.array(v.string()),
        subject: v.string(),
        body: v.string(),
        attachments: v.array(
            v.object({
                fileId: v.string(),
                name: v.string(),
                mimeType: v.optional(v.string()),
                size: v.number(),
            }),
        ),
    },
    handler: async (ctx, { vereinId, targetKeys, subject, body, attachments }) => {
        const access = await requireAnyPermission(ctx, vereinId, MAIL_SEND_PERMISSIONS);
        const user = await ctx.auth.getUserIdentity();

        const normalizedSubject = trimAndNormalize(subject);
        if (!normalizedSubject) {
            throw new Error("Bitte gib einen Betreff ein");
        }

        const normalizedBody = body.trim();
        if (!normalizedBody) {
            throw new Error("Bitte gib einen Nachrichtentext ein");
        }

        if (targetKeys.length === 0) {
            throw new Error("Bitte wähle mindestens ein Empfängerziel aus");
        }

        const resolvedRecipients = await collectRecipientsForTargetKeys(ctx, vereinId, targetKeys);

        const recipientEmails = resolvedRecipients.recipientEmails;
        if (recipientEmails.length === 0) {
            throw new Error("Keine empfangsbereiten Empfänger mit E-Mail-Adresse gefunden");
        }

        const totalAttachmentSize = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
        const maxTotalAttachmentSize = 25 * 1024 * 1024;
        if (totalAttachmentSize > maxTotalAttachmentSize) {
            throw new Error("Die Anhänge sind zusammen zu groß. Bitte bleibe unter 25 MB.");
        }

        const requestedByEmail = typeof user?.email === "string" ? user.email : undefined;
        const mailHistoryId = await ctx.db.insert("mail_versand", {
            vereinId,
            subject: normalizedSubject,
            body: normalizedBody,
            listKeys: resolvedRecipients.targetKeys,
            listNames: resolvedRecipients.targetNames,
            recipientCount: recipientEmails.length,
            requestedByUserId: typeof user?.subject === "string" ? user.subject : undefined,
            requestedByEmail,
            toEmail: access.verein.contact.email,
            replyTo: access.verein.contact.email,
            attachments: attachments.map(({ name, mimeType, size }) => ({
                name,
                mimeType,
                size,
            })),
            status: "queued",
            createdAt: nowIso(),
        });

        await ctx.scheduler.runAfter(0, internal.sendMails.sendListenEmail, {
            vereinId,
            vereinName: access.verein.name,
            subject: normalizedSubject,
            body: normalizedBody,
            toEmail: access.verein.contact.email,
            replyTo: access.verein.contact.email,
            requestedByEmail,
            recipientEmails,
            listNames: resolvedRecipients.targetNames,
            attachments,
            mailHistoryId,
        });

        return {
            recipientCount: recipientEmails.length,
            mailHistoryId,
        };
    },
});

export const history = query({
    args: {
        vereinId: v.id("verein"),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, { vereinId, limit }) => {
        await requireAnyPermission(ctx, vereinId, [...LIST_READ_PERMISSIONS, ...MAIL_SEND_PERMISSIONS]);

        const safeLimit = Math.max(1, Math.min(limit ?? 10, 50));

        return await ctx.db
            .query("mail_versand")
            .withIndex("by_vereinId_createdAt", (q) => q.eq("vereinId", vereinId))
            .order("desc")
            .take(safeLimit);
    },
});

export const markMailHistorySent = internalMutation({
    args: {
        mailHistoryId: v.id("mail_versand"),
        sentMessages: v.number(),
        providerMessageIds: v.array(v.string()),
    },
    handler: async (ctx, { mailHistoryId, sentMessages, providerMessageIds }) => {
        const existing = await ctx.db.get(mailHistoryId);
        if (!existing) {
            return null;
        }

        await ctx.db.patch(mailHistoryId, {
            status: "sent",
            sentMessages,
            providerMessageIds,
            completedAt: nowIso(),
        });

        return mailHistoryId;
    },
});

export const markMailHistoryFailed = internalMutation({
    args: {
        mailHistoryId: v.id("mail_versand"),
        errorMessage: v.string(),
        sentMessages: v.optional(v.number()),
        providerMessageIds: v.optional(v.array(v.string())),
    },
    handler: async (ctx, { mailHistoryId, errorMessage, sentMessages, providerMessageIds }) => {
        const existing = await ctx.db.get(mailHistoryId);
        if (!existing) {
            return null;
        }

        const patch: Partial<Doc<"mail_versand">> = {
            status: "failed",
            lastError: errorMessage,
            completedAt: nowIso(),
        };

        if (typeof sentMessages === "number") {
            patch.sentMessages = sentMessages;
        }

        if (providerMessageIds) {
            patch.providerMessageIds = providerMessageIds;
        }

        await ctx.db.patch(mailHistoryId, patch);

        return mailHistoryId;
    },
});
