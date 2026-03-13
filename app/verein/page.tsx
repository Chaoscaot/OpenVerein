import Link from "next/link";
import {
  ArrowRight01Icon,
  Building02Icon,
  CheckmarkCircle02Icon,
  PlusSignIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserComponent } from "@/components/UserComponent";
import { VereinsListe } from "@/components/verein/VereinsListe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { preloadAuthQuery } from "@/lib/auth-server";

export default async function VereinHomePage() {
  const list = await preloadAuthQuery(api.verein.list);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={Building02Icon} className="size-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Arbeitsbereich</p>
              <p className="text-base font-semibold tracking-tight">
                OpenVerein
              </p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/verein/new">
                <HugeiconsIcon icon={PlusSignIcon} />
                Verein erstellen
              </Link>
            </Button>
            <UserComponent dropdown={{ side: "bottom" }} />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="relative overflow-hidden rounded-[2rem] border bg-card px-6 py-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70 blur-3xl"
            style={{
              background:
                "radial-gradient(circle at top left, color-mix(in srgb, var(--color-primary) 18%, transparent) 0%, transparent 60%), radial-gradient(circle at top right, color-mix(in srgb, var(--color-primary) 12%, transparent) 0%, transparent 50%)",
            }}
          />

          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Vereinsauswahl</Badge>
                <Badge variant="secondary">
                  Alle zugänglichen Organisationen an einem Ort
                </Badge>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  Wähle den Verein, in dem du weiterarbeiten willst.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Hier siehst du alle Vereine, die du besitzt oder in denen dir
                  bereits Rechte zugewiesen wurden. Von hier aus springst du
                  direkt ins jeweilige Dashboard.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href="/verein/new">
                    Neuer Verein
                    <HugeiconsIcon icon={ArrowRight01Icon} />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur-sm">
                <p className="text-sm text-muted-foreground">Dein Bereich</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  Vereine & Rollen
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Eigene Vereine und freigeschaltete Mitgliedschaften gesammelt
                  in einer Ansicht.
                </p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur-sm">
                <p className="text-sm text-muted-foreground">
                  Direkter Einstieg
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  Sofort weiter
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Öffne den passenden Verein oder lege direkt einen neuen an.
                </p>
              </div>
              <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur-sm sm:col-span-2">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <HugeiconsIcon
                      icon={CheckmarkCircle02Icon}
                      className="size-5"
                    />
                  </div>
                  <div>
                    <p className="font-medium">
                      Aufgeräumter Einstieg statt Listenansicht
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Die Vereinskarten darunter zeigen dir Standort,
                      Mitgliederstand und Setup-Status, damit die Auswahl
                      schneller geht.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6">
          <VereinsListe preload={list} />
        </section>
      </main>
    </div>
  );
}
