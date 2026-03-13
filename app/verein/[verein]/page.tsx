import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowRight01Icon, CheckmarkCircle02Icon, CheckmarkSquare02Icon, CreditCard, FileText, Mail, Person, Settings, Shield } from "@hugeicons/core-free-icons";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";
import { buildCelebrationPreview, buildFinanceOverviewSummary, buildMemberStatGroups } from "@/lib/verein-dashboard";
import { VereinDashboardHighlights } from "@/components/verein/dashboard/VereinDashboardHighlights";

function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
    }).format(new Date(value));
}

function formatAddress(city?: string, postalCode?: string, country?: string) {
    return [postalCode, city].filter(Boolean).join(" ").trim() || country || null;
}

export default async function VereinPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;
    const vereinId = verein as Id<"verein">;

    const acl = await fetchAuthQuery(api.permissions.getMyPermissions, {
        vereinId,
    });
    const permissionSet = new Set(acl.permissions);

    const canVereinView = permissionSet.has("verein.view");
    const canMitgliederView = permissionSet.has("mitglied.view");
    const canMitgliedCreate = permissionSet.has("mitglied.create");
    const canListenManagement = permissionSet.has("liste.view") || permissionSet.has("liste.manage") || permissionSet.has("mitglied.view");
    const canCommunication = canListenManagement || permissionSet.has("mail.send");
    const canMailSend = permissionSet.has("mail.send");
    const canKassenView = permissionSet.has("kasse.view");
    const canBuchungView = permissionSet.has("buchung.view");
    const canFinanzenView = permissionSet.has("finanzen.view");
    const canBeitragView = permissionSet.has("beitragssatz.view");
    const canRollenView = permissionSet.has("rolle.view") || permissionSet.has("rolle.manage");
    const canSettingsView = permissionSet.has("settings.view");

    const vereinData = canVereinView ? await fetchAuthQuery(api.verein.get, { id: vereinId }) : null;
    const mitglieder = canMitgliederView ? await fetchAuthQuery(api.mitglieder.list, { vereinId }) : [];
    const kassen = canKassenView ? await fetchAuthQuery(api.finanzen.getKassen, { vereinId }) : [];
    const totalBestand = canFinanzenView ? await fetchAuthQuery(api.finanzen.getVereinFinanzen, { vereinId }) : null;
    const buchungen = canBuchungView ? await fetchAuthQuery(api.finanzen.getBuchungen, { vereinId }) : [];
    const beitragssaetze = canBeitragView ? await fetchAuthQuery(api.beitragssatz.list, { vereinId }) : [];
    const rollen = canRollenView ? await fetchAuthQuery(api.rollen.list, { vereinId }) : [];
    const aufgabenOverview = await fetchAuthQuery(api.aufgaben.overview, {
        vereinId,
    });

    const totalMembers = mitglieder.length;
    const activeMembers = mitglieder.filter((mitglied) => mitglied.typ === "mitglied" || mitglied.typ === "fördermitglied").length;
    const applicants = mitglieder.filter((mitglied) => mitglied.typ === "bewerber").length;
    const formerMembers = mitglieder.filter((mitglied) => mitglied.typ === "ausgeschieden").length;
    const emailOptIns = mitglieder.filter((mitglied) => mitglied.kommunikation?.listenEmails).length;

    const activeKassen = kassen.filter((kasse) => kasse.aktiv).length;
    const currencies = [...new Set(kassen.map((kasse) => kasse.waehrung))];
    const primaryCurrency = currencies[0] ?? "EUR";
    const latestBooking = buchungen[0] ?? null;

    const addressSummary = vereinData ? formatAddress(vereinData.address.city, vereinData.address.postalCode, vereinData.address.country) : null;

    const workspaces = [
        {
            title: "Aufgaben",
            description: "Listen, Zuständigkeiten und Abhängigkeiten für Vereinsarbeit transparent koordinieren.",
            href: `/verein/${verein}/aufgaben`,
            icon: CheckmarkSquare02Icon,
            visible: aufgabenOverview.canOpenModule,
            eyebrow:
                aufgabenOverview.totalOpenTasks > 0
                    ? `${aufgabenOverview.totalOpenTasks} offene Aufgaben`
                    : aufgabenOverview.canCreateLists
                      ? "Bereit für die erste Aufgabenliste"
                      : "Noch keine offenen Aufgaben",
            meta:
                aufgabenOverview.assignedOpenTasks > 0
                    ? `${aufgabenOverview.assignedOpenTasks} dir aktuell zugewiesen`
                    : aufgabenOverview.totalAccessibleLists > 0
                      ? `${aufgabenOverview.totalAccessibleLists} Aufgabenlisten sichtbar`
                      : "Erste Aufgabenliste anlegen",
        },
        {
            title: "Mitglieder",
            description: "Stammdaten, Status und Kontaktinformationen an einem Ort pflegen.",
            href: `/verein/${verein}/mitglieder`,
            icon: Person,
            visible: canMitgliederView,
            eyebrow: totalMembers > 0 ? `${totalMembers} Personen erfasst` : "Noch keine Mitglieder angelegt",
            meta: totalMembers > 0 ? `${activeMembers} aktiv, ${applicants} Bewerbungen offen` : "Mitgliederbereich öffnen",
        },
        {
            title: "Listen & Mail",
            description: "Listen verwalten und Rundmails mit Empfängervorschau versenden.",
            href: canListenManagement ? `/verein/${verein}/listen/verwaltung` : `/verein/${verein}/listen/mail`,
            icon: Mail,
            visible: canCommunication,
            eyebrow: canMailSend ? "Mailversand freigeschaltet" : "Listenverwaltung verfügbar",
            meta: canMitgliederView ? `${emailOptIns} Mitglieder für Vereinsmails freigegeben` : "Listenbereich öffnen",
        },
        {
            title: "Finanzen",
            description: "Kassen, Buchungen und Bestände des Vereins im Blick behalten.",
            href: `/verein/${verein}/finanzen`,
            icon: CreditCard,
            visible: canFinanzenView || canKassenView || canBuchungView,
            eyebrow:
                canFinanzenView && totalBestand !== null && currencies.length === 1
                    ? formatCurrency(totalBestand, primaryCurrency)
                    : canKassenView
                      ? `${activeKassen} aktive Kassen`
                      : "Finanzbereich öffnen",
            meta:
                latestBooking !== null
                    ? `Letzte Buchung am ${formatDate(latestBooking.datum)}`
                    : canKassenView && currencies.length > 1
                      ? `${currencies.length} Währungen im Einsatz`
                      : "Buchungen und Konten verwalten",
        },
        {
            title: "Beitragssätze",
            description: "Tarife definieren und sauber den Mitgliedschaften zuordnen.",
            href: `/verein/${verein}/finanzen/beitragssaetze`,
            icon: FileText,
            visible: canBeitragView,
            eyebrow: beitragssaetze.length > 0 ? `${beitragssaetze.length} Beitragssätze angelegt` : "Noch keine Beitragssätze vorhanden",
            meta: beitragssaetze.length > 0 ? "Beitragspflege öffnen" : "Ersten Beitragssatz anlegen",
        },
        {
            title: "Rollen & Rechte",
            description: "Zugriffe für Vorstand, Kasse und Teams strukturiert vergeben.",
            href: `/verein/${verein}/rollen`,
            icon: Shield,
            visible: canRollenView,
            eyebrow: rollen.length > 0 ? `${rollen.length} Rollen definiert` : "Berechtigungen zentral organisieren",
            meta: acl.rolleIds.length > 0 ? `${acl.rolleIds.length} Rollen diesem Konto zugeordnet` : "Rollenverwaltung öffnen",
        },
        {
            title: "Einstellungen",
            description: "Vereinsprofil, Kontakt- und SEPA-Daten aktuell halten.",
            href: `/verein/${verein}/settings`,
            icon: Settings,
            visible: canSettingsView,
            eyebrow: vereinData?.contact.email ? vereinData.contact.email : "Vereinsprofil prüfen",
            meta: addressSummary ?? "Adresse und Kontakt vervollständigen",
        },
    ].filter((workspace) => workspace.visible);

    const primaryAction = workspaces.find((workspace) => workspace.title === "Mitglieder") ?? workspaces.find((workspace) => workspace.title === "Finanzen") ?? workspaces[0] ?? null;

    const secondaryAction = canSettingsView
        ? {
              title: "Einstellungen",
              href: `/verein/${verein}/settings`,
          }
        : (workspaces[1] ?? null);
    const resolvedSecondaryAction = secondaryAction && secondaryAction.href !== primaryAction?.href ? secondaryAction : null;

    const summaryCards = [
        {
            label: "Freigeschaltete Bereiche",
            value: workspaces.length.toString(),
            hint: "Module für dieses Konto",
        },
        {
            label: acl.isOwner ? "Kontotyp" : "Zugriffsstatus",
            value: acl.isOwner ? "Eigentümer" : "Mitglied",
            hint: acl.rolleIds.length > 0 ? `${acl.rolleIds.length} Rollen aktiv` : "Direkter Vereinszugriff",
        },
        ...(canMitgliederView
            ? [
                  {
                      label: "Mitgliederbestand",
                      value: totalMembers.toString(),
                      hint: totalMembers > 0 ? `${activeMembers} aktiv, ${formerMembers} ausgeschieden` : "Mitgliederbereich bereit",
                  },
              ]
            : []),
        ...(canFinanzenView || canKassenView || canBuchungView
            ? [
                  {
                      label: "Finanzstatus",
                      value:
                          canFinanzenView && totalBestand !== null && currencies.length === 1
                              ? formatCurrency(totalBestand, primaryCurrency)
                              : canKassenView
                                ? `${activeKassen} Kassen`
                                : canBuchungView
                                  ? `${buchungen.length} Buchungen`
                                  : "Freigeschaltet",
                      hint:
                          latestBooking !== null
                              ? `Letzte Buchung am ${formatDate(latestBooking.datum)}`
                              : canKassenView && currencies.length > 1
                                ? `${currencies.length} Währungen vorhanden`
                                : "Finanzbereich verfügbar",
                  },
              ]
            : []),
    ];

    const profileChecks = vereinData
        ? [
              {
                  label: "Adresse",
                  complete: Boolean(vereinData.address.street && vereinData.address.city && vereinData.address.postalCode && vereinData.address.country),
                  detail: addressSummary ?? "Adresse fehlt noch",
              },
              {
                  label: "Kontakt",
                  complete: Boolean(vereinData.contact.email),
                  detail: vereinData.contact.email || "E-Mail fehlt",
              },
              {
                  label: "Telefon",
                  complete: Boolean(vereinData.contact.phone),
                  detail: vereinData.contact.phone || "Noch keine Telefonnummer hinterlegt",
              },
              {
                  label: "SEPA",
                  complete: Boolean(vereinData.sepa?.iban && vereinData.sepa?.bic && vereinData.sepa?.creditorId),
                  detail: vereinData.sepa ? "Lastschrift-Daten hinterlegt" : "SEPA-Daten fehlen",
              },
          ]
        : [];

    const setupActions = [
        canMitgliedCreate && totalMembers === 0
            ? {
                  label: "Erstes Mitglied anlegen",
                  href: `/verein/${verein}/mitglieder/neu`,
              }
            : null,
        canKassenView && kassen.length === 0
            ? {
                  label: "Erste Kasse anlegen",
                  href: `/verein/${verein}/finanzen`,
              }
            : null,
        canBeitragView && beitragssaetze.length === 0
            ? {
                  label: "Beitragssatz definieren",
                  href: `/verein/${verein}/finanzen/beitragssaetze`,
              }
            : null,
        canSettingsView && profileChecks.some((item) => !item.complete)
            ? {
                  label: "Vereinsprofil vervollständigen",
                  href: `/verein/${verein}/settings`,
              }
            : null,
    ].filter((item): item is { label: string; href: string } => item !== null);

    const memberGroups = canMitgliederView
        ? buildMemberStatGroups(
              mitglieder.map((mitglied) => ({
                  _id: mitglied._id,
                  vorname: mitglied.vorname,
                  nachname: mitglied.nachname,
                  geburtsdatum: mitglied.geburtsdatum,
                  beitrittsdatum: mitglied.beitrittsdatum,
                  typ: mitglied.typ,
                  userId: mitglied.userId,
                  rollen: mitglied.rollen,
                  beitragsEinzug: mitglied.beitragsEinzug,
                  beitragsSatzId: mitglied.beitragsSatzId,
              })),
              rollen.map((rolle) => ({
                  _id: rolle._id,
                  name: rolle.name,
              })),
          )
        : [];

    const financeSummary =
        canFinanzenView || canKassenView || canBuchungView
            ? buildFinanceOverviewSummary({
                  members: mitglieder.map((mitglied) => ({
                      _id: mitglied._id,
                      vorname: mitglied.vorname,
                      nachname: mitglied.nachname,
                      geburtsdatum: mitglied.geburtsdatum,
                      beitrittsdatum: mitglied.beitrittsdatum,
                      typ: mitglied.typ,
                      userId: mitglied.userId,
                      rollen: mitglied.rollen,
                      beitragsEinzug: mitglied.beitragsEinzug,
                      beitragsSatzId: mitglied.beitragsSatzId,
                  })),
                  beitragssaetze: beitragssaetze.map((satz) => ({
                      _id: satz._id,
                      betrag: satz.betrag,
                      waehrung: satz.waehrung,
                  })),
                  kassen: kassen.map((kasse) => ({
                      _id: kasse._id,
                      name: kasse.name,
                      typ: kasse.typ,
                      waehrung: kasse.waehrung,
                      aktuellerBestand: kasse.aktuellerBestand,
                      aktiv: kasse.aktiv,
                  })),
                  buchungen: buchungen.map((buchung) => ({
                      _id: buchung._id,
                      kasseId: buchung.kasseId,
                      betrag: buchung.betrag,
                      datum: buchung.datum,
                      zweck: buchung.zweck,
                  })),
                  fallbackCurrency: primaryCurrency,
              })
            : null;

    const celebrationPreview = canMitgliederView
        ? buildCelebrationPreview(
              mitglieder.map((mitglied) => ({
                  _id: mitglied._id,
                  vorname: mitglied.vorname,
                  nachname: mitglied.nachname,
                  geburtsdatum: mitglied.geburtsdatum,
                  beitrittsdatum: mitglied.beitrittsdatum,
                  typ: mitglied.typ,
                  userId: mitglied.userId,
                  rollen: mitglied.rollen,
                  beitragsEinzug: mitglied.beitragsEinzug,
                  beitragsSatzId: mitglied.beitragsSatzId,
              })),
              verein,
          )
        : { birthdays: [], anniversaries: [] };

    const buchungenByKasse = new Map<string, typeof buchungen>();
    for (const buchung of buchungen) {
        const existing = buchungenByKasse.get(buchung.kasseId) ?? [];
        existing.push(buchung);
        buchungenByKasse.set(buchung.kasseId, existing);
    }

    const invoiceUploadData = {
        fallbackHref: `/verein/${verein}/finanzen`,
        kassen: kassen
            .map((kasse) => ({
                id: kasse._id,
                name: kasse.name,
                currency: kasse.waehrung,
                bookings: (buchungenByKasse.get(kasse._id) ?? []).slice(0, 20).map((buchung) => ({
                    id: buchung._id,
                    date: buchung.datum,
                    purpose: buchung.zweck,
                    amount: buchung.betrag,
                    currency: kasse.waehrung,
                    href: `/verein/${verein}/finanzen/${kasse._id}/rechnungen/${buchung._id}`,
                })),
            }))
            .filter((kasse) => kasse.bookings.length > 0),
    };

    const preferredKasse = kassen.find((kasse) => kasse.aktiv) ?? kassen[0] ?? null;

    return (
        <>
            <SiteHeader title="Vereinsübersicht" />
            <div className="space-y-6 p-4">
                <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-8">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70 blur-3xl"
                        style={{
                            background:
                                "radial-gradient(circle at top left, color-mix(in srgb, var(--color-primary) 18%, transparent) 0%, transparent 60%), radial-gradient(circle at top right, color-mix(in srgb, var(--color-primary) 12%, transparent) 0%, transparent 50%)",
                        }}
                    />
                    <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                        <div className="space-y-5">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{acl.isOwner ? "Eigentümerzugriff" : "Mitgliedszugriff"}</Badge>
                                {vereinData?.contact.email ? <Badge variant="secondary">{vereinData.contact.email}</Badge> : null}
                                {addressSummary ? <Badge variant="secondary">{addressSummary}</Badge> : null}
                            </div>
                            <div className="space-y-3">
                                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{vereinData?.name ?? "Vereinsübersicht"}</h1>
                                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                                    {workspaces.length > 0
                                        ? "Die wichtigsten Arbeitsbereiche und der aktuelle Setup-Status sind hier gebündelt, damit du ohne Umwege in den nächsten sinnvollen Schritt springen kannst."
                                        : "Für dieses Konto ist der Dashboard-Zugriff aktiv, aber es sind noch keine weiteren Arbeitsbereiche freigeschaltet."}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {primaryAction ? (
                                    <Button asChild size="lg">
                                        <Link href={primaryAction.href}>
                                            {primaryAction.title} öffnen
                                            <HugeiconsIcon icon={ArrowRight01Icon} />
                                        </Link>
                                    </Button>
                                ) : null}
                                {resolvedSecondaryAction ? (
                                    <Button asChild size="lg" variant="outline">
                                        <Link href={resolvedSecondaryAction.href}>{resolvedSecondaryAction.title}</Link>
                                    </Button>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {summaryCards.map((card) => (
                                <div key={card.label} className="rounded-2xl border bg-background/80 p-4 backdrop-blur-sm">
                                    <p className="text-sm text-muted-foreground">{card.label}</p>
                                    <p className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</p>
                                    <p className="mt-1 text-sm text-muted-foreground">{card.hint}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <VereinDashboardHighlights
                    canViewMembers={canMitgliederView}
                    canViewFinance={canFinanzenView || canKassenView || canBuchungView}
                    memberGroups={memberGroups}
                    finance={financeSummary}
                    invoiceUpload={invoiceUploadData}
                    celebrations={celebrationPreview}
                    financeActions={{
                        newExpenseHref: preferredKasse ? `/verein/${verein}/finanzen/${preferredKasse._id}?create=ausgabe` : null,
                        newInvoiceHref: `/verein/${verein}#e-rechnung-upload`,
                    }}
                />

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                    <Card className="rounded-[2rem]">
                        <CardHeader>
                            <CardTitle>Arbeitsbereiche</CardTitle>
                            <CardDescription>Direkte Einstiege in alle Bereiche, die für dieses Konto freigeschaltet sind.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {workspaces.length === 0 ? (
                                <Empty className="border border-dashed rounded-2xl py-10">
                                    <EmptyHeader>
                                        <EmptyMedia variant="icon">
                                            <HugeiconsIcon icon={Alert02Icon} />
                                        </EmptyMedia>
                                        <EmptyTitle>Keine Bereiche freigeschaltet</EmptyTitle>
                                        <EmptyDescription>Bitte weise diesem Konto weitere Rechte zu, damit hier Arbeitsbereiche erscheinen.</EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {workspaces.map((workspace) => (
                                        <div key={workspace.href} className="flex h-full flex-col justify-between rounded-3xl border bg-background/70 p-5 transition-colors hover:bg-background">
                                            <div className="space-y-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                                        <HugeiconsIcon icon={workspace.icon} className="size-5" />
                                                    </div>
                                                    <Badge variant="outline" className="max-w-[70%] truncate">
                                                        {workspace.eyebrow}
                                                    </Badge>
                                                </div>
                                                <div className="space-y-2">
                                                    <h2 className="text-lg font-semibold tracking-tight">{workspace.title}</h2>
                                                    <p className="text-sm leading-6 text-muted-foreground">{workspace.description}</p>
                                                </div>
                                            </div>
                                            <div className="mt-6 flex items-center justify-between gap-3">
                                                <p className="text-sm text-muted-foreground">{workspace.meta}</p>
                                                <Button asChild variant="outline">
                                                    <Link href={workspace.href}>Öffnen</Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card className="rounded-[2rem]">
                            <CardHeader>
                                <CardTitle>Anstehende Aufgaben</CardTitle>
                                <CardDescription>Deine nächsten Aufgaben mit Termin aus allen sichtbaren Listen.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {aufgabenOverview.canOpenModule ? (
                                    aufgabenOverview.upcomingMine.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Aktuell sind dir keine termingebundenen Aufgaben zugeordnet.</div>
                                    ) : (
                                        <div className="space-y-3">
                                            {aufgabenOverview.upcomingMine.map((task) => (
                                                <div key={task._id} className="rounded-2xl border p-4 space-y-2">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                            <p className="font-medium">{task.titel}</p>
                                                            <p className="text-sm text-muted-foreground">{task.listeName}</p>
                                                        </div>
                                                        <Badge
                                                            variant={
                                                                task.status === "erledigt"
                                                                    ? "secondary"
                                                                    : task.status === "blockiert"
                                                                      ? "destructive"
                                                                      : task.status === "in_bearbeitung"
                                                                        ? "default"
                                                                        : "outline"
                                                            }
                                                        >
                                                            {task.status === "offen"
                                                                ? "Offen"
                                                                : task.status === "in_bearbeitung"
                                                                  ? "In Bearbeitung"
                                                                  : task.status === "blockiert"
                                                                    ? "Blockiert"
                                                                    : "Erledigt"}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">
                                                        {task.ende ? `Fällig am ${formatDate(task.ende)}` : task.start ? `Start am ${formatDate(task.start)}` : "Ohne Termin"}
                                                    </p>
                                                    <Button asChild size="sm" variant="outline">
                                                        <Link href={`/verein/${verein}/aufgaben`}>Aufgaben öffnen</Link>
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Das Aufgabenmodul ist für dieses Konto noch nicht freigeschaltet.</div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem]">
                            <CardHeader>
                                <CardTitle>Nächste Schritte</CardTitle>
                                <CardDescription>Offene Basics, die den Verein alltagstauglich machen.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {setupActions.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                                        Aktuell sind keine offensichtlichen Setup-Lücken auf dieser Ebene erkennbar.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {setupActions.map((action) => (
                                            <div key={action.href} className="flex items-center justify-between gap-3 rounded-2xl border p-4">
                                                <div>
                                                    <p className="font-medium">{action.label}</p>
                                                    <p className="text-sm text-muted-foreground">Direkt in den passenden Bereich springen.</p>
                                                </div>
                                                <Button asChild size="sm" variant="outline">
                                                    <Link href={action.href}>Öffnen</Link>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem]">
                            <CardHeader>
                                <CardTitle>Vereinsprofil</CardTitle>
                                <CardDescription>Status der wichtigsten Stammdaten für die Organisation.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {profileChecks.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                                        Keine Profildaten sichtbar, weil für dieses Konto kein Vereinszugriff freigeschaltet ist.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {profileChecks.map((item) => (
                                            <div key={item.label} className="flex items-start gap-3 rounded-2xl border p-4">
                                                <div
                                                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
                                                        item.complete ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                                    }`}
                                                >
                                                    <HugeiconsIcon icon={item.complete ? CheckmarkCircle02Icon : Alert02Icon} className="size-4" />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium">{item.label}</p>
                                                        <Badge variant={item.complete ? "secondary" : "outline"}>{item.complete ? "Komplett" : "Offen"}</Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{item.detail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="rounded-[2rem]">
                            <CardHeader>
                                <CardTitle>Kurzer Überblick</CardTitle>
                                <CardDescription>Wichtige Zahlen aus den Bereichen, die bereits Daten liefern.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {canMitgliederView ? (
                                    <div className="flex items-center justify-between rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">Mitglieder aktiv</p>
                                            <p className="text-sm text-muted-foreground">Aktive und fördernde Mitgliedschaften</p>
                                        </div>
                                        <p className="text-xl font-semibold">{activeMembers}</p>
                                    </div>
                                ) : null}
                                {canMitgliederView ? (
                                    <div className="flex items-center justify-between rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">Mail-Einwilligungen</p>
                                            <p className="text-sm text-muted-foreground">Mitglieder mit aktivierter Vereinskommunikation</p>
                                        </div>
                                        <p className="text-xl font-semibold">{emailOptIns}</p>
                                    </div>
                                ) : null}
                                {canKassenView ? (
                                    <div className="flex items-center justify-between rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">Aktive Kassen</p>
                                            <p className="text-sm text-muted-foreground">Konten und Barkassen mit aktivem Status</p>
                                        </div>
                                        <p className="text-xl font-semibold">{activeKassen}</p>
                                    </div>
                                ) : null}
                                {canBeitragView ? (
                                    <div className="flex items-center justify-between rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">Beitragssätze</p>
                                            <p className="text-sm text-muted-foreground">Verfügbare Modelle für Mitgliedsbeiträge</p>
                                        </div>
                                        <p className="text-xl font-semibold">{beitragssaetze.length}</p>
                                    </div>
                                ) : null}
                                {!canMitgliederView && !canKassenView && !canBeitragView ? (
                                    <Empty className="rounded-2xl border border-dashed p-8">
                                        <EmptyHeader>
                                            <EmptyMedia variant="icon">
                                                <HugeiconsIcon icon={Alert02Icon} />
                                            </EmptyMedia>
                                            <EmptyTitle>Keine Kennzahlen sichtbar</EmptyTitle>
                                            <EmptyDescription>Die vorhandenen Rechte erlauben aktuell keinen Blick auf Mitglieder-, Finanz- oder Beitragsdaten.</EmptyDescription>
                                        </EmptyHeader>
                                        <EmptyContent />
                                    </Empty>
                                ) : null}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
