export type DashboardMemberType = "bewerber" | "mitglied" | "fördermitglied" | "kontakt" | "ausgeschieden";

export type DashboardMember = {
    _id: string;
    vorname: string;
    nachname: string;
    geburtsdatum?: string;
    beitrittsdatum: string;
    typ: DashboardMemberType;
    userId?: string;
    rollen: string[];
    beitragsEinzug?: "r" | "l" | "b" | "p";
    beitragsSatzId?: string;
};

export type DashboardRole = {
    _id: string;
    name: string;
};

export type DashboardKasse = {
    _id: string;
    name: string;
    typ: "barkasse" | "bankkonto" | "kreditkarte" | "paypal" | "sonstiges";
    waehrung: string;
    aktuellerBestand: number;
    aktiv: boolean;
};

export type DashboardBuchung = {
    _id: string;
    kasseId: string;
    betrag: number;
    datum: string;
    zweck: string;
};

export type DashboardBeitragssatz = {
    _id: string;
    betrag: number;
    waehrung: string;
};

export type MemberStatSummary = {
    totalMembers: number;
    activeMembers: number;
    passiveMembers: number;
    formerMembers: number;
    averageAge: number | null;
    linkedMembers: number;
    contacts: number;
};

export type MemberStatGroup = {
    key: string;
    label: string;
    summary: MemberStatSummary;
};

export type FinanceChartPoint = {
    monthKey: string;
    label: string;
    income: number;
    expense: number;
    net: number;
};

export type FinanceAccountSnapshot = {
    label: string;
    name: string;
    balance: number;
    currency: string;
} | null;

export type FinanceOverviewSummary = {
    currency: string;
    openReceivables: number;
    upcomingPayments: number;
    saldo: number;
    contributionAccount: FinanceAccountSnapshot;
    paymentAccount: FinanceAccountSnapshot;
    chart: FinanceChartPoint[];
};

export type CelebrationRelation = "past" | "today" | "upcoming";

export type CelebrationItem = {
    id: string;
    name: string;
    subtitle: string;
    dateLabel: string;
    relation: CelebrationRelation;
    href: string;
};

export type CelebrationPreview = {
    birthdays: CelebrationItem[];
    anniversaries: CelebrationItem[];
};

function isActiveMember(member: DashboardMember) {
    return member.typ === "mitglied";
}

function isPassiveMember(member: DashboardMember) {
    return member.typ === "fördermitglied";
}

function isFormerMember(member: DashboardMember) {
    return member.typ === "ausgeschieden";
}

function isCurrentMember(member: DashboardMember) {
    return isActiveMember(member) || isPassiveMember(member);
}

function isCountedMember(member: DashboardMember) {
    return isActiveMember(member) || isPassiveMember(member) || isFormerMember(member);
}

function startOfTodayUtc(reference: Date) {
    return new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
}

function parseIsoDate(value?: string) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeUtcDate(year: number, monthIndex: number, day: number) {
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay)));
}

function getAgeOnDate(birthDate: Date, referenceDate: Date) {
    let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
    const hasBirthdayPassed =
        referenceDate.getUTCMonth() > birthDate.getUTCMonth() || (referenceDate.getUTCMonth() === birthDate.getUTCMonth() && referenceDate.getUTCDate() >= birthDate.getUTCDate());

    if (!hasBirthdayPassed) {
        age -= 1;
    }

    return age;
}

function buildMemberStatSummary(members: DashboardMember[]): MemberStatSummary {
    const countedMembers = members.filter(isCountedMember);
    const averageAgeValues = countedMembers
        .filter((member) => Boolean(member.geburtsdatum))
        .map((member) => parseIsoDate(member.geburtsdatum))
        .filter((date): date is Date => date !== null)
        .map((birthDate) => getAgeOnDate(birthDate, new Date()))
        .filter((age) => age >= 0);

    const averageAge = averageAgeValues.length > 0 ? Math.round(averageAgeValues.reduce((sum, age) => sum + age, 0) / averageAgeValues.length) : null;

    return {
        totalMembers: countedMembers.length,
        activeMembers: members.filter(isActiveMember).length,
        passiveMembers: members.filter(isPassiveMember).length,
        formerMembers: members.filter(isFormerMember).length,
        averageAge,
        linkedMembers: countedMembers.filter((member) => Boolean(member.userId)).length,
        contacts: members.filter((member) => member.typ === "kontakt").length,
    };
}

