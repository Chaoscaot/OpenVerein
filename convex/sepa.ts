import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./rbac";

export const getMembersWithSepaMandate = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async (ctx, { vereinId }) => {
        await requirePermission(ctx, vereinId, "sepa.export");

        // Get all members with SEPA mandate
        const members = await ctx.db
            .query("mitglied")
            .withIndex("by_vereinId", (q) => q.eq("vereinId", vereinId))
            .filter((q) => q.neq(q.field("sepaMandat"), undefined))
            .filter((q) => q.eq(q.field("beitragsEinzug"), "l"))
            .collect();

        // Filter out members without beitragsSatzId
        const membersWithBeitragssatz = members.filter((m) => m.beitragsSatzId !== undefined);

        // Get beitragssatz for each member
        const membersWithDetails = await Promise.all(
            membersWithBeitragssatz.map(async (member) => {
                const beitragssatz = member.beitragsSatzId ? await ctx.db.get("beitrags_satz", member.beitragsSatzId) : null;
                return {
                    ...member,
                    beitragssatz,
                };
            }),
        );

        return membersWithDetails;
    },
});
