"use node";
import { components, internal } from "./_generated/api";
import { Resend as ConvexResend } from "@convex-dev/resend";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { render } from "@react-email/render";
import { Resend as ResendSdk } from "resend";
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

function getResendSdkClient() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        throw new Error("RESEND_API_KEY ist nicht gesetzt");
    }

    return new ResendSdk(apiKey);
}

export const resend: ConvexResend = new ConvexResend(components.resend, { testMode: false });

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
        mailHistoryId: v.id("mail_versand"),
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
        let sentMessages = 0;
        const providerMessageIds: string[] = [];

        try {
            const resendSdk = getResendSdkClient();

            const html = await render(<ListenMailEmail vereinName={args.vereinName} subject={args.subject} body={args.body} listNames={args.listNames} />);
            const text = `${args.subject}\n\n${args.body}`;

            const attachmentPayload = await Promise.all(
                args.attachments.map(async (attachment) => {
                    return {
                        filename: attachment.name,
                        path: await r2.getUrl(attachment.fileId, { expiresIn: 60 * 60 }),
                        contentType: attachment.mimeType,
                    };
                }),
            );

            const recipientChunks = chunk(Array.from(new Set(args.recipientEmails.map((email) => email.trim()).filter(Boolean))), MAX_RECIPIENTS_PER_MESSAGE);

            for (const recipients of recipientChunks) {
                let providerMessageId: string | undefined;

                await resend.sendEmailManually(
                    ctx,
                    {
                        from: `${args.vereinName} <verein@openverein.eu>`,
                        to: args.requestedByEmail ?? args.toEmail,
                        bcc: recipients,
                        subject: args.subject,
                        replyTo: [args.replyTo],
                    },
                    async (emailId) => {
                        const { data, error } = await resendSdk.emails.send(
                            {
                                from: `${args.vereinName} <verein@openverein.eu>`,
                                to: args.requestedByEmail ?? args.toEmail,
                                bcc: recipients,
                                subject: args.subject,
                                replyTo: args.replyTo,
                                html,
                                text,
                                attachments: attachmentPayload,
                            },
                            { idempotencyKey: emailId },
                        );

                        if (error) {
                            throw new Error(`[Email] Versand fehlgeschlagen: ${error.message}`);
                        }

                        providerMessageId = data?.id ?? emailId;
                        return providerMessageId;
                    },
                );

                sentMessages += 1;
                if (providerMessageId) {
                    providerMessageIds.push(providerMessageId);
                }
            }

            await ctx.runMutation(internal.listen.markMailHistorySent, {
                mailHistoryId: args.mailHistoryId,
                sentMessages,
                providerMessageIds,
            });

            return {
                sentMessages,
                recipientCount: args.recipientEmails.length,
                vereinId: args.vereinId,
            };
        } catch (error) {
            await ctx.runMutation(internal.listen.markMailHistoryFailed, {
                mailHistoryId: args.mailHistoryId,
                errorMessage: error instanceof Error ? error.message : "Unbekannter Fehler",
                sentMessages,
                providerMessageIds: providerMessageIds.length > 0 ? providerMessageIds : undefined,
            });
            throw error;
        } finally {
            ctx.scheduler.runAfter(30 * 60, internal.sendMails.deleteFiles, {
                fileIds: args.attachments.map((attachment) => attachment.fileId),
            });
        }
    },
});

export const deleteFiles = internalAction({
    args: {
        fileIds: v.array(v.string()),
    },
    handler: async (ctx, { fileIds }) => {
        await Promise.all(fileIds.map((fileId) => r2.deleteObject(ctx, fileId)));
    },
});
