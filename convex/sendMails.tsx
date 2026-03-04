"use node";
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { pretty, render } from "@react-email/render";
import { VerifyEmail, ResetEmail } from "../emails/login";

export const resend: Resend = new Resend(components.resend, { testMode: false });

export const sendVerifyEmail = internalAction({
    args: {
        to: v.string(),
        link: v.string(),
    },
    handler: async (ctx, { to, link }) => {
        await resend.sendEmail(ctx, {
            from: "OpenVerein <accounts@openverein.eu>",
            to,
            subject: "Willkommen bei OpenVerein!",
            html: await render(<VerifyEmail link={link} />),
        });
    },
});

export const sendResetEmail = internalAction({
    args: {
        to: v.string(),
        link: v.string(),
    },
    handler: async (ctx, { to, link }) => {
        await resend.sendEmail(ctx, {
            from: "OpenVerein <accounts@openverein.eu>",
            to,
            subject: "Passwort zurücksetzen für OpenVerein",
            html: await render(<ResetEmail link={link} />),
        });
    },
});
