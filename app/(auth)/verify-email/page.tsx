"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackURL = searchParams.get("callbackURL") || "/verein";
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session?.user.emailVerified) {
      router.replace(callbackURL);
      return;
    }

    const interval = setInterval(() => {
      router.refresh();
    }, 3000);

    return () => clearInterval(interval);
  }, [session?.user.emailVerified, callbackURL, router]);

  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">E-Mail bestätigen</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Bitte prüfe dein Postfach und klicke den Verifizierungslink. Diese
          Seite leitet dich automatisch weiter, sobald deine E-Mail bestätigt
          wurde.
        </p>
      </div>
      <Field>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Spinner className="w-4" />
          Warte auf Verifizierung ...
        </div>
      </Field>
      <Field>
        <FieldDescription className="text-center">
          Kein Link erhalten? Prüfe auch den Spam-Ordner.
        </FieldDescription>
      </Field>
      <Field>
        <Link
          href={`/login?callbackURL=${encodeURIComponent(callbackURL)}`}
          className="w-full"
        >
          <Button variant="outline" type="button" className="w-full">
            Zur Anmeldung
          </Button>
        </Link>
      </Field>
    </FieldGroup>
  );
}
