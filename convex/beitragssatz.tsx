import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
    args: {
        vereinId: v.id("verein"),
    },
    handler: async ({ db, auth }, { vereinId }) => {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        const beitragssaetze = await db
            .query("beitrags_satz")
            .withIndex("by_verein", (q) => q.eq("vereinId", vereinId))
            .collect();

        return beitragssaetze;
    },
});