export function buildMemberStatGroups(members: DashboardMember[], roles: DashboardRole[]): MemberStatGroup[] {
    const groups: MemberStatGroup[] = [
        {
            key: "all",
            label: "Gesamt",
            summary: buildMemberStatSummary(members),
        },
    ];

    for (const role of roles) {
        const scopedMembers = members.filter((member) => member.rollen.includes(role._id));
        const summary = buildMemberStatSummary(scopedMembers);
        if (summary.totalMembers === 0 && summary.contacts === 0) {
            continue;
        }

        groups.push({
            key: role._id,
            label: role.name,
            summary,
        });
    }

    return groups;
}

function scoreContributionAccount(kasse: DashboardKasse) {
    const lowerName = kasse.name.toLowerCase();
    let score = 0;

    if (kasse.typ === "bankkonto") {
        score += 5;
    }
    if (lowerName.includes("beitrag")) {
        score += 4;
    }
    if (lowerName.includes("haupt")) {
        score += 2;
    }
    if (lowerName.includes("konto")) {
        score += 1;
    }

    return score;
}

function scorePaymentAccount(kasse: DashboardKasse) {
    const lowerName = kasse.name.toLowerCase();
    let score = 0;

    if (kasse.typ === "paypal") {
        score += 6;
    }
    if (kasse.typ === "kreditkarte") {
        score += 4;
    }
    if (lowerName.includes("paypal") || lowerName.includes("payment") || lowerName.includes("stripe") || lowerName.includes("sumup")) {
        score += 3;
    }

    return score;
}

