import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const r2 = new R2(components.r2);

export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async (ctx, bucket) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }
  },
});

export const getUrl = query({
  args: { fileId: v.string() },
  async handler({ auth }, { fileId }) {
    const user = await auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }

    return r2.getUrl(fileId, {
      expiresIn: 15 * 60,
    });
  },
});

export const deleteFile = mutation({
  args: { fileId: v.string() },
  async handler(ctx, { fileId }) {
    const user = await ctx.auth.getUserIdentity();
    if (!user) {
      throw new Error("Not authenticated");
    }
    await r2.deleteObject(ctx, fileId);
  },
});
