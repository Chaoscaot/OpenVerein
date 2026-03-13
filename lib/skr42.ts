export type BuchhaltungKontenrahmen = "skr42";

export type BuchhaltungKontoTyp = "asset" | "liability" | "income" | "expense";

export type BuchhaltungBereich = "bilanz" | "ideeller_bereich" | "vermoegensverwaltung" | "zweckbetrieb" | "wirtschaftlicher_geschaeftsbetrieb";

export type KasseTyp = "barkasse" | "bankkonto" | "kreditkarte" | "paypal" | "sonstiges";

export type Skr42KontoVorlage = {
    nummer: string;
    name: string;
    typ: BuchhaltungKontoTyp;
    bereich: BuchhaltungBereich;
    beschreibung?: string;
    isLiquiditaetskonto?: boolean;
    standardKasseTypen?: KasseTyp[];
    sortOrder: number;
};

export const BUCHHALTUNG_BEREICH_LABELS: Record<BuchhaltungBereich, string> = {
    bilanz: "Bilanzkonten",
    ideeller_bereich: "Ideeller Bereich",
    vermoegensverwaltung: "Vermögensverwaltung",
    zweckbetrieb: "Zweckbetrieb",
    wirtschaftlicher_geschaeftsbetrieb: "Wirtschaftlicher Geschäftsbetrieb",
};

export const BUCHHALTUNG_KONTO_TYP_LABELS: Record<BuchhaltungKontoTyp, string> = {
    asset: "Aktivkonto",
    liability: "Passivkonto",
    income: "Ertragskonto",
    expense: "Aufwandskonto",
};

