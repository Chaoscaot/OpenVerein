import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users, FileText, CreditCard, BarChart, Shield, Mail } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const features = [
    {
        icon: Users,
        title: "Mitgliederverwaltung",
        description: "Verwalte alle Mitglieder deines Vereins an einem Ort. Persönliche Daten, Beiträge und Mitgliedschaftsstatus immer im Blick.",
    },
    {
        icon: CreditCard,
        title: "Beitragsverwaltung",
        description: "Flexible Beitragssätze, automatische Abbuchungen per SEPA-Lastschrift und lückenlose Nachverfolgung aller Zahlungen.",
    },
    {
        icon: FileText,
        title: "SEPA-Export",
        description: "Erstelle normkonforme SEPA-Dateien für deine Hausbank mit wenigen Klicks – bereit für die Weiterverarbeitung.",
    },
    {
        icon: Mail,
        title: "E-Mail-Kommunikation",
        description: "Sende professionelle E-Mails direkt aus OpenVerein heraus. Transaktionale Nachrichten automatisiert und zuverlässig.",
    },
    {
        icon: BarChart,
        title: "Übersicht & Berichte",
        description: "Behalte den Überblick über Wachstum, Finanzen und Aktivitäten deines Vereins mit übersichtlichen Dashboards.",
    },
    {
        icon: Shield,
        title: "Sicher & DSGVO-konform",
        description: "Deine Daten werden sicher gespeichert und verarbeitet. Vollständig konform mit der Datenschutz-Grundverordnung.",
    },
];

export default function Home() {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Hero */}
            <section className="relative flex flex-col items-center justify-center text-center px-6 py-32 overflow-hidden">
                {/* Background gradient blobs */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-20 blur-3xl"
                    style={{
                        background: "radial-gradient(ellipse at center, var(--color-primary) 0%, transparent 70%)",
                    }}
                />

                <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-6">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border border-primary/30 bg-primary/10 text-primary">Open Source · Kostenlos</span>

                    <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight">
                        Vereinsverwaltung, <span className="text-primary">einfach gemacht</span>
                    </h1>

                    <p className="text-lg text-muted-foreground max-w-xl">
                        OpenVerein bündelt Mitgliederverwaltung, Beitragsabrechnung und Kommunikation in einer modernen, intuitiven Plattform – damit du dich auf das Wesentliche konzentrieren kannst.
                    </p>

                    <div className="flex flex-wrap gap-3 justify-center">
                        <Link href="/signup">
                            <Button size="lg" className="px-8">
                                Jetzt kostenlos starten
                            </Button>
                        </Link>
                        <Link href="/login">
                            <Button size="lg" variant="outline" className="px-8">
                                Anmelden
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Divider */}
            <div className="w-full h-px bg-border mx-auto max-w-5xl" />

            {/* Features */}
            <section className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight mb-3">Alles, was dein Verein braucht</h2>
                        <p className="text-muted-foreground max-w-lg mx-auto">Von der Mitgliederpflege bis zur Buchhaltung – OpenVerein deckt alle wichtigen Bereiche der Vereinsarbeit ab.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {features.map(({ icon: Icon, title, description }) => (
                            <div key={title} className="group rounded-xl border bg-card p-6 flex flex-col gap-4 transition-shadow hover:shadow-md">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <HugeiconsIcon icon={Icon} className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-base mb-1">{title}</h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Banner */}
            <section className="py-20 px-6">
                <div className="max-w-3xl mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex flex-col items-center text-center gap-5 py-16 px-8">
                    <h2 className="text-3xl font-bold tracking-tight">Bereit loszulegen?</h2>
                    <p className="text-muted-foreground max-w-md">Registriere deinen Verein in wenigen Minuten und erlebe, wie einfach moderne Vereinsverwaltung sein kann.</p>
                    <Link href="/signup">
                        <Button size="lg" className="px-10">
                            Kostenlos registrieren
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="mt-auto border-t py-6 px-6">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>© {new Date().getFullYear()} OpenVerein</span>
                    <span>Open Source · Made with ♥</span>
                </div>
            </footer>
        </div>
    );
}
