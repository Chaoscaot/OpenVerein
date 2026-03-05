import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { normalizePermissions, requirePermission } from "./rbac";

export const list = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await requirePermission(ctx, vereinId, "rolle.view");

        return await ctx.db
            .query("vereins_rollen")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
            .collect();
    },
});

export const create = mutation({
    args: {
        vereinId: v.id("verein"),
        name: v.string(),
        berechtigungen: v.array(v.string()),
    },
    handler: async (ctx, { vereinId, name, berechtigungen }) => {
        await requirePermission(ctx, vereinId, "rolle.manage");

        const normalized = normalizePermissions(berechtigungen);

        return await ctx.db.insert("vereins_rollen", {
            vereinId,
            name,
            berechtigungen: normalized,
        });
    },
});

export const update = mutation({
    args: {
        rolleId: v.id("vereins_rollen"),
        name: v.string(),
        berechtigungen: v.array(v.string()),
    },
    handler: async (ctx, { rolleId, name, berechtigungen }) => {
        const rolle = await ctx.db.get(rolleId);
        if (!rolle) {
            throw new Error("Rolle nicht gefunden");
        }

        await requirePermission(ctx, rolle.vereinId, "rolle.manage");

        const normalized = normalizePermissions(berechtigungen);

        await ctx.db.patch(rolleId, {
            name,
            berechtigungen: normalized,
        });

        return rolleId;
    },
});

export const remove = mutation({
    args: {
        rolleId: v.id("vereins_rollen"),
    },
    handler: async (ctx, { rolleId }) => {
        const rolle = await ctx.db.get(rolleId);
        if (!rolle) {
            throw new Error("Rolle nicht gefunden");
        }

        await requirePermission(ctx, rolle.vereinId, "rolle.manage");

        const mitglieder = await ctx.db
            .query("mitglied")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", rolle.vereinId))
            .collect();

        await Promise.all(
            mitglieder.map(async (mitglied) => {
                if (!mitglied.rollen.includes(rolleId)) {
                    return;
                }

                await ctx.db.patch(mitglied._id, {
                    rollen: mitglied.rollen.filter((id) => id !== rolleId),
                });
            }),
        );

        await ctx.db.delete(rolleId);
        return rolleId;
    },
});
