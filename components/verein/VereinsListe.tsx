"use client";

import Link from "next/link";
import {
  ArrowRight01Icon,
  CreditCard,
  FolderLibraryIcon,
  Mail01Icon,
  MapsIcon,
  PlusSignIcon,
  Shield01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../ui/empty";

function formatAddress(city?: string, postalCode?: string, country?: string) {
  return (
    [postalCode, city].filter(Boolean).join(" ").trim() ||
    country ||
    "Adresse fehlt"
  );
}

export function VereinsListe({
  preload,
}: {
  preload: Preloaded<typeof api.verein.list>;
}) {
  const vereine = usePreloadedQuery(preload);

  const totalMembers = vereine.reduce(
    (sum, verein) => sum + verein.mitgliederAnzahl,
    0,
  );
  const sepaReady = vereine.filter((verein) =>
    Boolean(verein.sepa?.iban && verein.sepa?.bic && verein.sepa?.creditorId),
  ).length;
  const withPhone = vereine.filter((verein) =>
    Boolean(verein.contact.phone),
  ).length;

  if (vereine.length === 0) {
    return (
      <Card className="rounded-[2rem]">
        <CardHeader>
          <CardTitle>Deine Vereine</CardTitle>
          <CardDescription>
            Es gibt noch keinen Verein in deinem Arbeitsbereich.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Empty className="rounded-3xl border border-dashed py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={FolderLibraryIcon} />
              </EmptyMedia>
              <EmptyTitle>Noch kein Verein vorhanden</EmptyTitle>
              <EmptyDescription>
                Lege deinen ersten Verein an, um Mitglieder, Finanzen und
                Kommunikation zentral zu verwalten.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/verein/new">
                    <HugeiconsIcon icon={PlusSignIcon} />
                    Verein erstellen
                  </Link>
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Vereine</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {vereine.length}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Zugängliche Organisationen
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Mitglieder gesamt</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {totalMembers}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Summiert aus allen Vereinen
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">SEPA bereit</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {sepaReady}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mit vollständigen Lastschrift-Daten
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">Telefon gepflegt</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">
            {withPhone}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Vereine mit hinterlegter Rufnummer
          </p>
        </div>
      </div>

      <Card className="rounded-[2rem]">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Deine Vereine</CardTitle>
            <CardDescription>
              Wähle einen Verein, um direkt in Dashboard, Mitglieder, Finanzen
              oder Einstellungen zu springen.
            </CardDescription>
          </div>
          <Button asChild variant="outline">
            <Link href="/verein/new">
              <HugeiconsIcon icon={PlusSignIcon} />
              Verein erstellen
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {vereine.map((verein) => {
              const location = formatAddress(
                verein.address.city,
                verein.address.postalCode,
                verein.address.country,
              );
              const isSepaReady = Boolean(
                verein.sepa?.iban &&
                verein.sepa?.bic &&
                verein.sepa?.creditorId,
              );
              const contactEmail =
                verein.contact.email || "Keine Kontakt-E-Mail hinterlegt";

              return (
                <Link
                  key={verein._id}
                  href={`/verein/${verein._id}`}
                  className="group block h-full"
                >
                  <Card className="h-full rounded-3xl border bg-background/70 transition-colors group-hover:bg-background">
                    <CardHeader className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <HugeiconsIcon
                            icon={FolderLibraryIcon}
                            className="size-5"
                          />
                        </div>
                        <Badge variant={isSepaReady ? "secondary" : "outline"}>
                          {isSepaReady ? "SEPA bereit" : "SEPA offen"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <CardTitle className="text-xl tracking-tight">
                          {verein.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">
                          {contactEmail}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border p-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <HugeiconsIcon
                              icon={UserGroupIcon}
                              className="size-4"
                            />
                            <span className="text-sm">Mitglieder</span>
                          </div>
                          <p className="mt-2 text-xl font-semibold">
                            {verein.mitgliederAnzahl}
                          </p>
                        </div>
                        <div className="rounded-2xl border p-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <HugeiconsIcon
                              icon={CreditCard}
                              className="size-4"
                            />
                            <span className="text-sm">Finanzen</span>
                          </div>
                          <p className="mt-2 text-sm font-medium">
                            {isSepaReady
                              ? "Einzug vorbereitet"
                              : "Setup prüfen"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-start gap-3 text-sm text-muted-foreground">
                          <HugeiconsIcon
                            icon={MapsIcon}
                            className="mt-0.5 size-4 shrink-0"
                          />
                          <span>{location}</span>
                        </div>
                        <div className="flex items-start gap-3 text-sm text-muted-foreground">
                          <HugeiconsIcon
                            icon={Mail01Icon}
                            className="mt-0.5 size-4 shrink-0"
                          />
                          <span className="truncate">{contactEmail}</span>
                        </div>
                        <div className="flex items-start gap-3 text-sm text-muted-foreground">
                          <HugeiconsIcon
                            icon={Shield01Icon}
                            className="mt-0.5 size-4 shrink-0"
                          />
                          <span>
                            {verein.contact.phone
                              ? `Telefon: ${verein.contact.phone}`
                              : "Keine Telefonnummer hinterlegt"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-4">
                        <p className="text-sm text-muted-foreground">
                          Zum Vereinsdashboard
                        </p>
                        <span className="inline-flex h-8 items-center justify-center rounded-4xl border border-border bg-input/30 px-3 text-sm font-medium transition-colors group-hover:bg-input/50">
                          Öffnen
                          <HugeiconsIcon icon={ArrowRight01Icon} />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
