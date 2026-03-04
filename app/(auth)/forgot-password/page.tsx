"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useState } from "react";
import z from "zod";

const formSchema = z.object({
    email: z.email("Bitte gib eine gültige Email-Adresse ein"),
});

export default function ForgotPasswordPage() {
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const form = useForm({
        validators: {
            onSubmit: formSchema,
        },
        defaultValues: {} as z.infer<typeof formSchema>,
        onSubmit: async ({ value }) => {
            setSubmitting(true);
            setErrorMessage(null);
            const { error } = await authClient.requestPasswordReset({
                email: value.email,
                redirectTo: "/reset-password",
            });
            if (error) {
                setErrorMessage(error.message ?? "Ein Fehler ist aufgetreten. Bitte versuche es erneut.");
            } else {
                setSuccess(true);
            }
            setSubmitting(false);
        },
    });

    if (success) {
        return (
            <FieldGroup>
                <div className="flex flex-col items-center gap-2 text-center">
                    <h1 className="text-2xl font-bold">E-Mail gesendet</h1>
                    <p className="text-muted-foreground text-sm text-balance">
                        Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir dir einen Link zum Zurücksetzen deines Passworts gesendet. Bitte überprüfe dein Postfach.
                    </p>
                </div>
                <Field>
                    <Link href="/login" className="w-full">
                        <Button variant="outline" className="w-full" type="button">
                            Zurück zur Anmeldung
                        </Button>
                    </Link>
                </Field>
            </FieldGroup>
        );
    }

    return (
        <form
            className="flex flex-col gap-6"
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
        >
            <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold">Passwort zurücksetzen</h1>
                    <p className="text-muted-foreground text-sm text-balance">Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.</p>
                </div>
                <form.Field
                    name="email"
                    children={(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                            <Field>
                                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                                <Input
                                    required
                                    type="email"
                                    placeholder="max.mustermann@openverein.eu"
                                    id={field.name}
                                    name={field.name}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    aria-invalid={isInvalid}
                                />
                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                            </Field>
                        );
                    }}
                />
                {errorMessage && <FieldError errors={[{ message: errorMessage }]} />}
                <Field>
                    <Button type="submit" disabled={submitting}>
                        <Spinner className={submitting ? "transition-all w-8" : "transition-all w-0"} />
                        Link anfordern
                    </Button>
                </Field>
                <Field>
                    <Link href="/login" className="w-full">
                        <Button variant="outline" className="w-full" type="button">
                            Zurück zur Anmeldung
                        </Button>
                    </Link>
                </Field>
            </FieldGroup>
        </form>
    );
}
