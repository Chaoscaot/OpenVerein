"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function RollenManager({ vereinId }: { vereinId: Id<"verein"> }) {
    const acl = useQuery(api.permissions.getMyPermissions, { vereinId });
    const canManage = acl?.permissions.includes("rolle.manage") ?? false;
    const canView = acl?.permissions.includes("rolle.view") ?? false;

    const rollen = useQuery(api.rollen.list, canView ? { vereinId } : "skip");
    const definitions = useQuery(api.permissions.listDefinitions);

    const createRolle = useMutation(api.rollen.create);
    const updateRolle = useMutation(api.rollen.update);
    const removeRolle = useMutation(api.rollen.remove);

    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<Id<"vereins_rollen"> | null>(null);
    const [name, setName] = useState("");
    const [selected, setSelected] = useState<string[]>([]);

    const editRole = useMemo(() => rollen?.find((rolle) => rolle._id === editId), [rollen, editId]);

    const startCreate = () => {
        setEditId(null);
        setName("");
        setSelected([]);
        setOpen(true);
    };

    const startEdit = (id: Id<"vereins_rollen">) => {
        const rolle = rollen?.find((item) => item._id === id);
        if (!rolle) {
            return;
        }
        setEditId(id);
        setName(rolle.name);
        setSelected(rolle.berechtigungen);
        setOpen(true);
    };

    const togglePermission = (permission: string, checked: boolean) => {
        setSelected((current) => {
            if (checked) {
                return Array.from(new Set([...current, permission]));
            }
            return current.filter((value) => value !== permission);
        });
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Bitte einen Rollennamen eingeben");
            return;
        }

        try {
            if (editId) {
                await updateRolle({
                    rolleId: editId,
                    name: name.trim(),
                    berechtigungen: selected,
                });
                toast.success("Rolle aktualisiert");
            } else {
                await createRolle({
                    vereinId,
                    name: name.trim(),
                    berechtigungen: selected,
                });
                toast.success("Rolle erstellt");
            }
            setOpen(false);
        } catch (error) {
            toast.error("Rolle konnte nicht gespeichert werden");
        }
    };

    const handleDelete = async (id: Id<"vereins_rollen">) => {
        if (!window.confirm("Rolle wirklich löschen?")) {
            return;
        }

        try {
            await removeRolle({ rolleId: id });
            toast.success("Rolle gelöscht");
        } catch {
            toast.error("Rolle konnte nicht gelöscht werden");
        }
    };

    if (acl === undefined || definitions === undefined) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Rollen & Berechtigungen</CardTitle>
                    <CardDescription>Lade Rollenverwaltung...</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!canView) {
        return null;
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                    <CardTitle>Rollen & Berechtigungen</CardTitle>
                    <CardDescription>Erstelle Rollen und bündele feingranulare Rechte für Vereinsbereiche.</CardDescription>
                </div>
                {canManage && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={startCreate}>+ Rolle erstellen</Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{editId ? "Rolle bearbeiten" : "Neue Rolle"}</DialogTitle>
                                <DialogDescription>Wähle die Rechte aus, die diese Rolle erhalten soll.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="rollen-name">Name</Label>
                                    <Input id="rollen-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Kassenwart" />
                                </div>
                                {definitions.groups.map((group) => (
                                    <div key={group.key} className="space-y-2 rounded-md border p-3">
                                        <p className="text-sm font-semibold">{group.label}</p>
                                        <div className="grid gap-2">
                                            {group.permissions.map((permission) => {
                                                const checked = selected.includes(permission.key);
                                                return (
                                                    <label key={permission.key} className="flex items-center gap-2 text-sm">
                                                        <Checkbox checked={checked} onCheckedChange={(value) => togglePermission(permission.key, !!value)} />
                                                        <span>{permission.label}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <DialogFooter>
                                <Button onClick={handleSave} disabled={!name.trim()}>
                                    Speichern
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent className="space-y-3">
                {(rollen ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Noch keine Rollen angelegt.</p>
                ) : (
                    (rollen ?? []).map((rolle) => (
                        <div key={rolle._id} className="rounded-md border p-3">
                            <div className="flex items-center justify-between gap-2">
                                <p className="font-medium">{rolle.name}</p>
                                {canManage && (
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => startEdit(rolle._id)}>
                                            Bearbeiten
                                        </Button>
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(rolle._id)}>
                                            Löschen
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{rolle.berechtigungen.length} Rechte</p>
                        </div>
                    ))
                )}
                {editRole && open ? <div className="sr-only">Bearbeite {editRole.name}</div> : null}
            </CardContent>
        </Card>
    );
}
