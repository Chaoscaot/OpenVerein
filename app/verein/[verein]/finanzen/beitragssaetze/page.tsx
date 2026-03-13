"use client";

import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function BeitragssaetzePage() {
  const params = useParams();
  const vereinId = params.verein as Id<"verein">;

  const beitragssaetze = useQuery(api.beitragssatz.list, { vereinId });
  const buchungsUebersicht = useQuery(
    api.finanzen.getBeitragsBuchungsUebersicht,
    { vereinId },
  );

  const createBeitragssatz = useMutation(api.beitragssatz.create);
  const updateBeitragssatz = useMutation(api.beitragssatz.update);
  const removeBeitragssatz = useMutation(api.beitragssatz.remove);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editId, setEditId] = useState<Id<"beitrags_satz"> | undefined>(
    undefined,
  );
  const [name, setName] = useState("");
  const [betrag, setBetrag] = useState("");
  const [waehrung, setWaehrung] = useState("EUR");
  const [beschreibung, setBeschreibung] = useState("");

  const editBeitragssatz = useMemo(
    () => beitragssaetze?.find((satz) => satz._id === editId),
    [beitragssaetze, editId],
  );

  const openCreate = () => {
    setEditId(undefined);
    setName("");
    setBetrag("");
    setWaehrung("EUR");
    setBeschreibung("");
    setIsDialogOpen(true);
  };

  const openEdit = (id: Id<"beitrags_satz">) => {
    const satz = beitragssaetze?.find((value) => value._id === id);
    if (!satz) {
      return;
    }

    setEditId(id);
    setName(satz.name);
    setBetrag(satz.betrag.toString());
    setWaehrung(satz.waehrung);
    setBeschreibung(satz.beschreibung ?? "");
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const parsedBetrag = parseFloat(betrag);
    if (
      !name.trim() ||
      Number.isNaN(parsedBetrag) ||
      parsedBetrag <= 0 ||
      !waehrung.trim()
    ) {
      toast.error("Bitte Name, Betrag und Währung korrekt ausfüllen");
      return;
    }

    try {
      if (editId) {
        await updateBeitragssatz({
          id: editId,
          name: name.trim(),
          betrag: parsedBetrag,
          waehrung: waehrung.trim().toUpperCase(),
          beschreibung: beschreibung.trim() ? beschreibung.trim() : undefined,
        });
        toast.success("Beitragssatz aktualisiert");
      } else {
        await createBeitragssatz({
          vereinId,
          name: name.trim(),
          betrag: parsedBetrag,
          waehrung: waehrung.trim().toUpperCase(),
          beschreibung: beschreibung.trim() ? beschreibung.trim() : undefined,
        });
        toast.success("Beitragssatz erstellt");
      }
      setIsDialogOpen(false);
    } catch (error) {
      toast.error("Speichern fehlgeschlagen");
    }
  };

  const handleDelete = async (id: Id<"beitrags_satz">) => {
    if (!window.confirm("Beitragssatz wirklich löschen?")) {
      return;
    }

    try {
      await removeBeitragssatz({ id });
      toast.success("Beitragssatz gelöscht");
    } catch (error) {
      toast.error("Beitragssatz kann nicht gelöscht werden");
    }
  };

  if (beitragssaetze === undefined || buchungsUebersicht === undefined) {
    return <div>Lade Beitragsverwaltung...</div>;
  }

  return (
    <>
      <SiteHeader title="Beitragsverwaltung" />
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Beitragssätze</h2>
            <p className="text-muted-foreground">
              Verwalte alle Beitragssätze und prüfe die Zuordnung in Buchungen.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>+ Neuer Beitragssatz</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editId
                    ? "Beitragssatz bearbeiten"
                    : "Beitragssatz erstellen"}
                </DialogTitle>
                <DialogDescription>
                  Definiere Name, Betrag und optionale Beschreibung.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Standardbeitrag"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="betrag">Betrag</Label>
                    <Input
                      id="betrag"
                      type="number"
                      step="0.01"
                      value={betrag}
                      onChange={(e) => setBetrag(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="waehrung">Währung</Label>
                    <Input
                      id="waehrung"
                      value={waehrung}
                      onChange={(e) => setWaehrung(e.target.value)}
                      placeholder="EUR"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="beschreibung">Beschreibung</Label>
                  <Textarea
                    id="beschreibung"
                    value={beschreibung}
                    onChange={(e) => setBeschreibung(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSave} disabled={!name || !betrag}>
                  Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Beitragssätze</CardDescription>
              <CardTitle>{beitragssaetze.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Buchungen gesamt</CardDescription>
              <CardTitle>{buchungsUebersicht.gesamt}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Mit Beitragssatz</CardDescription>
              <CardTitle>{buchungsUebersicht.mitBeitragssatz}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ohne Zuordnung</CardDescription>
              <CardTitle>{buchungsUebersicht.ohneZuordnung}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Alle Beitragssätze</CardTitle>
            <CardDescription>
              Bestehende Beitragssätze bearbeiten oder löschen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Betrag</TableHead>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead className="w-[220px]">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {beitragssaetze.map((satz) => (
                  <TableRow key={satz._id}>
                    <TableCell className="font-medium">{satz.name}</TableCell>
                    <TableCell>
                      {satz.betrag.toFixed(2)} {satz.waehrung}
                    </TableCell>
                    <TableCell>{satz.beschreibung || "-"}</TableCell>
                    <TableCell className="space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(satz._id)}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(satz._id)}
                      >
                        Löschen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {beitragssaetze.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      Noch keine Beitragssätze angelegt.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {editBeitragssatz && isDialogOpen ? (
          <div className="sr-only">Bearbeite {editBeitragssatz.name}</div>
        ) : null}
      </div>
    </>
  );
}
