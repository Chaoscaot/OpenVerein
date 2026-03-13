"use client";

import { SimpleCard } from "@/components/SimpleCard";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { getCountries } from "@/lib/utils-client";
import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import z from "zod";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useUploadFile } from "@convex-dev/r2/react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { Upload, Trash } from "@hugeicons/core-free-icons";

const formSchema = z.object({
  name: z.string().min(1, "Vereinsname ist erforderlich"),
  logo: z.string().optional(),
  street: z.string().min(5, "Bitte gib eine Straße ein"),
  city: z.string().min(1, "Bitte gib eine Stadt ein"),
  postalCode: z
    .string()
    .min(5, "Die Postleitzahl muss mindestens 5 Zeichen lang sein"),
  country: z.string().min(2, "Bitte wähle ein Land aus"),
  email: z.string().email("Bitte gib eine gültige E-Mail-Adresse ein"),
  phone: z.string().optional(),
  sepaIban: z.string().optional(),
  sepaBic: z.string().optional(),
  sepaCreditorId: z.string().optional(),
});

export function VereinSettings({ verein }: { verein: Doc<"verein"> }) {
  const updateVerein = useMutation(api.verein.update);
  const deleteFile = useMutation(api.files.deleteFile);
  const router = useRouter();
  const countries = useMemo(() => getCountries(), []);
  const [uploading, setUploading] = useState(false);
  const [logoToDelete, setLogoToDelete] = useState<string | null>(null);

  const uploadFile = useUploadFile(api.files);

  const logoUrl = useQuery(
    api.files.getUrl,
    verein.logo ? { fileId: verein.logo } : "skip",
  );

  const form = useForm({
    validators: {
      onSubmit: formSchema,
    },
    defaultValues: {
      name: verein.name,
      logo: verein.logo,
      street: verein.address.street,
      city: verein.address.city,
      postalCode: verein.address.postalCode,
      country: verein.address.country,
      email: verein.contact.email,
      phone: verein.contact.phone ?? "",
      sepaIban: verein.sepa?.iban ?? "",
      sepaBic: verein.sepa?.bic ?? "",
      sepaCreditorId: verein.sepa?.creditorId ?? "",
    } as z.infer<typeof formSchema>,
    onSubmit: async (values) => {
      try {
        // Delete old logo if it was replaced
        if (logoToDelete && logoToDelete !== values.value.logo) {
          await deleteFile({ fileId: logoToDelete });
        }

        await updateVerein({
          id: verein._id,
          name: values.value.name,
          logo: values.value.logo || undefined,
          street: values.value.street,
          city: values.value.city,
          postalCode: values.value.postalCode,
          country: values.value.country,
          email: values.value.email,
          phone: values.value.phone || undefined,
          sepaIban: values.value.sepaIban || undefined,
          sepaBic: values.value.sepaBic || undefined,
          sepaCreditorId: values.value.sepaCreditorId || undefined,
        });

        toast.success("Vereinseinstellungen erfolgreich aktualisiert");
        router.refresh();
      } catch (error) {
        toast.error("Fehler beim Aktualisieren der Einstellungen");
        console.error(error);
      }
    },
  });

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wähle eine Bilddatei aus");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Die Datei ist zu groß. Maximale Größe: 5MB");
      return;
    }

    setUploading(true);
    toast.promise(
      async () => {
        const result = await uploadFile(file);

        // Mark old logo for deletion
        const oldLogo = form.getFieldValue("logo");
        if (oldLogo) {
          setLogoToDelete(oldLogo);
        }

        form.setFieldValue("logo", result);
        setUploading(false);
      },
      {
        loading: "Logo wird hochgeladen...",
        success: "Logo erfolgreich hochgeladen",
        error: "Fehler beim Hochladen des Logos",
      },
    );
  }

  async function handleLogoRemove() {
    const currentLogo = form.getFieldValue("logo");
    if (currentLogo) {
      setLogoToDelete(currentLogo);
      form.setFieldValue("logo", undefined);
      toast.success("Logo wird beim Speichern entfernt");
    }
  }

  return (
    <form
      className="grid grid-cols-1 gap-4 xl:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit(e);
      }}
    >
      <SimpleCard
        title="Basisdaten"
        description="Grundlegende Informationen über den Verein"
      >
        <FieldGroup>
          <form.Field
            name="name"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Vereinsname</FieldLabel>
                  <Input
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
            name="logo"
            children={(field) => {
              return (
                <Field>
                  <FieldLabel>Vereinslogo</FieldLabel>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-24 w-24">
                      {field.state.value && logoUrl ? (
                        <AvatarImage src={logoUrl} alt={verein.name} />
                      ) : (
                        <AvatarFallback className="text-2xl">
                          {verein.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading}
                        onClick={() =>
                          document.getElementById("logo-upload")?.click()
                        }
                      >
                        <HugeiconsIcon icon={Upload} />
                        {uploading ? "Lädt hoch..." : "Logo hochladen"}
                      </Button>
                      {field.state.value && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleLogoRemove}
                        >
                          <HugeiconsIcon icon={Trash} />
                          Entfernen
                        </Button>
                      )}
                      <input
                        id="logo-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                    </div>
                  </div>
                </Field>
              );
            }}
          />
        </FieldGroup>
      </SimpleCard>

      <SimpleCard title="Adresse" description="Adressdaten des Vereins">
        <FieldGroup>
          <form.Field
            name="street"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Straße und Hausnummer
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    autoComplete="street-address"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <form.Field
              name="postalCode"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Postleitzahl</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      autoComplete="postal-code"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />

            <form.Field
              name="city"
              children={(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid;
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Stadt</FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-invalid={isInvalid}
                      autoComplete="address-level2"
                    />
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                );
              }}
            />
          </div>

          <form.Field
            name="country"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Land</FieldLabel>
                  <Select
                    value={field.state.value}
                    onValueChange={(v) => field.handleChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {countries.map((country) => (
                          <SelectItem key={country} value={country}>
                            {country}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        </FieldGroup>
      </SimpleCard>

      <SimpleCard
        title="Kontaktdaten"
        description="Kontaktinformationen des Vereins"
      >
        <FieldGroup>
          <form.Field
            name="email"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>E-Mail</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    autoComplete="email"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="phone"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>
                    Telefon (optional)
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="tel"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    autoComplete="tel"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        </FieldGroup>
      </SimpleCard>

      <SimpleCard
        title="SEPA-Daten"
        description="SEPA-Lastschrift Informationen (optional)"
      >
        <FieldGroup>
          <form.Field
            name="sepaIban"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>IBAN</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(e.target.value.toUpperCase())
                    }
                    aria-invalid={isInvalid}
                    autoComplete="off"
                    placeholder="DE89 3704 0044 0532 0130 00"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="sepaBic"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>BIC</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) =>
                      field.handleChange(e.target.value.toUpperCase())
                    }
                    aria-invalid={isInvalid}
                    autoComplete="off"
                    placeholder="COBADEFFXXX"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />

          <form.Field
            name="sepaCreditorId"
            children={(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid;
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Gläubiger-ID</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                    autoComplete="off"
                    placeholder="DE98ZZZ09999999999"
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              );
            }}
          />
        </FieldGroup>
      </SimpleCard>

      <div className="col-span-full flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Abbrechen
        </Button>
        <Button type="submit">Speichern</Button>
      </div>
    </form>
  );
}
