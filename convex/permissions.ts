import { v } from "convex/values";
import { query } from "./_generated/server";
import { ALL_PERMISSIONS, getVereinAccess, hasPermission } from "./rbac";

const PERMISSION_GROUPS = [
    {
        key: "verein",
        label: "Verein",
        permissions: [
            { key: "verein.view", label: "Verein sehen" },
            { key: "dashboard.view", label: "Dashboard sehen" },
        ],
    },
    {
        key: "mitglieder",
        label: "Mitglieder",
        permissions: [
            { key: "mitglied.view", label: "Mitglieder sehen" },
            { key: "mitglied.create", label: "Mitglied anlegen" },
            { key: "mitglied.edit", label: "Mitglied bearbeiten" },
            { key: "mitglied.delete", label: "Mitglied löschen" },
            { key: "mitglied.linkAccount", label: "OpenVerein-Konto verknüpfen" },
        ],
    },
    {
        key: "kommunikation",
        label: "Kommunikation",
        permissions: [
            { key: "liste.view", label: "Listen sehen" },
            { key: "liste.manage", label: "Listen verwalten" },
            { key: "mail.send", label: "E-Mails versenden" },
        ],
    },
    {
        key: "aufgaben",
        label: "Aufgaben",
        permissions: [{ key: "aufgaben.viewAll", label: "Alle Aufgabenlisten sehen" }],
    },
    {
        key: "rollen",
        label: "Rollen",
        permissions: [
            { key: "rolle.view", label: "Rollen sehen" },
            { key: "rolle.manage", label: "Rollen verwalten" },
            { key: "rolle.assign", label: "Rollen zuweisen" },
        ],
    },
    {
        key: "finanzen",
        label: "Finanzen",
        permissions: [
            { key: "finanzen.view", label: "Finanzübersicht sehen" },
            { key: "kostenstelle.view", label: "Kostenstellen sehen" },
            { key: "kostenstelle.create", label: "Kostenstelle anlegen" },
            { key: "kostenstelle.edit", label: "Kostenstelle bearbeiten" },
            { key: "kostenstelle.delete", label: "Kostenstelle löschen" },
            { key: "kasse.view", label: "Kassen sehen" },
            { key: "kasse.create", label: "Kasse anlegen" },
            { key: "kasse.edit", label: "Kasse bearbeiten" },
            { key: "kasse.delete", label: "Kasse löschen" },
            { key: "buchung.view", label: "Buchungen sehen" },
            { key: "buchung.create", label: "Buchung erstellen" },
            { key: "buchung.delete", label: "Buchung löschen" },
            { key: "beitragssatz.view", label: "Beitragssätze sehen" },
            { key: "beitragssatz.create", label: "Beitragssatz anlegen" },
            { key: "beitragssatz.edit", label: "Beitragssatz bearbeiten" },
            { key: "beitragssatz.delete", label: "Beitragssatz löschen" },
            { key: "sepa.export", label: "SEPA Export" },
        ],
    },
    {
        key: "settings",
        label: "Einstellungen",
        permissions: [
            { key: "settings.view", label: "Einstellungen sehen" },
            { key: "settings.edit", label: "Einstellungen bearbeiten" },
        ],
    },
] as const;

export const listDefinitions = query({
    handler: async ({ auth }) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        return {
            all: ALL_PERMISSIONS,
            groups: PERMISSION_GROUPS,
        };
    },
});

export const getMyPermissions = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        const access = await getVereinAccess(ctx, vereinId);
        const rolleIds = Array.from(new Set(access.mitglieder.flatMap((mitglied) => mitglied.rollen)));
        const mitgliedIds = access.mitglieder.map((mitglied) => mitglied._id);

        return {
            isOwner: access.isOwner,
            permissions: Array.from(access.permissions).sort(),
            rolleIds,
            mitgliedId: mitgliedIds[0] ?? null,
            mitgliedIds,
        };
    },
});

export const has = query({
    args: {
        vereinId: v.id("verein"),
        permission: v.string(),
    },
    handler: async (ctx, { vereinId, permission }) => {
        if (!ALL_PERMISSIONS.includes(permission as (typeof ALL_PERMISSIONS)[number])) {
            return false;
        }

        return hasPermission(ctx, vereinId, permission as (typeof ALL_PERMISSIONS)[number]);
    },
});