function pickBestAccount(kassen: DashboardKasse[], scorer: (kasse: DashboardKasse) => number, label: string): FinanceAccountSnapshot {
    const ranked = kassen
        .map((kasse) => ({ kasse, score: scorer(kasse) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || a.kasse.name.localeCompare(b.kasse.name, "de"));

    if (ranked.length === 0) {
        return null;
    }

    return {
        label,
        name: ranked[0].kasse.name,
        balance: ranked[0].kasse.aktuellerBestand,
        currency: ranked[0].kasse.waehrung,
    };
}

export function buildFinanceOverviewSummary(args: {
    members: DashboardMember[];
    beitragssaetze: DashboardBeitragssatz[];
    kassen: DashboardKasse[];
    buchungen: DashboardBuchung[];
    fallbackCurrency?: string;
}): FinanceOverviewSummary {
    const beitragssaetzeById = new Map(args.beitragssaetze.map((satz) => [satz._id, satz]));
    const payableMembers = args.members.filter(isCurrentMember);

    const openReceivables = payableMembers.reduce((sum, member) => {
        if (member.beitragsEinzug !== "r" || !member.beitragsSatzId) {
            return sum;
        }

        return sum + (beitragssaetzeById.get(member.beitragsSatzId)?.betrag ?? 0);
    }, 0);

    const upcomingPayments = payableMembers.reduce((sum, member) => {
        if (!member.beitragsSatzId || !member.beitragsEinzug || member.beitragsEinzug === "r") {
            return sum;
        }

        return sum + (beitragssaetzeById.get(member.beitragsSatzId)?.betrag ?? 0);
    }, 0);

    const currency = args.kassen[0]?.waehrung ?? args.beitragssaetze[0]?.waehrung ?? args.fallbackCurrency ?? "EUR";
    const saldo = args.kassen.reduce((sum, kasse) => sum + kasse.aktuellerBestand, 0);

    const monthFormatter = new Intl.DateTimeFormat("de-DE", {
        month: "short",
        year: "2-digit",
    });

    const now = new Date();
    const chartMap = new Map<string, FinanceChartPoint>();
    for (let offset = 11; offset >= 0; offset -= 1) {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        chartMap.set(monthKey, {
            monthKey,
            label: monthFormatter.format(date),
            income: 0,
            expense: 0,
            net: 0,
        });
    }

    for (const buchung of args.buchungen) {
        const date = parseIsoDate(buchung.datum);
        if (!date) {
            continue;
        }

        const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
        const current = chartMap.get(monthKey);
        if (!current) {
            continue;
        }

        if (buchung.betrag >= 0) {
            current.income += buchung.betrag;
        } else {
            current.expense += Math.abs(buchung.betrag);
        }
        current.net += buchung.betrag;
    }

    return {
        currency,
        openReceivables,
        upcomingPayments,
        saldo,
        contributionAccount: pickBestAccount(args.kassen, scoreContributionAccount, "Beitragskonto"),
        paymentAccount: pickBestAccount(args.kassen, scorePaymentAccount, "Payment"),
        chart: [...chartMap.values()],
    };
}

type CelebrationCandidate = {
    id: string;
    name: string;
    subtitle: string;
    eventDate: Date;
    relation: CelebrationRelation;
    href: string;
    monthDayKey: string;
};

function buildTimelinePreview(candidates: CelebrationCandidate[]) {
    const uniqueCandidates = new Map<string, CelebrationCandidate>();
    for (const candidate of candidates) {
        if (!uniqueCandidates.has(candidate.monthDayKey)) {
            uniqueCandidates.set(candidate.monthDayKey, candidate);
        }
    }

    const deduped = [...uniqueCandidates.values()].sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime() || a.name.localeCompare(b.name, "de"));
    const past = [...deduped].filter((item) => item.relation === "past").at(-1);
    const today = deduped.find((item) => item.relation === "today");
    const upcoming = deduped.find((item) => item.relation === "upcoming");

    return [past, today, upcoming]
        .filter((item): item is CelebrationCandidate => Boolean(item))
        .map((item) => ({
            id: item.id,
            name: item.name,
            subtitle: item.subtitle,
            relation: item.relation,
            href: item.href,
            dateLabel: new Intl.DateTimeFormat("de-DE", {
                day: "2-digit",
                month: "long",
            }).format(item.eventDate),
        }));
}

export function buildCelebrationPreview(members: DashboardMember[], vereinSlug: string, referenceDate = new Date()): CelebrationPreview {
    const today = startOfTodayUtc(referenceDate);

    const birthdayCandidates: CelebrationCandidate[] = [];
    const anniversaryCandidates: CelebrationCandidate[] = [];

    for (const member of members.filter(isCurrentMember)) {
        const name = `${member.vorname} ${member.nachname}`.trim();
        const href = `/verein/${vereinSlug}/mitglieder/${member._id}`;

        const birthDate = parseIsoDate(member.geburtsdatum);
        if (birthDate) {
            const eventDate = safeUtcDate(today.getUTCFullYear(), birthDate.getUTCMonth(), birthDate.getUTCDate());
            const age = getAgeOnDate(birthDate, eventDate);
            const monthDayKey = `${String(eventDate.getUTCMonth() + 1).padStart(2, "0")}-${String(eventDate.getUTCDate()).padStart(2, "0")}`;
            birthdayCandidates.push({
                id: member._id,
                name,
                subtitle: age > 0 ? `${age}. Geburtstag` : "Geburtstag",
                eventDate,
                relation: eventDate.getTime() < today.getTime() ? "past" : eventDate.getTime() > today.getTime() ? "upcoming" : "today",
                href,
                monthDayKey,
            });
        }

        const joinDate = parseIsoDate(member.beitrittsdatum);
        if (joinDate) {
            const eventDate = safeUtcDate(today.getUTCFullYear(), joinDate.getUTCMonth(), joinDate.getUTCDate());
            const years = eventDate.getUTCFullYear() - joinDate.getUTCFullYear();
            if (years > 0) {
                const monthDayKey = `${String(eventDate.getUTCMonth() + 1).padStart(2, "0")}-${String(eventDate.getUTCDate()).padStart(2, "0")}`;
                anniversaryCandidates.push({
                    id: member._id,
                    name,
                    subtitle: `${years} Jahre im Verein`,
                    eventDate,
                    relation: eventDate.getTime() < today.getTime() ? "past" : eventDate.getTime() > today.getTime() ? "upcoming" : "today",
                    href,
                    monthDayKey,
                });
            }
        }
    }

    return {
        birthdays: buildTimelinePreview(birthdayCandidates),
        anniversaries: buildTimelinePreview(anniversaryCandidates),
    };
}