export const SKR42_BASE_ACCOUNTS: Skr42KontoVorlage[] = [
    {
        nummer: "1200",
        name: "Bank",
        typ: "asset",
        bereich: "bilanz",
        beschreibung: "Standard-Liquiditätskonto für Bankkonten des Vereins",
        isLiquiditaetskonto: true,
        standardKasseTypen: ["bankkonto"],
        sortOrder: 10,
    },
    {
        nummer: "1210",
        name: "Zahlungsdienstleister / PayPal",
        typ: "asset",
        bereich: "bilanz",
        beschreibung: "Verrechnungskonto für PayPal und ähnliche Zahlungsdienste",
        isLiquiditaetskonto: true,
        standardKasseTypen: ["paypal"],
        sortOrder: 20,
    },
    {
        nummer: "1360",
        name: "Geldtransit / Kreditkartenabrechnung",
        typ: "asset",
        bereich: "bilanz",
        beschreibung: "Übergangskonto für Kreditkarte, Clearing oder sonstige Zahlungswege",
        isLiquiditaetskonto: true,
        standardKasseTypen: ["kreditkarte", "sonstiges"],
        sortOrder: 30,
    },
    {
        nummer: "1600",
        name: "Kasse",
        typ: "asset",
        bereich: "bilanz",
        beschreibung: "Barkassenbestand",
        isLiquiditaetskonto: true,
        standardKasseTypen: ["barkasse"],
        sortOrder: 40,
    },
    {
        nummer: "1800",
        name: "Forderungen",
        typ: "asset",
        bereich: "bilanz",
        beschreibung: "Offene Forderungen gegenüber Mitgliedern oder Dritten",
        sortOrder: 50,
    },
    {
        nummer: "3005",
        name: "Mitgliedsbeiträge",
        typ: "income",
        bereich: "ideeller_bereich",
        beschreibung: "Regelmäßige Beiträge der Mitglieder",
        sortOrder: 100,
    },
    {
        nummer: "3220",
        name: "Spenden",
        typ: "income",
        bereich: "ideeller_bereich",
        beschreibung: "Freiwillige Zuwendungen und Spenden",
        sortOrder: 110,
    },
    {
        nummer: "3400",
        name: "Zuschüsse",
        typ: "income",
        bereich: "ideeller_bereich",
        beschreibung: "Öffentliche oder private Fördermittel und Zuschüsse",
        sortOrder: 120,
    },
    {
        nummer: "3900",
        name: "Sonstige Erträge ideeller Bereich",
        typ: "income",
        bereich: "ideeller_bereich",
        sortOrder: 130,
    },
    {
        nummer: "4150",
        name: "Erträge Vermögensverwaltung",
        typ: "income",
        bereich: "vermoegensverwaltung",
        beschreibung: "Zinsen, Ausschüttungen oder ähnliche Vermögenserträge",
        sortOrder: 140,
    },
    {
        nummer: "4300",
        name: "Erlöse Zweckbetrieb",
        typ: "income",
        bereich: "zweckbetrieb",
        beschreibung: "Erträge aus satzungsmäßigem Zweckbetrieb",
        sortOrder: 150,
    },
    {
        nummer: "4980",
        name: "Sonstige Erträge Zweckbetrieb",
        typ: "income",
        bereich: "zweckbetrieb",
        sortOrder: 160,
    },
    {
        nummer: "5000",
        name: "Erlöse wirtschaftlicher Geschäftsbetrieb",
        typ: "income",
        bereich: "wirtschaftlicher_geschaeftsbetrieb",
        sortOrder: 170,
    },
    {
        nummer: "6000",
        name: "Aufwendungen ideeller Bereich",
        typ: "expense",
        bereich: "ideeller_bereich",
        beschreibung: "Allgemeine Aufwendungen im ideellen Bereich",
        sortOrder: 200,
    },
    {
        nummer: "6300",
        name: "Veranstaltungskosten",
        typ: "expense",
        bereich: "ideeller_bereich",
        beschreibung: "Kosten für Vereinsveranstaltungen und Aktionen",
        sortOrder: 210,
    },
    {
        nummer: "6500",
        name: "Büromaterial und Verwaltung",
        typ: "expense",
        bereich: "ideeller_bereich",
        sortOrder: 220,
    },
    {
        nummer: "6670",
        name: "Reisekosten",
        typ: "expense",
        bereich: "ideeller_bereich",
        sortOrder: 230,
    },
    {
        nummer: "6800",
        name: "Porto und Versand",
        typ: "expense",
        bereich: "ideeller_bereich",
        sortOrder: 240,
    },
    {
        nummer: "6810",
        name: "Telefon, Internet und IT",
        typ: "expense",
        bereich: "ideeller_bereich",
        sortOrder: 250,
    },
    {
        nummer: "6855",
        name: "Bankgebühren",
        typ: "expense",
        bereich: "ideeller_bereich",
        sortOrder: 260,
    },
    {
        nummer: "6900",
        name: "Versicherungen, Beiträge und Abgaben",
        typ: "expense",
        bereich: "ideeller_bereich",
        sortOrder: 270,
    },
    {
        nummer: "7100",
        name: "Aufwendungen Vermögensverwaltung",
        typ: "expense",
        bereich: "vermoegensverwaltung",
        sortOrder: 280,
    },
    {
        nummer: "7300",
        name: "Aufwendungen Zweckbetrieb",
        typ: "expense",
        bereich: "zweckbetrieb",
        sortOrder: 290,
    },
    {
        nummer: "7600",
        name: "Aufwendungen wirtschaftlicher Geschäftsbetrieb",
        typ: "expense",
        bereich: "wirtschaftlicher_geschaeftsbetrieb",
        sortOrder: 300,
    },
];

export function compareKontoNummern(a: string, b: string) {
    const parsedA = Number.parseInt(a, 10);
    const parsedB = Number.parseInt(b, 10);

    if (Number.isNaN(parsedA) || Number.isNaN(parsedB)) {
        return a.localeCompare(b, "de");
    }

    return parsedA - parsedB || a.localeCompare(b, "de");
}

export function getDefaultSkr42AccountNumberForKasseType(typ: KasseTyp) {
    return SKR42_BASE_ACCOUNTS.find((konto) => konto.standardKasseTypen?.includes(typ))?.nummer;
}
