import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";

export default function VerifyEmailConfirmedPage() {
  return (
    <FieldGroup>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">E-Mail bestätigt</h1>
        <p className="text-muted-foreground text-sm text-balance">
          Deine E-Mail-Adresse wurde erfolgreich bestätigt.
        </p>
      </div>
      <FieldDescription className="text-center">
        Du kannst dieses Fenster jetzt schließen und zur vorherigen Seite
        zurückkehren.
      </FieldDescription>
    </FieldGroup>
  );
}
