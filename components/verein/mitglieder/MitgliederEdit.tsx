"use client";

import { SimpleCard } from "@/components/SimpleCard";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { getCountries } from "@/lib/utils-client";
import { useForm } from "@tanstack/react-form";
import { useMemo, useState } from "react";
import z from "zod";
import { MitgliedSelector } from "./MitgliedSelector";
import { BeitragssatzSelector } from "../BeitragssatzSelector";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { HugeiconsIcon } from "@hugeicons/react";
import { Document, Trash, View } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useConvex, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useUploadFile } from "@convex-dev/r2/react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const formSchema = z
    .object({
        nummer: z.string().min(1, "Mitgliedsnummer ist erforderlich"),
        firma: z.boolean(),
        vorname: z.string().min(1, "Vorname ist erforderlich"),
        nachname: z.string().min(1, "Nachname ist erforderlich"),
        titel: z.string().optional(),
        geschlecht: z.enum(["m", "w", "d", "n"]),
        familienstand: z.string().optional(),
        typ: z.enum(["bewerber", "mitglied", "fördermitglied", "kontakt", "ausgeschieden"]),
        geburtsdatum: z.date().optional(),
        beruf: z.string().optional(),
        city: z.string("Bitte gib eine Stadt ein"),
        postalCode: z.string("Bitte gib eine Postleitzahl ein").min(5, "Die Postleitzahl muss mindestens 5 Zeichen lang sein"),
        street: z.string().min(5, "Bitte gib eine Straße ein"),
        country: z.string().min(2, "Bitte wähle ein Land aus"),
        email: z.email("Bitte gib eine gültige E-Mail-Adresse ein"),
        phone: z.string().optional(),
        phoneNote: z.string().optional(),
        phone2: z.string().optional(),
        phone2Note: z.string().optional(),
        listenEmails: z.boolean(),
        beitrittsdatum: z.date(),
        austrittsdatum: z.date().optional(),
        parent: z.string().optional(),
        ehrenmitglied: z.boolean(),
        beitragsEinzug: z.enum(["r", "l", "b", "p"]).optional(),
        sepaIban: z.string().optional(),
        sepaBic: z.string().optional(),
        sepaMandatErstelltAm: z.date().optional(),
        beitragsSatzId: z.string().optional(),
        datein: z.array(
            z.object({
                id: z.string(),
                name: z.string(),
                saved: z.boolean().optional(),
            }),
        ),
        rollen: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
        if (data.austrittsdatum) {
            if (data.austrittsdatum < data.beitrittsdatum) {
                ctx.addIssue({
                    code: "custom",
                    message: "Das Austrittsdatum darf nicht vor dem Beitrittsdatum liegen",
                    path: ["austrittsdatum"],
                });
            }
            if (data.typ === "mitglied" || data.typ === "fördermitglied") {
                ctx.addIssue({
                    code: "custom",
                    message: "Nur Bewerber, Kontakte und ausgeschiedene Mitglieder können ein Austrittsdatum haben",
                });
            }
        }
    });

