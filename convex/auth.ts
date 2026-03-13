import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { api, components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { betterAuth } from "better-auth/minimal";
import authConfig from "./auth.config";
import { requireActionCtx } from "@convex-dev/better-auth/utils";

const siteUrl = process.env.SITE_URL!;

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      revokeSessionsOnPasswordReset: true,
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: true,
      sendResetPassword: async ({ user, url }) => {
        await requireActionCtx(ctx).scheduler.runAfter(
          0,
          internal.sendMails.sendResetEmail,
          {
            to: user.email,
            link: url,
          },
        );
      },
    },

    emailVerification: {
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const verificationUrl = new URL(url);
        verificationUrl.searchParams.set(
          "callbackURL",
          `${siteUrl}/verify-email/confirmed`,
        );
        await requireActionCtx(ctx).scheduler.runAfter(
          0,
          internal.sendMails.sendVerifyEmail,
          {
            to: user.email,
            link: verificationUrl.toString(),
          },
        );
      },
    },
    plugins: [convex({ authConfig })],
  });
};

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return authComponent.getAuthUser(ctx);
  },
});
