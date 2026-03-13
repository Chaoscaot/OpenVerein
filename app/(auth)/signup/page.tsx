"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { GoogleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import * as z from "zod";
import { useForm } from "@tanstack/react-form";
import { Spinner } from "@/components/ui/spinner";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

const formSchema = z
  .object({
    name: z
      .string("Bitte gib deinen Namen ein")
      .min(1, "Bitte gib deinen Namen ein"),
    email: z
      .email("Bitte gib deine Email ein")
      .min(1, "Bitte gib deine Email ein"),
    password: z
      .string("Bitte gib dein Passwort ein")
      .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein"),
    confirmPassword: z
      .string("Bitte bestätige dein Passwort")
      .min(1, "Bitte bestätige dein Passwort"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Die Passwörter stimmen nicht überein",
  });

export default function SignupPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/verein";
  const verifyWaitURL = `/verify-email?callbackURL=${encodeURIComponent(callbackURL)}`;
  const verifyConfirmURL = "/verify-email/confirmed";
  const form = useForm({
    validators: {
      onSubmit: formSchema,
    },
    defaultValues: {} as z.infer<typeof formSchema>,
    onSubmit: async ({ value }) => {
      setErrorMessage(null);
      setSubmitting(true);
      const { error } = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
        callbackURL: verifyConfirmURL,
        fetchOptions: { onSuccess: () => router.replace(verifyWaitURL) },
      });
      if (error) {
        setErrorMessage(error.message ?? null);
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
          <h1 className="text-2xl font-bold">Erstelle dein Konto</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Fülle das Formular aus, um dir ein Konto zu erstellen!
          </p>
        </div>
        <form.Field
          name="name"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field data-invalid={isInvalid}>
                <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                <Input
                  type="text"
                  placeholder="Max Mustermann"
                  required
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  autoComplete="off"
                />
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />
        <form.Field
          name="email"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  type="email"
                  placeholder="max.mustermann@openverein.eu"
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
        <form.Field
          name="password"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field>
                <FieldLabel htmlFor={field.name}>Passwort</FieldLabel>
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
                <FieldDescription>Mindestens 8 Zeichen</FieldDescription>
                {isInvalid && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        />
        <form.Field
          name="confirmPassword"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field>
                <FieldLabel htmlFor={field.name}>
                  Passwort bestätigen
                </FieldLabel>
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
            <Spinner
              className={
                submitting ? "transition-all w-8" : "transition-all w-0"
              }
            />
            Konto Erstellen
          </Button>
        </Field>
        <FieldSeparator>Oder</FieldSeparator>
        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={() =>
              authClient.signIn.social({ provider: "google", callbackURL })
            }
          >
            <HugeiconsIcon icon={GoogleIcon} />
            Mit Google Anmelden
          </Button>
          <FieldDescription className="px-6 text-center">
            Konto bereits erstellt?{" "}
            <Link
              href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`}
            >
              Jetzt Anmelden!
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