export function MitgliederEdit({ verein, mitglied }: { verein: Doc<"verein">; mitglied?: Doc<"mitglied"> }) {
    const createUser = useMutation(api.mitglieder.create);
    const updateUser = useMutation(api.mitglieder.update);
    const router = useRouter();
    const acl = useQuery(api.permissions.getMyPermissions, {
        vereinId: verein._id,
    });

    const canLinkAccount = acl?.permissions.includes("mitglied.linkAccount") ?? false;
    const canAssignRoles = acl?.permissions.includes("rolle.assign") ?? false;

    const vereinsRollen = useQuery(api.rollen.list, canAssignRoles ? { vereinId: verein._id } : "skip");

    const form = useForm({
        validators: {
            onSubmit: formSchema,
        },
        defaultValues: {
            nummer: mitglied?.nummer ?? String(verein.mitgliederCounter),
            geschlecht: mitglied?.geschlecht ?? "n",
            firma: mitglied?.firma ?? false,
            typ: mitglied?.typ ?? "mitglied",
            ehrenmitglied: mitglied?.ehrenmitglied ?? false,
            geburtsdatum: mitglied?.geburtsdatum ? new Date(mitglied.geburtsdatum) : undefined,
            beitrittsdatum: mitglied?.beitrittsdatum ? new Date(mitglied.beitrittsdatum) : new Date(new Date().toDateString()),
            beruf: mitglied?.beruf,
            country: mitglied?.anschrift?.country ?? verein.address.country,
            city: mitglied?.anschrift?.city,
            postalCode: mitglied?.anschrift?.postalCode,
            street: mitglied?.anschrift?.street,
            email: mitglied?.kontakt?.email,
            familienstand: mitglied?.familienstand,
            nachname: mitglied?.nachname,
            vorname: mitglied?.vorname,
            titel: mitglied?.titel,
            phone: mitglied?.kontakt?.phone,
            phoneNote: mitglied?.kontakt?.phoneNote,
            phone2: mitglied?.kontakt?.phone2,
            phone2Note: mitglied?.kontakt?.phone2Note,
            listenEmails: mitglied?.kommunikation?.listenEmails ?? true,
            sepaIban: mitglied?.sepaMandat?.iban,
            sepaBic: mitglied?.sepaMandat?.bic,
            sepaMandatErstelltAm: mitglied?.sepaMandat?.erstelltAm ? new Date(mitglied.sepaMandat.erstelltAm) : undefined,
            beitragsEinzug: mitglied?.beitragsEinzug ?? "l",
            austrittsdatum: mitglied?.austrittsdatum ? new Date(mitglied.austrittsdatum) : undefined,
            parent: mitglied?.parent,
            beitragsSatzId: mitglied?.beitragsSatzId,
            datein:
                mitglied?.datein?.map((v) => ({
                    id: v.id,
                    name: v.name,
                    saved: true,
                })) ?? [],
            rollen: mitglied?.rollen?.map((value) => value as string) ?? [],
        } as z.infer<typeof formSchema>,
        onSubmit: async (values) => {
            const isContributionEnabled = values.value.typ === "mitglied" || values.value.typ === "fördermitglied";
            const isEhrenmitglied = isContributionEnabled && values.value.beitragsEinzug === undefined;
            const beitragsEinzug = isContributionEnabled ? values.value.beitragsEinzug : undefined;
            const beitragsSatzId = isContributionEnabled && !isEhrenmitglied ? (values.value.beitragsSatzId as Id<"beitrags_satz"> | undefined) : undefined;
            const sepaMandat =
                isContributionEnabled && beitragsEinzug === "l" && values.value.sepaIban && values.value.sepaBic && values.value.sepaMandatErstelltAm
                    ? {
                          iban: values.value.sepaIban,
                          bic: values.value.sepaBic,
                          erstelltAm: values.value.sepaMandatErstelltAm.toISOString().split("T")[0],
                      }
                    : undefined;

            if (mitglied) {
                await updateUser({
                    id: mitglied._id,
                    nummer: values.value.nummer,
                    vorname: values.value.vorname,
                    nachname: values.value.nachname,
                    titel: values.value.titel,
                    firma: values.value.firma,
                    geschlecht: values.value.geschlecht,
                    typ: values.value.typ,
                    ehrenmitglied: isEhrenmitglied,
                    beruf: values.value.beruf,
                    street: values.value.street,
                    city: values.value.city,
                    postalCode: values.value.postalCode,
                    country: values.value.country,
                    email: values.value.email,
                    phone: values.value.phone,
                    phoneNote: values.value.phoneNote,
                    phone2: values.value.phone2,
                    phone2Note: values.value.phone2Note,
                    listenEmails: values.value.listenEmails,
                    beitragsEinzug,
                    geburtsdatum: values.value.geburtsdatum ? values.value.geburtsdatum.toISOString().split("T")[0] : undefined,
                    austrittsdatum: values.value.austrittsdatum ? values.value.austrittsdatum.toISOString().split("T")[0] : undefined,
                    beitrittsdatum: values.value.beitrittsdatum.toISOString().split("T")[0],
                    familienstand: values.value.familienstand && values.value.familienstand.length > 0 ? values.value.familienstand : undefined,
                    parent: values.value.parent as Id<"mitglied"> | undefined,
                    beitragsSatzId,
                    datein: values.value.datein.map((d) => ({ name: d.name, id: d.id })),
                    rollen: canAssignRoles ? (values.value.rollen?.map((id) => id as Id<"vereins_rollen">) ?? []) : undefined,
                    sepaMandat,
                });
                toast.success("Mitglied erfolgreich aktualisiert");
            } else {
                await createUser({
                    vereinId: verein._id as Id<"verein">,
                    nummer: values.value.nummer,
                    vorname: values.value.vorname,
                    nachname: values.value.nachname,
                    titel: values.value.titel,
                    firma: values.value.firma,
                    geschlecht: values.value.geschlecht,
                    typ: values.value.typ,
                    ehrenmitglied: isEhrenmitglied,
                    beruf: values.value.beruf,
                    street: values.value.street,
                    city: values.value.city,
                    postalCode: values.value.postalCode,
                    country: values.value.country,
                    email: values.value.email,
                    phone: values.value.phone,
                    phoneNote: values.value.phoneNote,
                    phone2: values.value.phone2,
                    phone2Note: values.value.phone2Note,
                    listenEmails: values.value.listenEmails,
                    beitragsEinzug,
                    geburtsdatum: values.value.geburtsdatum ? values.value.geburtsdatum.toISOString().split("T")[0] : undefined,
                    austrittsdatum: values.value.austrittsdatum ? values.value.austrittsdatum.toISOString().split("T")[0] : undefined,
                    beitrittsdatum: values.value.beitrittsdatum.toISOString().split("T")[0],
                    familienstand: values.value.familienstand && values.value.familienstand.length > 0 ? values.value.familienstand : undefined,
                    parent: values.value.parent as Id<"mitglied"> | undefined,
                    beitragsSatzId,
                    datein: values.value.datein.map((d) => ({ name: d.name, id: d.id })),
                    rollen: canAssignRoles ? (values.value.rollen?.map((id) => id as Id<"vereins_rollen">) ?? []) : undefined,
                    sepaMandat,
                });
                toast.success("Mitglied erfolgreich erstellt");
            }

            router.replace("/verein/" + verein._id + "/mitglieder");
        },
        listeners: {
            onChange: console.log,
        },
    });

    const [isFirma, setIsFirma] = useState(mitglied?.firma ?? false);
    const [memberType, setMemberType] = useState<z.infer<typeof formSchema>["typ"]>(mitglied?.typ ?? "mitglied");
    const [beitragsEinzugValue, setBeitragsEinzugValue] = useState<z.infer<typeof formSchema>["beitragsEinzug"]>(mitglied?.beitragsEinzug ?? "l");
    const isContributionEnabled = memberType === "mitglied" || memberType === "fördermitglied";
    const isSepaEnabled = isContributionEnabled && beitragsEinzugValue === "l";
    const isEhrenmitglied = isContributionEnabled && beitragsEinzugValue === undefined;
    const countries = useMemo(() => getCountries(), []);
    const [uploading, setUploading] = useState(false);
    const deleteFile = useMutation(api.files.deleteFile);
    const requestAccountLinkInvite = useMutation(api.mitglieder.requestAccountLinkInvite);
    const removeAccountLink = useMutation(api.mitglieder.removeAccountLink);
    const [deletedFiles, setDeletedFiles] = useState<string[]>([]);
    const [accountLinked, setAccountLinked] = useState(!!mitglied?.userId);
    const [inviteEmail, setInviteEmail] = useState(mitglied?.kontakt?.email ?? "");
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

    const convex = useConvex();

    const uploadFile = useUploadFile(api.files);

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files![0];
        if (!file) return;
        e.target.value = "";

        if (
            form
                .getFieldValue("datein")
                .map((d) => d.name)
                .includes(file.name)
        ) {
            toast.error("Eine Datei mit diesem Namen wurde bereits hinzugefügt");
            return;
        }

        setUploading(true);
        toast.promise(
            async () => {
                const result = await uploadFile(file);

                form.setFieldValue("datein", [
                    ...form.getFieldValue("datein"),
                    {
                        id: result,
                        name: file.name,
                        saved: false,
                    },
                ]);
                setUploading(false);
            },
            {
                loading: "Datei wird hochgeladen...",
                success: () => "Datei erfolgreich hochgeladen",
                error: "Fehler beim Hochladen der Datei",
            },
        );
    }

    return (
        <form
            className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3"
            onSubmit={(e) => {
                e.preventDefault();
                form.handleSubmit(e);
            }}
        >
            <SimpleCard title="Daten" description="Basisdaten des Mitglieds">
                <FieldGroup>
                    <div className="grid grid-cols-2 gap-2">
                        <form.Field
                            name="nummer"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Mitglidsnummer</FieldLabel>
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
                            name="typ"
                            listeners={{
                                onChange: (v) => setMemberType(v.value),
                            }}
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Typ</FieldLabel>
                                        <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as "bewerber" | "mitglied" | "fördermitglied" | "kontakt" | "ausgeschieden")}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="bewerber">Bewerber</SelectItem>
                                                    <SelectItem value="mitglied">Mitglied</SelectItem>
                                                    <SelectItem value="fördermitglied">Fördermitglied</SelectItem>
                                                    <SelectItem value="kontakt">Kontakt</SelectItem>
                                                    <SelectItem value="ausgeschieden">Ausgeschieden</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                    </Field>
                                );
                            }}
                        />
                    </div>
                    <form.Field
                        name="firma"
                        listeners={{
                            onChange: (v) => {
                                if (v.value) {
                                    form.setFieldValue("titel", "");
                                    form.setFieldValue("vorname", "");
                                    form.setFieldValue("nachname", "");
                                }
                            },
                        }}
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid} orientation="horizontal">
                                    <FieldLabel htmlFor={field.name}>Firma</FieldLabel>
                                    <Switch id={field.name} checked={field.state.value} onCheckedChange={(v) => field.handleChange(v)} aria-invalid={isInvalid} />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                    {isFirma ? (
                        <form.Field
                            name="vorname"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                                        <Input
                                            id={field.name}
                                            placeholder="Musterfirma GmbH"
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
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <form.Field
                                    name="titel"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid} className="w-24">
                                                <FieldLabel htmlFor={field.name}>Titel</FieldLabel>
                                                <Select value={!field.state.value ? "none" : field.state.value} onValueChange={(v) => field.handleChange(v === "none" ? "" : v)}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value="none">Keiner</SelectItem>
                                                            <SelectItem value="Dr.">Dr.</SelectItem>
                                                            <SelectItem value="Prof.">Prof.</SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        );
                                    }}
                                />
                                <form.Field
                                    name="vorname"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Vorname</FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    placeholder="Max"
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
                                    name="nachname"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Nachname</FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    placeholder="Mustermann"
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
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <form.Field
                                    name="geschlecht"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Geschlecht</FieldLabel>
                                                <Select value={field.state.value} onValueChange={(v) => field.handleChange(v as "m" | "w" | "d" | "n")}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value="m">Männlich</SelectItem>
                                                            <SelectItem value="w">Weiblich</SelectItem>
                                                            <SelectItem value="d">Divers</SelectItem>
                                                            <SelectItem value="n">Keine Angabe</SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        );
                                    }}
                                />
                                <form.Field
                                    name="familienstand"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Familienstand</FieldLabel>
                                                <Select value={field.state.value ?? "none"} onValueChange={(v) => field.handleChange(v === "none" ? undefined : v)}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectGroup>
                                                            <SelectItem value="none">Unbekannt</SelectItem>
                                                            <SelectItem value="ledig">Ledig</SelectItem>
                                                            <SelectItem value="verheiratet">Verheiratet</SelectItem>
                                                            <SelectItem value="geschieden">Geschieden</SelectItem>
                                                            <SelectItem value="verwitwet">Verwitwet</SelectItem>
                                                        </SelectGroup>
                                                    </SelectContent>
                                                </Select>
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        );
                                    }}
                                />
                                <form.Field
                                    name="beruf"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Beruf</FieldLabel>
                                                <Input
                                                    id={field.name}
                                                    placeholder="Schüler"
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
                                    name="geburtsdatum"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Geburtsdatum</FieldLabel>
                                                <DatePicker value={field.state.value} onChange={(date) => field.handleChange(date)} />
                                                {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                            </Field>
                                        );
                                    }}
                                />
                            </div>
                        </>
                    )}
                </FieldGroup>
            </SimpleCard>
            <SimpleCard title="Anschrift" description="Anschrift des Mitglieds">
                <FieldGroup>
                    <form.Field
                        name="street"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Straße</FieldLabel>
                                    <Input
                                        type="text"
                                        placeholder="Musterstraße 1"
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
                    <div className="grid grid-cols-3 gap-2">
                        <form.Field
                            name="postalCode"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Postleitzahl</FieldLabel>
                                        <Input
                                            placeholder="10176"
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
                            name="city"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className="col-span-2">
                                        <FieldLabel htmlFor={field.name}>Ort</FieldLabel>
                                        <Input
                                            type="text"
                                            placeholder="Berlin"
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
                    </div>
                    <form.Field
                        name="country"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Land</FieldLabel>
                                    <Select value={field.state.value} onValueChange={field.handleChange}>
                                        <SelectTrigger id={field.name}>
                                            <SelectValue placeholder="Land auswählen" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Land</SelectLabel>
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
            <SimpleCard title="Kontakt" description="Kontaktinformationen des Mitglieds">
                <FieldGroup>
                    <form.Field
                        name="email"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>E-Mail</FieldLabel>
                                    <Input
                                        type="email"
                                        placeholder="max.mustermann@openverein.eu"
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
                        name="listenEmails"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid} orientation="responsive">
                                    <div className="space-y-1">
                                        <FieldLabel htmlFor={field.name}>Vereins-Rundmails erhalten</FieldLabel>
                                        <p className="text-sm text-muted-foreground">Wenn deaktiviert, wird die Person bei Listenmails automatisch übersprungen.</p>
                                    </div>
                                    <Switch id={field.name} checked={field.state.value} onCheckedChange={(value) => field.handleChange(value)} aria-invalid={isInvalid} />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                        <form.Field
                            name="phone"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Telefon 1</FieldLabel>
                                        <Input
                                            type="text"
                                            placeholder="+49 30 12345678"
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
                            name="phoneNote"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Telefon 1 Notiz</FieldLabel>
                                        <Input
                                            type="text"
                                            placeholder="Mobil"
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
                            name="phone2"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Telefon 2</FieldLabel>
                                        <Input
                                            type="text"
                                            placeholder="+49 30 12345678"
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
                            name="phone2Note"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Telefon 2 Notiz</FieldLabel>
                                        <Input
                                            type="text"
                                            placeholder="Festnetz"
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
                    </div>
                </FieldGroup>
            </SimpleCard>
            <SimpleCard title="Vereinsmitglied" description="Mitgliedschaft im Verein">
                <FieldGroup>
                    <form.Field
                        name="beitrittsdatum"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Eintrittsdatum</FieldLabel>
                                    <DatePicker value={field.state.value} onChange={(v) => (v !== undefined ? field.handleChange(v) : null)} />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                    <form.Field
                        name="austrittsdatum"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Austrittsdatum</FieldLabel>
                                    <DatePicker value={field.state.value} onChange={field.handleChange} />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                    <form.Field
                        name="parent"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    <FieldLabel htmlFor={field.name}>Übergeordnetes Mitglied</FieldLabel>
                                    <MitgliedSelector vereinId={verein._id} value={field.state.value as Id<"mitglied">} onChange={field.handleChange} />
                                    {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                </Field>
                            );
                        }}
                    />
                </FieldGroup>
            </SimpleCard>
            <SimpleCard title="Mitgliedsbeitrag" description="Abrechnungsinformationen des Mitglieds">
                <fieldset disabled={!isContributionEnabled} className={!isContributionEnabled ? "pointer-events-none opacity-50" : ""}>
                    <FieldGroup>
                        {!isContributionEnabled && <p className="text-sm text-muted-foreground">Nur für Mitglieder und Fördermitglieder verfügbar.</p>}
                        <form.Field
                            name="beitragsEinzug"
                            listeners={{
                                onChange: (v) => setBeitragsEinzugValue(v.value),
                            }}
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid}>
                                        <FieldLabel htmlFor={field.name}>Beitrags Einzug</FieldLabel>
                                        <Select value={field.state.value ?? "none"} onValueChange={(v) => field.handleChange(v === "none" ? undefined : (v as "r" | "l" | "b" | "p"))}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectItem value="none">Ehrenmitglied</SelectItem>
                                                    <SelectItem value="r">Rechnung</SelectItem>
                                                    <SelectItem value="l">Lastschrift</SelectItem>
                                                    <SelectItem value="b">Bar</SelectItem>
                                                    <SelectItem value="p">Übergeordnetes Mitglied</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                    </Field>
                                );
                            }}
                        />
                        <form.Field
                            name="beitragsSatzId"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className={isEhrenmitglied ? "opacity-50 pointer-events-none" : ""}>
                                        <FieldLabel htmlFor={field.name}>Beitragssatz</FieldLabel>
                                        <BeitragssatzSelector verein={verein} value={field.state.value as Id<"beitrags_satz">} onChange={field.handleChange} />
                                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                    </Field>
                                );
                            }}
                        />
                        <FieldSeparator />
                        <form.Field
                            name="sepaIban"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className={isSepaEnabled ? "" : "opacity-50 pointer-events-none"}>
                                        <FieldLabel htmlFor={field.name}>SEPA IBAN</FieldLabel>
                                        <Input
                                            type="text"
                                            placeholder="DE89 3704 0044 0532 0130 00"
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
                            name="sepaBic"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className={isSepaEnabled ? "" : "opacity-50 pointer-events-none"}>
                                        <FieldLabel htmlFor={field.name}>SEPA BIC</FieldLabel>
                                        <Input
                                            type="text"
                                            placeholder="COBADEFFXXX"
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
                            name="sepaMandatErstelltAm"
                            children={(field) => {
                                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                return (
                                    <Field data-invalid={isInvalid} className={isSepaEnabled ? "" : "opacity-50 pointer-events-none"}>
                                        <FieldLabel htmlFor={field.name}>SEPA Mandat erstellt am</FieldLabel>
                                        <DatePicker
                                            value={field.state.value}
                                            onChange={(v) => {
                                                if (isSepaEnabled) {
                                                    field.handleChange(v);
                                                }
                                            }}
                                        />
                                        {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                    </Field>
                                );
                            }}
                        />
                    </FieldGroup>
                </fieldset>
            </SimpleCard>
            <SimpleCard title="Datein" description="Dokumente zum Mitglied">
                <FieldGroup>
                    <form.Field
                        name="datein"
                        children={(field) => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                            return (
                                <Field data-invalid={isInvalid}>
                                    {field.state.value.map((datei) => (
                                        <Item size="sm" key={datei.id}>
                                            <ItemMedia>
                                                <HugeiconsIcon icon={Document} />
                                            </ItemMedia>
                                            <ItemContent>
                                                <ItemTitle>{datei.name}</ItemTitle>
                                            </ItemContent>
                                            <ItemActions>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={async () => {
                                                        const url = await convex.query(api.files.getUrl, {
                                                            fileId: datei.id,
                                                        });
                                                        window.open(url!, "_blank");
                                                    }}
                                                >
                                                    <HugeiconsIcon icon={View} />
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="icon"
                                                    onClick={() => {
                                                        form.setFieldValue(
                                                            "datein",
                                                            field.state.value.filter((d) => d.id !== datei.id),
                                                        );

                                                        if (!datei.saved) {
                                                            deleteFile({ fileId: datei.id });
                                                        } else {
                                                            setDeletedFiles([...deletedFiles, datei.id]);
                                                        }
                                                    }}
                                                >
                                                    <HugeiconsIcon icon={Trash} />
                                                </Button>
                                            </ItemActions>
                                        </Item>
                                    ))}
                                    <Separator className="my-2" />
                                    <Input type="file" multiple={false} onChange={handleFileUpload} disabled={uploading} />
                                </Field>
                            );
                        }}
                    />
                </FieldGroup>
            </SimpleCard>
            {(canLinkAccount || canAssignRoles) && (
                <SimpleCard title="Konto & Rollen" description="OpenVerein-Konto verknüpfen und Rollen zuweisen">
                    <FieldGroup>
                        {canLinkAccount && (
                            <Field>
                                <FieldLabel>Kontoverknüpfung</FieldLabel>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className={accountLinked ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{accountLinked ? "✓ Verknüpft" : "✗ Nicht verknüpft"}</span>
                                    {mitglied ? (
                                        accountLinked ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={async () => {
                                                    await removeAccountLink({ mitgliedId: mitglied._id });
                                                    setAccountLinked(false);
                                                    toast.success("Kontoverknüpfung entfernt");
                                                }}
                                            >
                                                Verknüpfung entfernen
                                            </Button>
                                        ) : (
                                            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button type="button" variant="outline">
                                                        Verknüpfungs-E-Mail senden
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Verknüpfungs-E-Mail senden</DialogTitle>
                                                        <DialogDescription>Empfänger eingeben. Der Link führt zur Konto-Anmeldung/Registrierung und danach zur Verknüpfung.</DialogDescription>
                                                    </DialogHeader>
                                                    <div className="grid gap-2 py-2">
                                                        <FieldLabel htmlFor="invite-email">E-Mail</FieldLabel>
                                                        <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="mitglied@example.org" />
                                                    </div>
                                                    <DialogFooter>
                                                        <Button
                                                            type="button"
                                                            disabled={!inviteEmail}
                                                            onClick={async () => {
                                                                await requestAccountLinkInvite({
                                                                    mitgliedId: mitglied._id,
                                                                    email: inviteEmail,
                                                                });
                                                                setInviteDialogOpen(false);
                                                                toast.success("Verknüpfungs-E-Mail wurde versendet");
                                                            }}
                                                        >
                                                            Einladung senden
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        )
                                    ) : (
                                        <span className="text-muted-foreground">Nach dem Speichern kann eine Verknüpfungs-E-Mail gesendet werden.</span>
                                    )}
                                </div>
                            </Field>
                        )}

                        {canAssignRoles && (
                            <form.Field
                                name="rollen"
                                children={(field) => {
                                    const selected = field.state.value ?? [];

                                    return (
                                        <Field>
                                            <FieldLabel>Rollen</FieldLabel>
                                            <div className="grid gap-2">
                                                {(vereinsRollen ?? []).length === 0 && <p className="text-sm text-muted-foreground">Keine Rollen verfügbar.</p>}
                                                {(vereinsRollen ?? []).map((rolle) => {
                                                    const checked = selected.includes(rolle._id);

                                                    return (
                                                        <label key={rolle._id} className="flex items-center gap-2 text-sm">
                                                            <Checkbox
                                                                checked={checked}
                                                                onCheckedChange={(value) => {
                                                                    if (value) {
                                                                        field.handleChange(Array.from(new Set([...selected, rolle._id])));
                                                                        return;
                                                                    }

                                                                    field.handleChange(selected.filter((item) => item !== rolle._id));
                                                                }}
                                                            />
                                                            <span>{rolle.name}</span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </Field>
                                    );
                                }}
                            />
                        )}
                    </FieldGroup>
                </SimpleCard>
            )}
            <div>
                <Button type="submit" onClick={form.handleSubmit}>
                    Speichern
                </Button>
            </div>
        </form>
    );
}
