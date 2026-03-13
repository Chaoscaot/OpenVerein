import { Button, Text } from "@react-email/components";
import OpenVereinLayout from "./layout";

export const VerifyEmail = ({ link }: { link: string }) => (
  <OpenVereinLayout>
    <Text className="text-2xl font-bold">Bestätige deine E-Mail!</Text>
    <Text>
      Willkommen bei OpenVerein! Bitte bestätige deine E-Mail-Adresse, indem du
      auf den Button unten klickst.
    </Text>
    <Button href={link} className="bg-blue-500 text-white px-4 py-2 rounded">
      E-Mail bestätigen
    </Button>
    <Text>
      Wenn du kein Konto bei OpenVerein erstellt hast, kannst du diese E-Mail
      einfach ignorieren.
    </Text>
  </OpenVereinLayout>
);

VerifyEmail.PreviewProps = {
  link: "https://example.com",
};

export const ResetEmail = ({ link }: { link: string }) => (
  <OpenVereinLayout>
    <Text className="text-2xl font-bold">Passwort zurücksetzen</Text>
    <Text>
      Du hast eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke
      auf den Button unten, um dein Passwort zurückzusetzen.
    </Text>
    <Button href={link} className="bg-blue-500 text-white px-4 py-2 rounded">
      Passwort zurücksetzen
    </Button>
  </OpenVereinLayout>
);

export const MitgliedLinkEmail = ({
  link,
  vereinName,
  mitgliedName,
}: {
  link: string;
  vereinName: string;
  mitgliedName: string;
}) => (
  <OpenVereinLayout>
    <Text className="text-2xl font-bold">Mitgliedschaft verknüpfen</Text>
    <Text>
      Du wurdest eingeladen, dein OpenVerein-Konto mit der Mitgliedschaft{" "}
      <strong>{mitgliedName}</strong> im Verein <strong>{vereinName}</strong> zu
      verknüpfen.
    </Text>
    <Button href={link} className="bg-blue-500 text-white px-4 py-2 rounded">
      Jetzt verknüpfen
    </Button>
    <Text>
      Wenn du diese Einladung nicht erwartest, kannst du diese E-Mail
      ignorieren.
    </Text>
  </OpenVereinLayout>
);

export const ListenMailEmail = ({
  vereinName,
  subject,
  body,
  listNames,
}: {
  vereinName: string;
  subject: string;
  body: string;
  listNames: string[];
}) => {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <OpenVereinLayout>
      <Text className="text-2xl font-bold">{subject}</Text>
      <Text>
        Diese Nachricht wurde über OpenVerein für den Verein {vereinName}{" "}
        versendet.
      </Text>
      {listNames.length > 0 ? (
        <>
          <Text className="font-bold">Empfängerlisten</Text>
          <Text>{listNames.join(", ")}</Text>
        </>
      ) : null}
      {paragraphs.map((paragraph, index) => (
        <Text key={index}>{paragraph}</Text>
      ))}
    </OpenVereinLayout>
  );
};
