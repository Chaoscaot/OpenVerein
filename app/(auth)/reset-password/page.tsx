"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import z from "zod";

const formSchema = z
  .object({
    password: z
      .string()
      .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein"),
    confirmPassword: z.string().min(1, "Bitte bestätige dein Passwort"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Die Passwörter stimmen nicht überein",
  });

function ResetPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const form = useForm({
    validators: {
      onSubmit: formSchema,
    },
    defaultValues: {} as z.infer<typeof formSchema>,
    onSubmit: async ({ value }) => {
      if (!token) {
        setErrorMessage(
          "Ungültiger oder abgelaufener Link. Bitte fordere einen neuen Link an.",
        );
        return;
      }
      setSubmitting(true);
      setErrorMessage(null);
      const { error } = await authClient.resetPassword({
        newPassword: value.password,
        token,
      });
      if (error) {
        setErrorMessage(
          error.message ??
            "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
        );
      } else {
        setSuccess(true);
      }
      setSubmitting(false);
    },
  });

  if (!token) {
    return (
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Ungültiger Link</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen
            Link zum Zurücksetzen deines Passworts an.
          </p>
        </div>
        <Field>
          <Link href="/forgot-password" className="w-full">
            <Button className="w-full" type="button">
              Neuen Link anfordern
            </Button>
          </Link>
        </Field>
      </FieldGroup>
    );
  }

  if (success) {
    return (
      <FieldGroup>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold">Passwort geändert</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt
            anmelden.
          </p>
        </div>
        <Field>
          <Button
            className="w-full"
            type="button"
            onClick={() => router.replace("/login")}
          >
            Zur Anmeldung
          </Button>
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
          <h1 className="text-2xl font-bold">Neues Passwort festlegen</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Gib dein neues Passwort ein. Es muss mindestens 8 Zeichen lang sein.
          </p>
        </div>
        <form.Field
          name="password"
          children={(field) => {
            const isInvalid =
              field.state.meta.isTouched && !field.state.meta.isValid;
            return (
              <Field>
                <FieldLabel htmlFor={field.name}>Neues Passwort</FieldLabel>
                <Input
                  required
                  type="password"
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
                  required
                  type="password"
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
            <Spinner
              className={
                submitting ? "transition-all w-8" : "transition-all w-0"
              }
            />
            Passwort speichern
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
