import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { internalMutation } from "./_generated/server";

export const resend: Resend = new Resend(components.resend, { testMode: false });

export const sendTestEmail = internalMutation({
    handler: async (ctx) => {
        await resend.sendEmail(ctx, {
            from: "OpenVerein <verein@openverein.eu>",
            to: "max@maxsp.de",
            replyTo: ["test@example.com"],
            subject: "Hi there",
            html: "This is a test email",
        });
    },
});
