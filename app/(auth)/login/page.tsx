"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import z from "zod";

const formSchema = z.object({
    email: z.email("Bitte gib eine gültige Email-Adresse ein"),
    password: z.string("Bitte gib dein Passwort ein").min(8, "Bitte gib dein Passwort ein"),
});

export default function LoginPage() {
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const router = useRouter();
    const form = useForm({
        validators: {
            onSubmit: formSchema,
        },
        defaultValues: {} as z.infer<typeof formSchema>,
        onSubmit: async ({ value, formApi }) => {
            setSubmitting(true);
            setErrorMessage(null);
            const { error } = await authClient.signIn.email({
                email: value.email,
                password: value.password,
                callbackURL: "/verein",
                rememberMe: true,
                fetchOptions: { onSuccess: () => router.replace("/verein") },
            });
            if (error) {
                if (error.code === "INVALID_EMAIL_OR_PASSWORD") {
                    setErrorMessage("Die eingegebene Email-Adresse oder das Passwort ist ungültig.");
                    formApi.fieldInfo.email.instance?.setErrorMap({ onSubmit: error.message });
                    formApi.fieldInfo.password.instance?.setErrorMap({ onSubmit: error.message });
                }
            }
            setSubmitting(false);
        },
    });

    return (
        <form
            className={"flex flex-col gap-6"}
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit();
            }}
        >
            <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-2xl font-bold">Anmelden</h1>
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
                <form.Field
                    name="password"
                    children={(field) => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                        return (
                            <Field>
                                <div className="flex items-center">
                                    <FieldLabel htmlFor="password">Passwort</FieldLabel>
                                    <a href="#" className="ml-auto text-sm underline-offset-4 hover:underline">
                                        Passwort vergessen?
                                    </a>
                                </div>
                                <Input
                                    type="password"
                                    required
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
                    <Button type="submit">
                        <Spinner className={submitting ? "transition-all w-8" : "transition-all w-0"} />
                        Anmelden
                    </Button>
                </Field>
                <FieldSeparator>Oder</FieldSeparator>
                <Field>
                    <Button variant="outline" type="button">
                        <HugeiconsIcon icon={GoogleIcon} />
                        Mit Google Anmelden
                    </Button>
                    <FieldDescription className="text-center">
                        Noch kein Konto erstellt?{" "}
                        <Link href="/signup" className="underline-offset-4 hover:underline">
                            Jetzt Registrieren!
                        </Link>
                    </FieldDescription>
                </Field>
            </FieldGroup>
        </form>
    );
}
