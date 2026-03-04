import { Button, Text } from "@react-email/components";
import OpenVereinLayout from "./layout";

export const VerifyEmail = ({ link }: { link: string }) => (
    <OpenVereinLayout>
        <Text className="text-2xl font-bold">Bestätige deine E-Mail!</Text>
        <Text>Willkommen bei OpenVerein! Bitte bestätige deine E-Mail-Adresse, indem du auf den Button unten klickst.</Text>
        <Button href={link} className="bg-blue-500 text-white px-4 py-2 rounded">
            E-Mail bestätigen
        </Button>
        <Text>Wenn du kein Konto bei OpenVerein erstellt hast, kannst du diese E-Mail einfach ignorieren.</Text>
    </OpenVereinLayout>
);

VerifyEmail.PreviewProps = {
    link: "https://example.com",
};

export const ResetEmail = ({ link }: { link: string }) => (
    <OpenVereinLayout>
        <Text className="text-2xl font-bold">Passwort zurücksetzen</Text>
        <Text>Du hast eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf den Button unten, um dein Passwort zurückzusetzen.</Text>
        <Button href={link} className="bg-blue-500 text-white px-4 py-2 rounded">
            Passwort zurücksetzen
        </Button>
    </OpenVereinLayout>
);
