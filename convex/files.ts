import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
    async handler({ auth, storage }) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }
        return await storage.generateUploadUrl();
    },
});

export const getUrl = query({
    args: {
        fileId: v.id("_storage"),
    },
    async handler({ auth, storage }, { fileId }) {
        const user = await auth.getUserIdentity();
        if (!user) {
            throw new Error("Not authenticated");
        }

        return await storage.getUrl(fileId);
    },
});
