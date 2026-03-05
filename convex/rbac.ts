import { Doc, Id } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

export const ALL_PERMISSIONS = [
    "verein.view",
    "dashboard.view",
    "mitglied.view",
    "mitglied.create",
    "mitglied.edit",
    "mitglied.delete",
    "mitglied.linkAccount",
    "rolle.view",
    "rolle.manage",
    "rolle.assign",
    "finanzen.view",
    "kasse.view",
    "kasse.create",
    "kasse.edit",
    "kasse.delete",
    "buchung.view",
    "buchung.create",
    "buchung.delete",
    "beitragssatz.view",
    "beitragssatz.create",
    "beitragssatz.edit",
    "beitragssatz.delete",
    "sepa.export",
    "settings.view",
    "settings.edit",
] as const;

const PERMISSION_SET = new Set<string>(ALL_PERMISSIONS);

export type Permission = (typeof ALL_PERMISSIONS)[number];

type Ctx = QueryCtx | MutationCtx;

export type VereinAccess = {
    userSubject: string;
    verein: Doc<"verein">;
    mitglied: Doc<"mitglied"> | null;
    mitglieder: Doc<"mitglied">[];
    isOwner: boolean;
    permissions: Set<Permission>;
};

function asPermission(value: string): Permission | null {
    if (PERMISSION_SET.has(value)) {
        return value as Permission;
    }
    return null;
}

export function normalizePermissions(values: string[]): Permission[] {
    const deduped = new Set<Permission>();
    for (const value of values) {
        const permission = asPermission(value);
        if (!permission) {
            throw new Error(`Ungültige Berechtigung: ${value}`);
        }
        deduped.add(permission);
    }
    return Array.from(deduped);
}

export async function requireAuth(ctx: Ctx) {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
        throw new Error("Not authenticated");
    }
    return user;
}

async function getAccessBase(ctx: Ctx, vereinId: Id<"verein">): Promise<VereinAccess> {
    const user = await requireAuth(ctx);
    const verein = await ctx.db.get(vereinId);
    if (!verein) {
        throw new Error("Verein not found");
    }

    if (verein.owner === user.subject) {
        return {
            userSubject: user.subject,
            verein,
            mitglied: null,
            mitglieder: [],
            isOwner: true,
            permissions: new Set<Permission>(ALL_PERMISSIONS),
        };
    }

    const mitglieder = await ctx.db
        .query("mitglied")
        .withIndex("by_userId_vereinId", (q) => q.eq("userId", user.subject).eq("vereinId", vereinId))
        .collect();

    if (mitglieder.length === 0) {
        throw new Error("Access denied");
    }

    const rollen = await Promise.all(mitglieder.flatMap((mitglied) => mitglied.rollen).map((rolleId) => ctx.db.get(rolleId)));
    const permissions = new Set<Permission>();

    for (const rolle of rollen) {
        if (!rolle || rolle.vereinId !== vereinId) {
            continue;
        }
        for (const permissionValue of rolle.berechtigungen) {
            const permission = asPermission(permissionValue);
            if (permission) {
                permissions.add(permission);
            }
        }
    }

    return {
        userSubject: user.subject,
        verein,
        mitglied: mitglieder[0] ?? null,
        mitglieder,
        isOwner: false,
        permissions,
    };
}

export async function getVereinAccess(ctx: Ctx, vereinId: Id<"verein">) {
    return getAccessBase(ctx, vereinId);
}

export async function requirePermission(ctx: Ctx, vereinId: Id<"verein">, permission: Permission) {
    const access = await getAccessBase(ctx, vereinId);
    if (!access.isOwner && !access.permissions.has(permission)) {
        throw new Error("Access denied");
    }
    return access;
}

export async function hasPermission(ctx: Ctx, vereinId: Id<"verein">, permission: Permission) {
    try {
        const access = await getAccessBase(ctx, vereinId);
        return access.isOwner || access.permissions.has(permission);
    } catch {
        return false;
    }
}
