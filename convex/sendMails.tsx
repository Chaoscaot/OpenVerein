"use node";
import { components } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { VerifyEmail, ResetEmail, MitgliedLinkEmail, ListenMailEmail } from "../emails/login";
import { r2 } from "./files";

const MAX_RECIPIENTS_PER_MESSAGE = 49;

function chunk<T>(values: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
        chunks.push(values.slice(index, index + size));
    }
    return chunks;
}

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

export const sendMitgliedLinkInviteEmail = internalAction({
    args: {
        to: v.string(),
        link: v.string(),
        vereinName: v.string(),
        mitgliedName: v.string(),
    },
    handler: async (ctx, { to, link, vereinName, mitgliedName }) => {
        await resend.sendEmail(ctx, {
            from: "OpenVerein <accounts@openverein.eu>",
            to,
            subject: `Mitgliedschaft in ${vereinName} verknüpfen`,
            html: await render(<MitgliedLinkEmail link={link} vereinName={vereinName} mitgliedName={mitgliedName} />),
        });
    },
});

export const sendListenEmail = internalAction({
    args: {
        vereinId: v.id("verein"),
        vereinName: v.string(),
        subject: v.string(),
        body: v.string(),
        toEmail: v.string(),
        replyTo: v.string(),
        requestedByEmail: v.optional(v.string()),
        recipientEmails: v.array(v.string()),
        listNames: v.array(v.string()),
        attachments: v.array(
            v.object({
                fileId: v.string(),
                name: v.string(),
                mimeType: v.optional(v.string()),
                size: v.number(),
            }),
        ),
    },
    handler: async (ctx, args) => {
        if (!process.env.RESEND_API_KEY) {
            throw new Error("RESEND_API_KEY ist nicht gesetzt");
        }

        const html = await render(<ListenMailEmail vereinName={args.vereinName} subject={args.subject} body={args.body} listNames={args.listNames} />);
        const text = `${args.subject}\n\n${args.body}`;

        const attachmentPayload = await Promise.all(
            args.attachments.map(async (attachment) => {
                const url = await r2.getUrl(attachment.fileId, { expiresIn: 15 * 60 });
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Anhang ${attachment.name} konnte nicht geladen werden`);
                }

                const content = Buffer.from(await response.arrayBuffer()).toString("base64");
                return {
                    filename: attachment.name,
                    content,
                    contentType: attachment.mimeType,
                };
            }),
        );

        const recipientChunks = chunk(Array.from(new Set(args.recipientEmails.map((email) => email.trim()).filter(Boolean))), MAX_RECIPIENTS_PER_MESSAGE);

        for (const recipients of recipientChunks) {
            await resend.sendEmailManually(
                ctx,
                {
                    from: "OpenVerein <accounts@openverein.eu>",
                    to: args.requestedByEmail ?? args.toEmail,
                    bcc: recipients,
                    subject: args.subject,
                    replyTo: [args.replyTo],
                },
                async (emailId) => {
                    const response = await fetch("https://api.resend.com/emails", {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                            "Content-Type": "application/json",
                            "Idempotency-Key": emailId,
                        },
                        body: JSON.stringify({
                            from: "OpenVerein <accounts@openverein.eu>",
                            to: args.requestedByEmail ?? args.toEmail,
                            bcc: recipients,
                            subject: args.subject,
                            replyTo: [args.replyTo],
                            html,
                            text,
                            attachments: attachmentPayload,
                        }),
                    });

                    const payload = (await response.json()) as { id?: string; message?: string; error?: string };

                    if (!response.ok) {
                        throw new Error(`[Email] Versand fehlgeschlagen: ${payload.message ?? payload.error ?? "Unbekannter Fehler"}`);
                    }

                    return payload.id ?? emailId;
                },
            );
        }

        await Promise.all(args.attachments.map((attachment) => r2.deleteObject(ctx, attachment.fileId)));

        return {
            sentMessages: recipientChunks.length,
            recipientCount: args.recipientEmails.length,
            vereinId: args.vereinId,
        };
    },
});
