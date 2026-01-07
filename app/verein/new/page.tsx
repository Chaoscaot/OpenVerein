"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/convex/_generated/api";
import { getCountries } from "@/lib/utils";
import { Check, X } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useForm } from "@tanstack/react-form";
import { useConvex, useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import z from "zod";

const formSchema = z.object({
    name: z.string().min(5, "Der Name muss mindestens 5 Zeichen lang sein"),
    email: z.email("Bitte gib eine gültige Email-Adresse ein"),
    city: z.string("Bitte gib eine Stadt ein"),
    postalcode: z.string("Bitte gib eine Postleitzahl ein").min(5, "Die Postleitzahl muss mindestens 5 Zeichen lang sein"),
    street: z.string().min(5, "Bitte gib eine Straße ein"),
    country: z.string().min(2, "Bitte wähle ein Land aus"),
});

export default function NewVereinPage() {
    const [nameState, setNameState] = useState<"blur" | "checking" | "error" | "good">("blur");
    const convex = useConvex();
    const [submitting, setSubmitting] = useState(false);
    const createVerein = useMutation(api.verein.create);
    const router = useRouter();
    const form = useForm({
        validators: {
            onSubmit: formSchema,
        },
        defaultValues: {
            name: "",
            email: "",
            city: "",
            postalcode: "",
            street: "",
            country: "",
        },
        onSubmit: async ({ value }) => {
            setSubmitting(true);
            try {
                const id = await createVerein({
                    name: value.name,
                    email: value.email,
                    city: value.city,
                    postalCode: value.postalcode,
                    street: value.street,
                    country: value.country,
                });
                router.replace(`/verein/${id}`);
            } finally {
                setSubmitting(false);
            }
        },
    });

    const countries = useMemo(() => getCountries(), []);

    return (
        <main className="w-screen h-screen flex items-center justify-center">
            <Card className="w-100">
                <CardHeader>
                    <CardTitle>Verein anlegen</CardTitle>
                    <CardDescription>Erstelle hier deinen neuen Verein. Damit kannst du Mitglieder verwalten, Veranstaltungen planen und vieles mehr.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            form.handleSubmit();
                        }}
                    >
                        <FieldGroup>
                            <form.Field
                                name="name"
                                asyncDebounceMs={200}
                                validators={{
                                    onChangeAsync: async (v) => {
                                        if (v.value.length < 5) {
                                            setNameState("blur");
                                            return undefined;
                                        }
                                        setNameState("checking");
                                        const exists = await convex.query(api.verein.nameExists, { name: v.value });
                                        if (exists) {
                                            setNameState("error");
                                            return {
                                                message: "Ein Verein mit diesem Namen existiert bereits.",
                                            };
                                        } else {
                                            setNameState("good");
                                            return undefined;
                                        }
                                    },
                                }}
                                children={(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                    return (
                                        <Field>
                                            <FieldLabel htmlFor={field.name}>Vereinsname</FieldLabel>
                                            <div className="relative">
                                                <Input
                                                    required
                                                    id={field.name}
                                                    name={field.name}
                                                    value={field.state.value}
                                                    onBlur={field.handleBlur}
                                                    onChange={(e) => field.handleChange(e.target.value)}
                                                    aria-invalid={isInvalid}
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    {nameState === "checking" && <Spinner />}
                                                    {nameState === "good" && <HugeiconsIcon icon={Check} />}
                                                    {nameState === "error" && <HugeiconsIcon icon={X} />}
                                                </div>
                                            </div>
                                            {isInvalid && <FieldError errors={field.state.meta.errors} />}
                                        </Field>
                                    );
                                }}
                            />
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
                                name="street"
                                children={(field) => {
                                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                    return (
                                        <Field data-invalid={isInvalid}>
                                            <FieldLabel htmlFor={field.name}>Straße</FieldLabel>
                                            <Input
                                                type="text"
                                                placeholder="Musterstraße 1"
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
                            <div className="grid grid-cols-3 gap-2">
                                <form.Field
                                    name="postalcode"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid}>
                                                <FieldLabel htmlFor={field.name}>Postleitzahl</FieldLabel>
                                                <Input
                                                    placeholder="10176"
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
                                    name="city"
                                    children={(field) => {
                                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                                        return (
                                            <Field data-invalid={isInvalid} className="col-span-2">
                                                <FieldLabel htmlFor={field.name}>Ort</FieldLabel>
                                                <Input
                                                    type="text"
                                                    placeholder="Berlin"
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
                    </form>
                </CardContent>
                <CardFooter>
                    <Button onClick={() => router.back()} variant={"ghost"} disabled={submitting} className="ml-auto">
                        Abbrechen
                    </Button>
                    <Button onClick={() => form.handleSubmit()} disabled={submitting} className="ml-2">
                        Erstellen
                    </Button>
                </CardFooter>
            </Card>
        </main>
    );
}
