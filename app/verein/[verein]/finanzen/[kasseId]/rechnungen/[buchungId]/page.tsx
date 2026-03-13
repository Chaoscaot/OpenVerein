"use client";

import { useQuery, useMutation, useConvex } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import {
  berechnePositionssumme,
  decodeDokumentKommentar,
  DokumentPosition,
  encodeDokumentKommentar,
  FinanzDokumentTyp,
  generateZugferdEmbeddedPdf,
} from "@/lib/finance-documents";

export default function RechnungenPage() {
  const params = useParams();
  const router = useRouter();
  const vereinId = params.verein as Id<"verein">;
  const kasseId = params.kasseId as Id<"kasse">;
  const buchungId = params.buchungId as Id<"kassen_buchung">;

  const kasse = useQuery(api.finanzen.getKasse, { kasseId });
  const buchungen = useQuery(api.finanzen.getBuchungen, { kasseId });
  const rechnungen = useQuery(api.finanzen.getRechnungenByKasse, { kasseId });
  const mitglieder = useQuery(api.mitglieder.list, { vereinId });
  const verein = useQuery(api.verein.get, { id: vereinId });

  const convex = useConvex();
  const uploadFile = useUploadFile(api.files);
  const createRechnung = useMutation(api.finanzen.createRechnung);
  const updateRechnung = useMutation(api.finanzen.updateRechnung);
  const deleteRechnung = useMutation(api.finanzen.deleteRechnung);
  const deleteFile = useMutation(api.files.deleteFile);

  const [isRechnungHinzufuegenOpen, setIsRechnungHinzufuegenOpen] =
    useState(false);
  const [isRechnungErstellenOpen, setIsRechnungErstellenOpen] = useState(false);
  const [editingRechnungId, setEditingRechnungId] = useState<
    Id<"buchung_rechnung"> | undefined
  >(undefined);
  const [rechnungDatei, setRechnungDatei] = useState<File | null>(null);
  const [rechnungFormat, setRechnungFormat] = useState<"pdf" | "e-rechnung">(
    "pdf",
  );
  const [dokumentTyp, setDokumentTyp] = useState<FinanzDokumentTyp>("rechnung");
  const [rechnungWaehrung, setRechnungWaehrung] = useState("EUR");
  const [rechnungNummer, setRechnungNummer] = useState("");
  const [rechnungDatum, setRechnungDatum] = useState<Date | undefined>(
    new Date(),
  );
  const [rechnungEmpfaenger, setRechnungEmpfaenger] = useState("");
  const [rechnungKommentar, setRechnungKommentar] = useState("");
  const [itemisierung, setItemisierung] = useState<
    Array<{
      id: string;
      bezeichnung: string;
      menge: string;
      einzelpreis: string;
    }>
  >([]);

  const rechnungenByBuchung = useMemo(() => {
    const map = new Map<
      Id<"kassen_buchung">,
      (typeof rechnungen extends undefined
        ? never
        : NonNullable<typeof rechnungen>[number])[]
    >();
    if (!rechnungen) return map;

    for (const rechnung of rechnungen) {
      const existing = map.get(rechnung.buchungId) ?? [];
      existing.push(rechnung);
      map.set(rechnung.buchungId, existing);
    }
    return map;
  }, [rechnungen]);

  const selectedBuchung = buchungen?.find(
    (buchung) => buchung._id === buchungId,
  );
  const selectedBuchungRechnungen = rechnungenByBuchung.get(buchungId) ?? [];

  const resetRechnungForm = () => {
    setEditingRechnungId(undefined);
    setRechnungDatei(null);
    setRechnungFormat("pdf");
    setDokumentTyp("rechnung");
    setRechnungWaehrung(kasse?.waehrung ?? "EUR");
    setRechnungNummer("");
    setRechnungDatum(new Date());
    setRechnungEmpfaenger("");
    setRechnungKommentar("");
    setItemisierung([]);
  };

  const isRechnungDateiGueltig = (file: File, format: "pdf" | "e-rechnung") => {
    const lowerName = file.name.toLowerCase();
    if (format === "pdf") {
      return file.type === "application/pdf" || lowerName.endsWith(".pdf");
    }
    return (
      file.type === "application/pdf" ||
      file.type === "application/xml" ||
      file.type === "text/xml" ||
      lowerName.endsWith(".pdf") ||
      lowerName.endsWith(".xml")
    );
  };

  const handleCreateRechnungDialog = () => {
    resetRechnungForm();
    setIsRechnungHinzufuegenOpen(true);
  };

  const handleCreateDokumentDialog = () => {
    resetRechnungForm();
    setIsRechnungErstellenOpen(true);
  };

  const handleEditRechnungDialog = (
    rechnung: NonNullable<typeof rechnungen>[number],
  ) => {
    setEditingRechnungId(rechnung._id);
    setRechnungDatei(null);
    setRechnungFormat(rechnung.format);
    const decoded = decodeDokumentKommentar(rechnung.kommentar);
    setDokumentTyp(decoded.dokumentTyp);
    setRechnungWaehrung(rechnung.waehrung);
    setRechnungNummer(rechnung.rechnungsnummer ?? "");
    setRechnungDatum(
      rechnung.rechnungsdatum ? new Date(rechnung.rechnungsdatum) : undefined,
    );
    setRechnungEmpfaenger(rechnung.rechnungsempfaenger ?? "");
    setRechnungKommentar(decoded.kommentar);
    setItemisierung([]);
    setIsRechnungHinzufuegenOpen(true);
  };

  const parseItemisierung = (): {
    hasAny: boolean;
    positionen: DokumentPosition[];
    summe: number;
  } | null => {
    const rows = itemisierung.filter(
      (item) =>
        item.bezeichnung.trim() || item.menge.trim() || item.einzelpreis.trim(),
    );
    if (rows.length === 0) {
      return { hasAny: false, positionen: [], summe: 0 };
    }

    const positionen: DokumentPosition[] = [];
    for (const row of rows) {
      const bezeichnung = row.bezeichnung.trim();
      const menge = parseFloat(row.menge.replace(",", "."));
      const einzelpreis = parseFloat(row.einzelpreis.replace(",", "."));

      if (!bezeichnung) {
        toast.error("Jede Position benötigt eine Bezeichnung");
        return null;
      }
      if (isNaN(menge) || menge <= 0) {
        toast.error("Jede Position benötigt eine gültige Menge > 0");
        return null;
      }
      if (isNaN(einzelpreis) || einzelpreis < 0) {
        toast.error("Jede Position benötigt einen gültigen Einzelpreis");
        return null;
      }

      positionen.push({ bezeichnung, menge, einzelpreis });
    }

    const summe = berechnePositionssumme(positionen);
    return { hasAny: true, positionen, summe };
  };

  const handleOpenRechnungDatei = async (fileId: string) => {
    try {
      const url = await convex.query(api.files.getUrl, { fileId });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Rechnung konnte nicht geöffnet werden");
    }
  };

  const handleDownloadRechnungDatei = async (
    fileId: string,
    filename: string,
  ) => {
    try {
      const url = await convex.query(api.files.getUrl, { fileId });
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Datei konnte nicht heruntergeladen werden");
    }
  };

  const handleSaveRechnung = async () => {
    if (!selectedBuchung) {
      toast.error("Keine Buchung ausgewählt");
      return;
    }

    const buchungsBetrag = Math.abs(selectedBuchung.betrag);
    const parsedItemisierung =
      dokumentTyp === "rechnung"
        ? parseItemisierung()
        : { hasAny: false, positionen: [], summe: 0 };
    if (!parsedItemisierung) {
      return;
    }

    if (dokumentTyp === "rechnung" && parsedItemisierung.hasAny) {
      const positionsBetragCent = Math.round(parsedItemisierung.summe * 100);
      const buchungsBetragCent = Math.round(buchungsBetrag * 100);
      if (positionsBetragCent !== buchungsBetragCent) {
        toast.error("Itemisierung weicht vom gebuchten Betrag ab");
        return;
      }
    }

    if (!editingRechnungId && !rechnungDatei) {
      toast.error("Bitte eine Rechnungsdatei auswählen");
      return;
    }

    if (
      rechnungDatei &&
      !isRechnungDateiGueltig(rechnungDatei, rechnungFormat)
    ) {
      toast.error(
        rechnungFormat === "pdf"
          ? "Für PDF nur PDF-Dateien hochladen"
          : "Für E-Rechnung bitte PDF- oder XML-Datei hochladen",
      );
      return;
    }

    let uploadedFileId: string | undefined;
    let uploadedFileName: string | undefined;
    let uploadedFileType: string | undefined;

    try {
      if (rechnungDatei) {
        uploadedFileId = await uploadFile(rechnungDatei);
        uploadedFileName = rechnungDatei.name;
        uploadedFileType = rechnungDatei.type || undefined;
      }

      if (editingRechnungId) {
        await updateRechnung({
          rechnungId: editingRechnungId,
          fileId: uploadedFileId,
          dateiname: uploadedFileName,
          mimeType: uploadedFileType,
          format: rechnungFormat,
          rechnungsnummer: rechnungNummer || undefined,
          rechnungsdatum: rechnungDatum
            ? rechnungDatum.toISOString()
            : undefined,
          rechnungsempfaenger: rechnungEmpfaenger.trim() || undefined,
          betrag: buchungsBetrag,
          waehrung: rechnungWaehrung,
          kommentar: encodeDokumentKommentar(dokumentTyp, rechnungKommentar),
        });
        toast.success("Rechnung aktualisiert");
      } else {
        await createRechnung({
          buchungId,
          fileId: uploadedFileId!,
          dateiname: uploadedFileName || rechnungDatei?.name || "Rechnung",
          mimeType: uploadedFileType,
          format: rechnungFormat,
          rechnungsnummer: rechnungNummer || undefined,
          rechnungsdatum: rechnungDatum
            ? rechnungDatum.toISOString()
            : undefined,
          rechnungsempfaenger: rechnungEmpfaenger.trim() || undefined,
          betrag: buchungsBetrag,
          waehrung: rechnungWaehrung,
          kommentar: encodeDokumentKommentar(dokumentTyp, rechnungKommentar),
        });
        toast.success("Rechnung gespeichert");
        await handleOpenRechnungDatei(uploadedFileId!);
      }

      resetRechnungForm();
      setIsRechnungHinzufuegenOpen(false);
    } catch {
      if (uploadedFileId) {
        await deleteFile({ fileId: uploadedFileId });
      }
      toast.error("Fehler beim Speichern der Rechnung");
    }
  };

  const handleDeleteRechnung = async (rechnungId: Id<"buchung_rechnung">) => {
    if (!window.confirm("Rechnung wirklich löschen?")) return;
    try {
      await deleteRechnung({ rechnungId });
      toast.success("Rechnung gelöscht");
      if (editingRechnungId === rechnungId) {
        resetRechnungForm();
      }
    } catch {
      toast.error("Fehler beim Löschen der Rechnung");
    }
  };

  const handleGenerateDokumente = async () => {
    if (!selectedBuchung) {
      toast.error("Keine Buchung ausgewählt");
      return;
    }
    if (!verein) {
      toast.error("Verein konnte nicht geladen werden");
      return;
    }

    const buchungsBetrag = Math.abs(selectedBuchung.betrag);
    const parsedItemisierung =
      dokumentTyp === "rechnung"
        ? parseItemisierung()
        : { hasAny: false, positionen: [], summe: 0 };
    if (!parsedItemisierung) {
      return;
    }

    if (dokumentTyp === "rechnung" && parsedItemisierung.hasAny) {
      const positionsBetragCent = Math.round(parsedItemisierung.summe * 100);
      const buchungsBetragCent = Math.round(buchungsBetrag * 100);
      if (positionsBetragCent !== buchungsBetragCent) {
        toast.error("Itemisierung weicht vom gebuchten Betrag ab");
        return;
      }
    }

    const mitgliedName = selectedBuchung.mitgliedId
      ? (() => {
          const mitglied = (mitglieder ?? []).find(
            (m) => m._id === selectedBuchung.mitgliedId,
          );
          return mitglied
            ? `${mitglied.vorname} ${mitglied.nachname}`
            : undefined;
        })()
      : undefined;

    const payload = {
      dokumentTyp,
      vereinName: verein.name,
      vereinAddress: `${verein.address.street}, ${verein.address.postalCode} ${verein.address.city}, ${verein.address.country}`,
      mitgliedName,
      rechnungsempfaenger: rechnungEmpfaenger.trim() || undefined,
      zweck: selectedBuchung.zweck,
      dokumentNummer: rechnungNummer || undefined,
      dokumentDatumIso: rechnungDatum ? rechnungDatum.toISOString() : undefined,
      buchungsDatumIso: selectedBuchung.datum,
      betrag: buchungsBetrag,
      waehrung: rechnungWaehrung,
      positionen: parsedItemisierung.positionen,
    };

    const baseName = `${dokumentTyp === "rechnung" ? "Rechnung" : "Spendenquittung"}-${rechnungNummer || selectedBuchung._id}`;

    try {
      const pdfBytes = await generateZugferdEmbeddedPdf(payload);
      const pdfPart = new Uint8Array(pdfBytes.length);
      pdfPart.set(pdfBytes);
      const pdfFile = new File([pdfPart], `${baseName}.pdf`, {
        type: "application/pdf",
      });

      const pdfFileId = await uploadFile(pdfFile);

      await createRechnung({
        buchungId: selectedBuchung._id,
        fileId: pdfFileId,
        dateiname: pdfFile.name,
        mimeType: pdfFile.type,
        format: "e-rechnung",
        rechnungsnummer: rechnungNummer || undefined,
        rechnungsdatum: rechnungDatum ? rechnungDatum.toISOString() : undefined,
        rechnungsempfaenger: rechnungEmpfaenger.trim() || undefined,
        betrag: buchungsBetrag,
        waehrung: rechnungWaehrung,
        kommentar: encodeDokumentKommentar(dokumentTyp, rechnungKommentar),
      });

      toast.success("ZUGFeRD-PDF erstellt");
      await handleOpenRechnungDatei(pdfFileId);
    } catch {
      toast.error("Dokumente konnten nicht erzeugt werden");
      return;
    }

    setIsRechnungErstellenOpen(false);
    resetRechnungForm();
  };

  const itemisierungsSumme = useMemo(() => {
    const rows = itemisierung.filter(
      (item) =>
        item.bezeichnung.trim() || item.menge.trim() || item.einzelpreis.trim(),
    );
    if (rows.length === 0) return undefined;

    let summe = 0;
    for (const row of rows) {
      const menge = parseFloat(row.menge.replace(",", "."));
      const einzelpreis = parseFloat(row.einzelpreis.replace(",", "."));
      if (isNaN(menge) || isNaN(einzelpreis)) {
        return undefined;
      }
      summe += menge * einzelpreis;
    }
    return summe;
  }, [itemisierung]);

  if (
    kasse === undefined ||
    buchungen === undefined ||
    rechnungen === undefined ||
    mitglieder === undefined ||
    verein === undefined
  ) {
    return <div>Lade Rechnungen...</div>;
  }

  if (kasse === null) {
    return <div>Kasse nicht gefunden</div>;
  }

  return (
    <>
      <SiteHeader title={`Rechnungen · ${kasse.name}`} />
      <div className="space-y-6 p-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              router.push(`/verein/${vereinId}/finanzen/${kasseId}`)
            }
          >
            &larr; Zurück zur Kasse
          </Button>
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Rechnungsmanagement
            </h2>
            <p className="text-muted-foreground">
              {kasse.name} · {kasse.waehrung}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buchung</CardTitle>
            <CardDescription>
              Rechnungen werden nur für die ausgewählte Buchung angezeigt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedBuchung && (
              <p className="text-sm text-muted-foreground">
                Die angegebene Buchung wurde nicht gefunden.
              </p>
            )}
            {selectedBuchung && (
              <div className="space-y-4">
                <div className="rounded-md border p-3 space-y-1">
                  <p className="text-sm text-muted-foreground">Datum</p>
                  <p className="font-medium">
                    {format(new Date(selectedBuchung.datum), "dd.MM.yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">Zweck</p>
                  <p className="font-medium">{selectedBuchung.zweck}</p>
                  <p className="text-sm text-muted-foreground mt-2">Betrag</p>
                  <p
                    className={`font-medium ${selectedBuchung.betrag < 0 ? "text-red-500" : "text-green-500"}`}
                  >
                    {selectedBuchung.betrag > 0 ? "+" : ""}
                    {selectedBuchung.betrag.toFixed(2)} {kasse.waehrung}
                  </p>
                </div>
                <div className="flex justify-end">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateDokumentDialog}
                    >
                      Rechnung erstellen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCreateRechnungDialog}
                    >
                      Rechnung hinzufügen
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedBuchung && (
          <Card>
            <CardHeader>
              <CardTitle>Rechnungen zur Buchung</CardTitle>
              <CardDescription>
                Es werden nur Rechnungen dieser Buchung angezeigt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {selectedBuchungRechnungen.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Noch keine Rechnungen hochgeladen.
                </p>
              )}
              {selectedBuchungRechnungen.map((rechnung) => (
                <div
                  key={rechnung._id}
                  className="flex items-center justify-between gap-2 text-sm rounded-md border p-3"
                >
                  <div>
                    <p className="font-medium">{rechnung.dateiname}</p>
                    <p className="text-muted-foreground">
                      {decodeDokumentKommentar(rechnung.kommentar)
                        .dokumentTyp === "spendenquittung"
                        ? "Spendenquittung"
                        : "Rechnung"}
                    </p>
                    <p
                      className={
                        rechnung.betragAbgleich
                          ? "text-green-600"
                          : "text-red-500"
                      }
                    >
                      {rechnung.betrag.toFixed(2)} {rechnung.waehrung} ·{" "}
                      {rechnung.betragAbgleich
                        ? "Betrag passt"
                        : "Betrag weicht ab"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenRechnungDatei(rechnung.fileId)}
                    >
                      Öffnen
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRechnungDialog(rechnung)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleDownloadRechnungDatei(
                          rechnung.fileId,
                          rechnung.dateiname,
                        )
                      }
                    >
                      Download
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRechnung(rechnung._id)}
                    >
                      Löschen
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Dialog
          open={isRechnungHinzufuegenOpen}
          onOpenChange={setIsRechnungHinzufuegenOpen}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRechnungId
                  ? "Rechnung bearbeiten"
                  : "Rechnung hinzufügen"}
              </DialogTitle>
              <DialogDescription>
                Buchung: {selectedBuchung?.zweck || "-"} · Verbucht:{" "}
                {selectedBuchung?.betrag.toFixed(2)} {kasse.waehrung}
              </DialogDescription>
            </DialogHeader>

            {selectedBuchung && (
              <div className="rounded-md border p-3 space-y-2">
                <p className="text-sm font-medium">Vorhandene Rechnungen</p>
                {selectedBuchungRechnungen.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Rechnungen hochgeladen.
                  </p>
                )}
                {selectedBuchungRechnungen.map((rechnung) => (
                  <div
                    key={rechnung._id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{rechnung.dateiname}</p>
                      <p className="text-muted-foreground">
                        {decodeDokumentKommentar(rechnung.kommentar)
                          .dokumentTyp === "spendenquittung"
                          ? "Spendenquittung"
                          : "Rechnung"}
                      </p>
                      <p
                        className={
                          rechnung.betragAbgleich
                            ? "text-green-600"
                            : "text-red-500"
                        }
                      >
                        {rechnung.betrag.toFixed(2)} {rechnung.waehrung} ·{" "}
                        {rechnung.betragAbgleich
                          ? "Betrag passt"
                          : "Betrag weicht ab"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRechnungDatei(rechnung.fileId)}
                      >
                        Öffnen
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditRechnungDialog(rechnung)}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownloadRechnungDatei(
                            rechnung.fileId,
                            rechnung.dateiname,
                          )
                        }
                      >
                        Download
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteRechnung(rechnung._id)}
                      >
                        Löschen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="dokumentTyp">Dokumenttyp</Label>
                <Select
                  value={dokumentTyp}
                  onValueChange={(val: FinanzDokumentTyp) =>
                    setDokumentTyp(val)
                  }
                >
                  <SelectTrigger id="dokumentTyp">
                    <SelectValue placeholder="Dokumenttyp wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rechnung">Rechnung</SelectItem>
                    <SelectItem value="spendenquittung">
                      Spendenquittung
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rechnungFormat">Format</Label>
                <Select
                  value={rechnungFormat}
                  onValueChange={(val: "pdf" | "e-rechnung") =>
                    setRechnungFormat(val)
                  }
                >
                  <SelectTrigger id="rechnungFormat">
                    <SelectValue placeholder="Format wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="e-rechnung">E-Rechnung</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rechnungDatei">
                  Rechnungsdatei{" "}
                  {editingRechnungId ? "(optional für Ersetzen)" : ""}
                </Label>
                <Input
                  id="rechnungDatei"
                  type="file"
                  accept={
                    rechnungFormat === "pdf"
                      ? ".pdf,application/pdf"
                      : ".pdf,.xml,application/pdf,application/xml,text/xml"
                  }
                  onChange={(e) =>
                    setRechnungDatei(e.target.files?.[0] ?? null)
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Rechnungsbetrag</Label>
                  <Input
                    value={`${Math.abs(selectedBuchung?.betrag ?? 0).toFixed(2)}`}
                    readOnly
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rechnungWaehrung">Währung</Label>
                  <Input
                    id="rechnungWaehrung"
                    value={rechnungWaehrung}
                    onChange={(e) =>
                      setRechnungWaehrung(e.target.value.toUpperCase())
                    }
                    placeholder="EUR"
                  />
                </div>
              </div>
              {dokumentTyp === "rechnung" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Optionale Itemisierung</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItemisierung((prev) => [
                          ...prev,
                          {
                            id: `${Date.now()}-${Math.random()}`,
                            bezeichnung: "",
                            menge: "1",
                            einzelpreis: "0",
                          },
                        ])
                      }
                    >
                      + Position
                    </Button>
                  </div>
                  {itemisierung.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Keine Positionen hinterlegt.
                    </p>
                  )}
                  {itemisierung.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-end"
                    >
                      <div className="col-span-6 grid gap-1">
                        <Label>Bezeichnung</Label>
                        <Input
                          value={item.bezeichnung}
                          onChange={(e) =>
                            setItemisierung((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, bezeichnung: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label>Menge</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.menge}
                          onChange={(e) =>
                            setItemisierung((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, menge: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-3 grid gap-1">
                        <Label>Einzelpreis</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.einzelpreis}
                          onChange={(e) =>
                            setItemisierung((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, einzelpreis: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setItemisierung((prev) =>
                              prev.filter((row) => row.id !== item.id),
                            )
                          }
                        >
                          -
                        </Button>
                      </div>
                    </div>
                  ))}
                  {typeof itemisierungsSumme === "number" &&
                    itemisierung.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Positionssumme: {itemisierungsSumme.toFixed(2)}{" "}
                        {rechnungWaehrung} · Gebucht:{" "}
                        {Math.abs(selectedBuchung?.betrag ?? 0).toFixed(2)}{" "}
                        {rechnungWaehrung}
                      </p>
                    )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="rechnungNummer">Rechnungsnummer</Label>
                  <Input
                    id="rechnungNummer"
                    value={rechnungNummer}
                    onChange={(e) => setRechnungNummer(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2 flex-col flex">
                  <Label htmlFor="rechnungDatum">Rechnungsdatum</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !rechnungDatum && "text-muted-foreground",
                        )}
                      >
                        {rechnungDatum ? (
                          format(rechnungDatum, "PPP", { locale: de })
                        ) : (
                          <span>Datum wählen</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={rechnungDatum}
                        onSelect={setRechnungDatum}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rechnungEmpfaenger">Rechnungsempfänger</Label>
                <Input
                  id="rechnungEmpfaenger"
                  value={rechnungEmpfaenger}
                  onChange={(e) => setRechnungEmpfaenger(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rechnungKommentar">Kommentar</Label>
                <Input
                  id="rechnungKommentar"
                  value={rechnungKommentar}
                  onChange={(e) => setRechnungKommentar(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  resetRechnungForm();
                  setIsRechnungHinzufuegenOpen(false);
                }}
              >
                Schließen
              </Button>
              <Button onClick={handleSaveRechnung}>
                {editingRechnungId
                  ? "Rechnung aktualisieren"
                  : "Rechnung speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={isRechnungErstellenOpen}
          onOpenChange={setIsRechnungErstellenOpen}
        >
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Rechnung erstellen</DialogTitle>
              <DialogDescription>
                Buchung: {selectedBuchung?.zweck || "-"} · Verbucht:{" "}
                {selectedBuchung?.betrag.toFixed(2)} {kasse.waehrung}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="dokumentTypErstellen">Dokumenttyp</Label>
                <Select
                  value={dokumentTyp}
                  onValueChange={(val: FinanzDokumentTyp) =>
                    setDokumentTyp(val)
                  }
                >
                  <SelectTrigger id="dokumentTypErstellen">
                    <SelectValue placeholder="Dokumenttyp wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rechnung">Rechnung</SelectItem>
                    <SelectItem value="spendenquittung">
                      Spendenquittung
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Rechnungsbetrag</Label>
                  <Input
                    value={`${Math.abs(selectedBuchung?.betrag ?? 0).toFixed(2)}`}
                    readOnly
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rechnungWaehrungErstellen">Währung</Label>
                  <Input
                    id="rechnungWaehrungErstellen"
                    value={rechnungWaehrung}
                    onChange={(e) =>
                      setRechnungWaehrung(e.target.value.toUpperCase())
                    }
                    placeholder="EUR"
                  />
                </div>
              </div>
              {dokumentTyp === "rechnung" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Optionale Itemisierung</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItemisierung((prev) => [
                          ...prev,
                          {
                            id: `${Date.now()}-${Math.random()}`,
                            bezeichnung: "",
                            menge: "1",
                            einzelpreis: "0",
                          },
                        ])
                      }
                    >
                      + Position
                    </Button>
                  </div>
                  {itemisierung.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Keine Positionen hinterlegt.
                    </p>
                  )}
                  {itemisierung.map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-end"
                    >
                      <div className="col-span-6 grid gap-1">
                        <Label>Bezeichnung</Label>
                        <Input
                          value={item.bezeichnung}
                          onChange={(e) =>
                            setItemisierung((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, bezeichnung: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 grid gap-1">
                        <Label>Menge</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.menge}
                          onChange={(e) =>
                            setItemisierung((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, menge: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-3 grid gap-1">
                        <Label>Einzelpreis</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.einzelpreis}
                          onChange={(e) =>
                            setItemisierung((prev) =>
                              prev.map((row) =>
                                row.id === item.id
                                  ? { ...row, einzelpreis: e.target.value }
                                  : row,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setItemisierung((prev) =>
                              prev.filter((row) => row.id !== item.id),
                            )
                          }
                        >
                          -
                        </Button>
                      </div>
                    </div>
                  ))}
                  {typeof itemisierungsSumme === "number" &&
                    itemisierung.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Positionssumme: {itemisierungsSumme.toFixed(2)}{" "}
                        {rechnungWaehrung} · Gebucht:{" "}
                        {Math.abs(selectedBuchung?.betrag ?? 0).toFixed(2)}{" "}
                        {rechnungWaehrung}
                      </p>
                    )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="rechnungNummerErstellen">
                    Rechnungsnummer
                  </Label>
                  <Input
                    id="rechnungNummerErstellen"
                    value={rechnungNummer}
                    onChange={(e) => setRechnungNummer(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid gap-2 flex-col flex">
                  <Label htmlFor="rechnungDatumErstellen">Rechnungsdatum</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !rechnungDatum && "text-muted-foreground",
                        )}
                      >
                        {rechnungDatum ? (
                          format(rechnungDatum, "PPP", { locale: de })
                        ) : (
                          <span>Datum wählen</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={rechnungDatum}
                        onSelect={setRechnungDatum}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rechnungEmpfaengerErstellen">
                  Rechnungsempfänger
                </Label>
                <Input
                  id="rechnungEmpfaengerErstellen"
                  value={rechnungEmpfaenger}
                  onChange={(e) => setRechnungEmpfaenger(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rechnungKommentarErstellen">Kommentar</Label>
                <Input
                  id="rechnungKommentarErstellen"
                  value={rechnungKommentar}
                  onChange={(e) => setRechnungKommentar(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  resetRechnungForm();
                  setIsRechnungErstellenOpen(false);
                }}
              >
                Schließen
              </Button>
              <Button onClick={handleGenerateDokumente}>
                PDF + ZUGFeRD erzeugen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
