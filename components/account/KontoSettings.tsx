"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import {
  useStoredImageUrl,
  getStoredImageFileId,
  toStoredImageRef,
} from "@/hooks/use-stored-image-url";
import { authClient } from "@/lib/auth-client";
import { useMutation } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Trash, Upload01Icon } from "@hugeicons/core-free-icons";

const ACCOUNT_PREFERENCES_KEY = "openverein.account.preferences";

type StoredPreferences = {
  browserNotificationsEnabled: boolean;
};

type AuthSession = {
  id: string;
  token: string;
  createdAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const preferenceListeners = new Set<() => void>();

function subscribeToPreferences(listener: () => void) {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

function getStoredPreferences(): StoredPreferences {
  if (typeof window === "undefined") {
    return {
      browserNotificationsEnabled: false,
    };
  }

  try {
    const rawValue = window.localStorage.getItem(ACCOUNT_PREFERENCES_KEY);
    if (!rawValue) {
      return {
        browserNotificationsEnabled: false,
      };
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredPreferences>;
    return {
      browserNotificationsEnabled: Boolean(parsed.browserNotificationsEnabled),
    };
  } catch {
    return {
      browserNotificationsEnabled: false,
    };
  }
}

function setStoredPreferences(preferences: StoredPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    ACCOUNT_PREFERENCES_KEY,
    JSON.stringify(preferences),
  );
  preferenceListeners.forEach((listener) => listener());
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function describeSession(session: AuthSession) {
  if (!session.userAgent) {
    return "Unbekanntes Gerät";
  }

  const userAgent = session.userAgent;

  if (userAgent.includes("Mobile")) {
    return "Mobiler Browser";
  }

  if (userAgent.includes("Firefox")) {
    return "Firefox";
  }

  if (userAgent.includes("Edg")) {
    return "Microsoft Edge";
  }

  if (userAgent.includes("Chrome")) {
    return "Google Chrome";
  }

  if (userAgent.includes("Safari")) {
    return "Safari";
  }

  return userAgent;
}

export function KontoSettings() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: sessionData, isPending } = authClient.useSession();
  const deleteFile = useMutation(api.files.deleteFile);
  const uploadFile = useUploadFile(api.files);

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [imageDraft, setImageDraft] = useState<string | null>(null);
  const [newEmailDraft, setNewEmailDraft] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [
    revokeOtherSessionsOnPasswordChange,
    setRevokeOtherSessionsOnPasswordChange,
  ] = useState(true);
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [resetPasswordSending, setResetPasswordSending] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [revokeAllOtherSessionsLoading, setRevokeAllOtherSessionsLoading] =
    useState(false);
  const [revokingSessionToken, setRevokingSessionToken] = useState<
    string | null
  >(null);
  const [avatarFileToDelete, setAvatarFileToDelete] = useState<string | null>(
    null,
  );
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const browserNotificationsEnabled = useSyncExternalStore(
    subscribeToPreferences,
    () => getStoredPreferences().browserNotificationsEnabled,
    () => false,
  );

  const currentName = nameDraft ?? sessionData?.user.name ?? "";
  const currentImage = imageDraft ?? sessionData?.user.image ?? "";
  const currentImageUrl = useStoredImageUrl(currentImage);
  const currentEmail = sessionData?.user.email ?? "";
  const currentNewEmail = newEmailDraft ?? currentEmail;

  const initials = useMemo(() => {
    const fallback = sessionData?.user.email ?? "OV";
    const source = sessionData?.user.name || fallback;
    return source
      .split(" ")
      .map((part) => part[0] ?? "")
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [sessionData?.user.email, sessionData?.user.name]);

  const currentSessionId = sessionData?.session.id ?? null;
  const currentSessionToken = sessionData?.session.token ?? null;
  const otherSessions = sessions.filter(
    (entry) => entry.token !== currentSessionToken,
  );

  async function loadSessions() {
    setSessionsLoading(true);
    const { data, error } = await authClient.listSessions();
    if (error) {
      toast.error(
        error.message ?? "Aktive Sitzungen konnten nicht geladen werden.",
      );
      setSessionsLoading(false);
      return;
    }

    setSessions((data ?? []) as AuthSession[]);
    setSessionsLoading(false);
  }

  useEffect(() => {
    if (!currentSessionId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await authClient.listSessions();
      if (cancelled) {
        return;
      }

      if (error) {
        toast.error(
          error.message ?? "Aktive Sitzungen konnten nicht geladen werden.",
        );
        setSessions([]);
        setSessionsLoading(false);
        return;
      }

      setSessions((data ?? []) as AuthSession[]);
      setSessionsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId]);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);

    const trimmedName = currentName.trim();
    if (!trimmedName) {
      setProfileError("Bitte gib einen Namen an.");
      return;
    }

    setProfileSaving(true);
    const { error } = await authClient.updateUser({
      name: trimmedName,
      image: currentImage.trim() || null,
    });

    if (error) {
      setProfileError(
        error.message ?? "Profil konnte nicht aktualisiert werden.",
      );
      setProfileSaving(false);
      return;
    }

    if (avatarFileToDelete) {
      await deleteFile({ fileId: avatarFileToDelete });
    }

    toast.success("Dein Profil wurde aktualisiert.");
    setAvatarFileToDelete(null);
    setNameDraft(null);
    setImageDraft(null);
    router.refresh();
    setProfileSaving(false);
  }

  async function handleAvatarUpload(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    event.target.value = "";

    if (!file.type.startsWith("image/")) {
      toast.error("Bitte wähle eine Bilddatei aus.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Die Datei ist zu groß. Maximale Größe: 5MB.");
      return;
    }

    const persistedFileId = getStoredImageFileId(sessionData?.user.image);
    const previousDraftFileId = getStoredImageFileId(currentImage);

    setAvatarUploading(true);
    try {
      const fileId = await uploadFile(file);

      if (
        previousDraftFileId &&
        previousDraftFileId !== persistedFileId &&
        previousDraftFileId !== fileId
      ) {
        await deleteFile({ fileId: previousDraftFileId });
      }

      if (persistedFileId && persistedFileId !== fileId) {
        setAvatarFileToDelete(persistedFileId);
      }

      setImageDraft(toStoredImageRef(fileId));
      toast.success(
        "Avatar hochgeladen. Speichere dein Profil, um die Änderung zu übernehmen.",
      );
    } catch (error) {
      console.error(error);
      toast.error("Der Avatar konnte nicht hochgeladen werden.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleAvatarRemove() {
    const persistedFileId = getStoredImageFileId(sessionData?.user.image);
    const currentDraftFileId = getStoredImageFileId(currentImage);

    if (currentDraftFileId && currentDraftFileId !== persistedFileId) {
      await deleteFile({ fileId: currentDraftFileId });
    }

    if (persistedFileId) {
      setAvatarFileToDelete(persistedFileId);
    }

    setImageDraft("");
    toast.success("Avatar wird beim nächsten Speichern entfernt.");
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);

    const trimmedEmail = currentNewEmail.trim().toLowerCase();
    if (!trimmedEmail) {
      setEmailError("Bitte gib eine E-Mail-Adresse an.");
      return;
    }

    if (trimmedEmail === currentEmail.toLowerCase()) {
      setEmailError(
        "Die neue E-Mail-Adresse entspricht bereits der aktuellen.",
      );
      return;
    }

    setEmailSaving(true);
    const { error } = await authClient.changeEmail({
      newEmail: trimmedEmail,
      callbackURL: "/konto",
    });

    if (error) {
      setEmailError(
        error.message ?? "Die E-Mail-Adresse konnte nicht geändert werden.",
      );
      setEmailSaving(false);
      return;
    }

    toast.success(
      "Bitte bestätige die neue E-Mail-Adresse über den Link in deinem Postfach.",
    );
    setNewEmailDraft(trimmedEmail);
    setEmailSaving(false);
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Bitte gib dein aktuelles Passwort an.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(
        "Das neue Passwort muss mindestens 8 Zeichen lang sein.",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Die neue Passwortbestätigung stimmt nicht überein.");
      return;
    }

    setPasswordSaving(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: revokeOtherSessionsOnPasswordChange,
    });

    if (error) {
      setPasswordError(
        error.message ?? "Das Passwort konnte nicht geändert werden.",
      );
      setPasswordSaving(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Dein Passwort wurde geändert.");
    await loadSessions();
    setPasswordSaving(false);
  }

  async function handleSendResetPassword() {
    if (!currentEmail) {
      toast.error("Es ist keine E-Mail-Adresse für dein Konto hinterlegt.");
      return;
    }

    setResetPasswordSending(true);
    const { error } = await authClient.requestPasswordReset({
      email: currentEmail,
      redirectTo: "/reset-password",
    });

    if (error) {
      toast.error(
        error.message ?? "Der Reset-Link konnte nicht versendet werden.",
      );
      setResetPasswordSending(false);
      return;
    }

    toast.success("Ein Link zum Zurücksetzen des Passworts wurde versendet.");
    setResetPasswordSending(false);
  }

  async function handleToggleBrowserNotifications(nextValue: boolean) {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Dieser Browser unterstützt keine Benachrichtigungen.");
      return;
    }

    if (!nextValue) {
      setStoredPreferences({
        browserNotificationsEnabled: false,
      });
      toast.success("Browser-Benachrichtigungen wurden lokal deaktiviert.");
      return;
    }

    if (Notification.permission === "granted") {
      setStoredPreferences({
        browserNotificationsEnabled: true,
      });
      toast.success("Browser-Benachrichtigungen sind aktiviert.");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStoredPreferences({
        browserNotificationsEnabled: false,
      });
      toast.error("Der Browser hat Benachrichtigungen nicht erlaubt.");
      return;
    }

    setStoredPreferences({
      browserNotificationsEnabled: true,
    });
    toast.success("Browser-Benachrichtigungen sind aktiviert.");
  }

  async function handleRevokeOtherSessions() {
    setRevokeAllOtherSessionsLoading(true);
    const { error } = await authClient.revokeOtherSessions();

    if (error) {
      toast.error(
        error.message ?? "Andere Sitzungen konnten nicht beendet werden.",
      );
      setRevokeAllOtherSessionsLoading(false);
      return;
    }

    toast.success("Alle anderen Sitzungen wurden abgemeldet.");
    await loadSessions();
    setRevokeAllOtherSessionsLoading(false);
  }

  async function handleRevokeSingleSession(token: string) {
    setRevokingSessionToken(token);
    const { error } = await authClient.revokeSession({
      token,
    });

    if (error) {
      toast.error(error.message ?? "Die Sitzung konnte nicht beendet werden.");
      setRevokingSessionToken(null);
      return;
    }

    toast.success("Die Sitzung wurde beendet.");
    await loadSessions();
    setRevokingSessionToken(null);
  }

  if (isPending || !sessionData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 bg-gradient-to-br from-primary/8 via-background to-background">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-1 ring-border">
              <AvatarImage src={currentImageUrl} alt={sessionData.user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold tracking-tight">
                {sessionData.user.name}
              </h2>
              <p className="text-muted-foreground">{sessionData.user.email}</p>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    sessionData.user.emailVerified ? "default" : "outline"
                  }
                >
                  {sessionData.user.emailVerified
                    ? "E-Mail bestätigt"
                    : "Bestätigung ausstehend"}
                </Badge>
                <Badge variant="outline">
                  {sessions.length} aktive Sitzungen
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Konto-Einstellungen, Sicherheit und App-Präferenzen an einem Ort.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>
              Pflege deinen angezeigten Namen und das Profilbild deiner
              Anmeldung.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleProfileSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="account-name">Anzeigename</FieldLabel>
                  <Input
                    id="account-name"
                    value={currentName}
                    onChange={(event) => setNameDraft(event.target.value)}
                    autoComplete="name"
                  />
                </Field>
                <Field>
                  <FieldLabel>Profilbild</FieldLabel>
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar className="h-20 w-20 ring-1 ring-border">
                      <AvatarImage
                        src={currentImageUrl}
                        alt={sessionData.user.name}
                      />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={avatarUploading}
                        onClick={() =>
                          document
                            .getElementById("account-avatar-upload")
                            ?.click()
                        }
                      >
                        {avatarUploading ? (
                          <Spinner />
                        ) : (
                          <HugeiconsIcon icon={Upload01Icon} />
                        )}
                        Avatar hochladen
                      </Button>
                      {currentImage ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAvatarRemove}
                        >
                          <HugeiconsIcon icon={Trash} />
                          Entfernen
                        </Button>
                      ) : null}
                      <input
                        id="account-avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                    </div>
                  </div>
                  <FieldDescription>
                    PNG, JPG oder WebP bis 5MB. Die Änderung wird mit dem
                    Speichern des Profils übernommen.
                  </FieldDescription>
                </Field>
                {profileError ? (
                  <FieldError errors={[{ message: profileError }]} />
                ) : null}
              </FieldGroup>
              <Button type="submit" disabled={profileSaving}>
                {profileSaving ? <Spinner /> : null}
                Profil speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>App-Einstellungen</CardTitle>
            <CardDescription>
              Lege fest, wie OpenVerein fur dich dargestellt wird und mit dem
              Browser interagiert.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel>Farbschema</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant={theme === "light" ? "default" : "outline"}
                    onClick={() => setTheme("light")}
                  >
                    Hell
                  </Button>
                  <Button
                    type="button"
                    variant={theme === "dark" ? "default" : "outline"}
                    onClick={() => setTheme("dark")}
                  >
                    Dunkel
                  </Button>
                  <Button
                    type="button"
                    variant={theme === "system" ? "default" : "outline"}
                    onClick={() => setTheme("system")}
                  >
                    System
                  </Button>
                </div>
              </Field>
              <Field
                orientation="horizontal"
                className="items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <FieldLabel>Browser-Benachrichtigungen</FieldLabel>
                  <FieldDescription>
                    Aktiviert lokale Browser-Benachrichtigungen, sofern dein
                    Browser dies unterstutzt.
                  </FieldDescription>
                  {typeof window !== "undefined" && "Notification" in window ? (
                    <p className="text-muted-foreground text-xs">
                      Browser-Status: {Notification.permission}
                    </p>
                  ) : null}
                </div>
                <Switch
                  checked={browserNotificationsEnabled}
                  onCheckedChange={handleToggleBrowserNotifications}
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>E-Mail-Adresse</CardTitle>
            <CardDescription>
              Anderungen an der E-Mail mussen bestatigt werden, bevor sie aktiv
              werden.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleEmailSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="current-email">
                    Aktuelle E-Mail
                  </FieldLabel>
                  <Input
                    id="current-email"
                    value={currentEmail}
                    readOnly
                    disabled
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-email">Neue E-Mail</FieldLabel>
                  <Input
                    id="new-email"
                    type="email"
                    value={currentNewEmail}
                    onChange={(event) => setNewEmailDraft(event.target.value)}
                    autoComplete="email"
                  />
                </Field>
                {emailError ? (
                  <FieldError errors={[{ message: emailError }]} />
                ) : null}
              </FieldGroup>
              <Button type="submit" disabled={emailSaving}>
                {emailSaving ? <Spinner /> : null}
                E-Mail aktualisieren
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sicherheit</CardTitle>
            <CardDescription>
              Passwort andern und bei Bedarf einen Reset-Link anfordern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handlePasswordSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="current-password">
                    Aktuelles Passwort
                  </FieldLabel>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="new-password">Neues Passwort</FieldLabel>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Neues Passwort bestatigen
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                  />
                </Field>
                <Field
                  orientation="horizontal"
                  className="items-start justify-between gap-4"
                >
                  <div className="space-y-1">
                    <FieldLabel>Andere Sitzungen abmelden</FieldLabel>
                    <FieldDescription>
                      Beendet nach dem Passwortwechsel alle anderen aktiven
                      Anmeldungen.
                    </FieldDescription>
                  </div>
                  <Switch
                    checked={revokeOtherSessionsOnPasswordChange}
                    onCheckedChange={setRevokeOtherSessionsOnPasswordChange}
                  />
                </Field>
                {passwordError ? (
                  <FieldError errors={[{ message: passwordError }]} />
                ) : null}
              </FieldGroup>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? <Spinner /> : null}
                  Passwort andern
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={resetPasswordSending}
                  onClick={handleSendResetPassword}
                >
                  {resetPasswordSending ? <Spinner /> : null}
                  Reset-Link senden
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aktive Sitzungen</CardTitle>
          <CardDescription>
            Sieh nach, auf welchen Geraten dein Konto aktuell angemeldet ist.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <div className="space-y-1">
              <p className="font-medium">Andere Gerate abmelden</p>
              <p className="text-muted-foreground text-sm">
                Beendet alle Sitzungen ausser der gerade verwendeten.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={
                revokeAllOtherSessionsLoading || otherSessions.length === 0
              }
              onClick={handleRevokeOtherSessions}
            >
              {revokeAllOtherSessionsLoading ? <Spinner /> : null}
              Andere Sitzungen beenden
            </Button>
          </div>

          {sessionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="size-5" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {sessions.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Es wurden keine aktiven Sitzungen gefunden.
                </div>
              ) : (
                sessions.map((session, index) => {
                  const isCurrentSession =
                    session.token === currentSessionToken;

                  return (
                    <div key={session.id}>
                      {index > 0 ? <Separator /> : null}
                      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {describeSession(session)}
                            </p>
                            {isCurrentSession ? (
                              <Badge variant="default">Diese Sitzung</Badge>
                            ) : null}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            Aktiv seit {formatDate(session.createdAt)} • Gultig
                            bis {formatDate(session.expiresAt)}
                          </p>
                          <p className="text-muted-foreground text-sm">
                            IP-Adresse: {session.ipAddress ?? "Nicht verfugbar"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={
                            isCurrentSession ||
                            revokingSessionToken === session.token
                          }
                          onClick={() =>
                            handleRevokeSingleSession(session.token)
                          }
                        >
                          {revokingSessionToken === session.token ? (
                            <Spinner />
                          ) : null}
                          Sitzung beenden
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="text-muted-foreground text-xs">
          Wenn du ein unbekanntes Gerat siehst, andert dein Passwort und melde
          andere Sitzungen sofort ab.
        </CardFooter>
      </Card>
    </div>
  );
}
