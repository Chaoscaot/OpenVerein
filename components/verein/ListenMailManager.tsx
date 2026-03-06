"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { useUploadFile } from "@convex-dev/r2/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type Attachment = {
    fileId: string;
    name: string;
    mimeType?: string;
    size: number;
};

function formatFileSize(size: number) {
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function useCommunicationPermissions(vereinId: Id<"verein">) {
    const acl = useQuery(api.permissions.getMyPermissions, { vereinId });

    const canRead =
        acl?.permissions.includes("liste.view") || acl?.permissions.includes("liste.manage") || acl?.permissions.includes("mail.send") || acl?.permissions.includes("mitglied.view") || false;
    const canManage = acl?.permissions.includes("liste.manage") ?? false;
    const canSend = acl?.permissions.includes("mail.send") ?? false;

    return {
        acl,
        canRead,
        canManage,
        canSend,
    };
}

function CommunicationStateCard({ title, description }: { title: string; description: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
    );
}

export function ListenManager({ vereinId }: { vereinId: Id<"verein"> }) {
    const { acl, canRead, canManage } = useCommunicationPermissions(vereinId);

    const overview = useQuery(api.listen.overview, canRead ? { vereinId } : "skip");
    const customLists = useQuery(api.listen.customLists, canManage ? { vereinId } : "skip");
    const availableMembers = useQuery(api.listen.availableMembers, canManage ? { vereinId } : "skip");

    const createList = useMutation(api.listen.create);
    const updateList = useMutation(api.listen.update);
    const removeList = useMutation(api.listen.remove);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editListId, setEditListId] = useState<Id<"mitglieder_liste"> | null>(null);
    const [listName, setListName] = useState("");
    const [selectedMemberIds, setSelectedMemberIds] = useState<Id<"mitglied">[]>([]);
    const [memberSearch, setMemberSearch] = useState("");

    const systemLists = useMemo(() => overview?.filter((list) => list.kind === "system") ?? [], [overview]);
    const customListItems = useMemo(() => customLists ?? [], [customLists]);

    const filteredMembers = useMemo(() => {
        if (!availableMembers) {
            return [];
        }

        const term = memberSearch.trim().toLowerCase();
        if (!term) {
            return availableMembers;
        }

        return availableMembers.filter((mitglied) => `${mitglied.vorname} ${mitglied.nachname} ${mitglied.email}`.toLowerCase().includes(term));
    }, [availableMembers, memberSearch]);

    const selectedMembers = useMemo(() => {
        if (!availableMembers) {
            return [];
        }

        const ids = new Set(selectedMemberIds);
        return availableMembers.filter((mitglied) => ids.has(mitglied._id));
    }, [availableMembers, selectedMemberIds]);

    const startCreate = () => {
        setEditListId(null);
        setListName("");
        setSelectedMemberIds([]);
        setMemberSearch("");
        setDialogOpen(true);
    };

    const startEdit = (listId: Id<"mitglieder_liste">) => {
        const existing = customListItems.find((list) => list._id === listId);
        if (!existing) {
            return;
        }

        setEditListId(existing._id);
        setListName(existing.name);
        setSelectedMemberIds(existing.memberIds);
        setMemberSearch("");
        setDialogOpen(true);
    };

    const toggleMember = (memberId: Id<"mitglied">, checked: boolean) => {
        setSelectedMemberIds((current) => {
            if (checked) {
                return Array.from(new Set([...current, memberId]));
            }
            return current.filter((id) => id !== memberId);
        });
    };

    const handleSaveList = async () => {
        const trimmedName = listName.trim();
        if (!trimmedName) {
            toast.error("Bitte gib einen Listennamen ein");
            return;
        }

        try {
            if (editListId) {
                await updateList({
                    listeId: editListId,
                    name: trimmedName,
                    memberIds: selectedMemberIds,
                });
                toast.success("Liste aktualisiert");
            } else {
                await createList({
                    vereinId,
                    name: trimmedName,
                    memberIds: selectedMemberIds,
                });
                toast.success("Liste erstellt");
            }
            setDialogOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Liste konnte nicht gespeichert werden");
        }
    };

    const handleDeleteList = async (listId: Id<"mitglieder_liste">) => {
        if (!window.confirm("Liste wirklich löschen?")) {
            return;
        }

        try {
            await removeList({ listeId: listId });
            toast.success("Liste gelöscht");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Liste konnte nicht gelöscht werden");
        }
    };

    if (acl === undefined) {
        return <CommunicationStateCard title="Listen" description="Lade Listenbereich..." />;
    }

    if (!canRead) {
        return <CommunicationStateCard title="Kein Zugriff" description="Dir fehlen die Berechtigungen für Listen." />;
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Vordefinierte Listen</CardTitle>
                    <CardDescription>Diese Listen werden automatisch aus den Mitgliedsdaten erzeugt.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {systemLists.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aktuell sind keine automatischen Listen verfügbar.</p>
                    ) : (
                        systemLists.map((list) => (
                            <div key={list.key} className="rounded-lg border p-4 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium">{list.name}</p>
                                    <Badge variant="secondary">{list.memberCount}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{list.description}</p>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>Benutzerdefinierte Listen</CardTitle>
                        <CardDescription>Erstelle eigene Verteiler und wähle Mitglieder oder Kontakte frei aus.</CardDescription>
                    </div>
                    {canManage && (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={startCreate}>Liste erstellen</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{editListId ? "Liste bearbeiten" : "Neue Liste"}</DialogTitle>
                                    <DialogDescription>Wähle die Personen aus, die Teil dieser Liste sein sollen.</DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4 py-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="listen-name">Name</Label>
                                        <Input id="listen-name" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="z.B. Presseverteiler" />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="listen-mitglieder-suche">Personen suchen</Label>
                                        <Input id="listen-mitglieder-suche" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Name oder E-Mail durchsuchen" />
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {selectedMembers.length === 0 ? (
                                            <span className="text-sm text-muted-foreground">Noch keine Personen ausgewählt.</span>
                                        ) : (
                                            selectedMembers.map((mitglied) => (
                                                <Badge key={mitglied._id} variant="outline">
                                                    {mitglied.vorname} {mitglied.nachname}
                                                </Badge>
                                            ))
                                        )}
                                    </div>

                                    <div className="rounded-md border max-h-80 overflow-y-auto">
                                        {filteredMembers.length === 0 ? (
                                            <div className="p-4 text-sm text-muted-foreground">Keine passenden Personen gefunden.</div>
                                        ) : (
                                            filteredMembers.map((mitglied) => {
                                                const checked = selectedMemberIds.includes(mitglied._id);
                                                return (
                                                    <label key={mitglied._id} className="flex items-center justify-between gap-3 border-b p-3 last:border-b-0">
                                                        <div className="space-y-1">
                                                            <div className="font-medium">
                                                                {mitglied.vorname} {mitglied.nachname}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">{mitglied.email || "Keine E-Mail"}</div>
                                                        </div>
                                                        <Checkbox checked={checked} onCheckedChange={(value) => toggleMember(mitglied._id, Boolean(value))} />
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button onClick={handleSaveList} disabled={!listName.trim()}>
                                        Speichern
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </CardHeader>
                <CardContent className="space-y-3">
                    {customListItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Noch keine benutzerdefinierten Listen vorhanden.</p>
                    ) : (
                        customListItems.map((list) => (
                            <div key={list._id} className="rounded-lg border p-4 space-y-3">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{list.name}</p>
                                            <Badge variant="secondary">{list.memberCount}</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{list.members.length} Personen in dieser Liste</p>
                                    </div>
                                    {canManage && (
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" onClick={() => startEdit(list._id)}>
                                                Bearbeiten
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteList(list._id)}>
                                                Löschen
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {list.members.length === 0 ? (
                                        <span className="text-sm text-muted-foreground">Keine Personen zugeordnet.</span>
                                    ) : (
                                        list.members.slice(0, 8).map((mitglied) => (
                                            <Badge key={mitglied._id} variant="outline">
                                                {mitglied.vorname} {mitglied.nachname}
                                            </Badge>
                                        ))
                                    )}
                                    {list.members.length > 8 ? <Badge variant="secondary">+{list.members.length - 8}</Badge> : null}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export function MailSender({ vereinId }: { vereinId: Id<"verein"> }) {
    const { acl, canRead, canSend } = useCommunicationPermissions(vereinId);

    const overview = useQuery(api.listen.overview, canRead ? { vereinId } : "skip");
    const sendMail = useMutation(api.listen.sendMail);
    const deleteFile = useMutation(api.files.deleteFile);
    const uploadFile = useUploadFile(api.files);

    const [selectedListKeys, setSelectedListKeys] = useState<string[]>([]);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const preview = useQuery(api.listen.previewRecipients, canSend ? { vereinId, listKeys: selectedListKeys } : "skip");

    useEffect(() => {
        if (!overview) {
            return;
        }

        const validKeys = new Set(overview.map((list) => list.key));
        setSelectedListKeys((current) => current.filter((key) => validKeys.has(key)));
    }, [overview]);

    const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = "";

        if (files.length === 0) {
            return;
        }

        if (files.some((file) => file.size > 10 * 1024 * 1024)) {
            toast.error("Ein einzelner Anhang darf maximal 10 MB groß sein");
            return;
        }

        setUploading(true);
        const uploadPromise = Promise.all(
            files.map(async (file) => ({
                fileId: await uploadFile(file),
                name: file.name,
                mimeType: file.type || undefined,
                size: file.size,
            })),
        ).then((uploadedFiles) => {
            setAttachments((current) => [...current, ...uploadedFiles]);
        });

        toast.promise(uploadPromise, {
            loading: "Anhänge werden hochgeladen...",
            success: "Anhänge hochgeladen",
            error: "Anhänge konnten nicht hochgeladen werden",
        });

        uploadPromise.finally(() => setUploading(false));
    };

    const handleRemoveAttachment = async (fileId: string) => {
        const attachment = attachments.find((item) => item.fileId === fileId);
        if (!attachment) {
            return;
        }

        try {
            await deleteFile({ fileId });
            setAttachments((current) => current.filter((item) => item.fileId !== fileId));
            toast.success("Anhang entfernt");
        } catch {
            toast.error("Anhang konnte nicht entfernt werden");
        }
    };

    const handleSendMail = async () => {
        if (!canSend) {
            return;
        }

        if (selectedListKeys.length === 0) {
            toast.error("Bitte wähle mindestens eine Liste aus");
            return;
        }

        if (!subject.trim()) {
            toast.error("Bitte gib einen Betreff ein");
            return;
        }

        if (!body.trim()) {
            toast.error("Bitte gib einen Nachrichtentext ein");
            return;
        }

        try {
            const result = await sendMail({
                vereinId,
                listKeys: selectedListKeys,
                subject,
                body,
                attachments,
            });
            toast.success(`Mailversand gestartet für ${result.recipientCount} Empfänger`);
            setSubject("");
            setBody("");
            setSelectedListKeys([]);
            setAttachments([]);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Mail konnte nicht versendet werden");
        }
    };

    const toggleListSelection = (listKey: string, checked: boolean) => {
        setSelectedListKeys((current) => {
            if (checked) {
                return Array.from(new Set([...current, listKey]));
            }
            return current.filter((key) => key !== listKey);
        });
    };

    if (acl === undefined) {
        return <CommunicationStateCard title="Mailversand" description="Lade Mailversand..." />;
    }

    if (!canRead) {
        return <CommunicationStateCard title="Kein Zugriff" description="Dir fehlen die Berechtigungen für Listen oder Mailversand." />;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mailversand</CardTitle>
                <CardDescription>Wähle eine oder mehrere Listen und versende eine Mail mit Anhängen per Blindkopie.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!canSend ? (
                    <p className="text-sm text-muted-foreground">Dir fehlt die Berechtigung zum Versenden von E-Mails.</p>
                ) : (
                    <>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {(overview ?? []).map((list) => {
                                const checked = selectedListKeys.includes(list.key);
                                return (
                                    <label key={list.key} className="rounded-lg border p-4 flex items-start gap-3 cursor-pointer">
                                        <Checkbox checked={checked} onCheckedChange={(value) => toggleListSelection(list.key, Boolean(value))} />
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium">{list.name}</span>
                                                <Badge variant={list.kind === "system" ? "secondary" : "outline"}>{list.memberCount}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{list.description}</p>
                                        </div>
                                    </label>
                                );
                            })}
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="mail-subject">Betreff</Label>
                            <Input id="mail-subject" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="z.B. Einladung zur Mitgliederversammlung" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="mail-body">Nachricht</Label>
                            <Textarea id="mail-body" value={body} onChange={(event) => setBody(event.target.value)} placeholder="Schreibe hier deine Nachricht..." className="min-h-48" />
                        </div>

                        <div className="grid gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <Label>Anhänge</Label>
                                    <p className="text-sm text-muted-foreground">Maximal 10 MB pro Datei, insgesamt unter 25 MB.</p>
                                </div>
                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                                    {uploading ? "Lädt hoch..." : "Anhänge hochladen"}
                                </Button>
                                <input ref={fileInputRef} type="file" className="hidden" multiple onChange={handleAttachmentUpload} />
                            </div>

                            <div className="space-y-2">
                                {attachments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Keine Anhänge ausgewählt.</p>
                                ) : (
                                    attachments.map((attachment) => (
                                        <div key={attachment.fileId} className="flex items-center justify-between gap-3 rounded-md border p-3">
                                            <div>
                                                <p className="font-medium">{attachment.name}</p>
                                                <p className="text-sm text-muted-foreground">{formatFileSize(attachment.size)}</p>
                                            </div>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveAttachment(attachment.fileId)}>
                                                Entfernen
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">Empfängervorschau</p>
                                    <p className="text-sm text-muted-foreground">Doppelte E-Mail-Adressen werden automatisch entfernt.</p>
                                </div>
                                <Badge variant="secondary">{preview?.recipientCount ?? 0} Empfänger</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(preview?.listSummaries ?? []).map((summary) => (
                                    <Badge key={summary.key} variant="outline">
                                        {summary.name}: {summary.recipientCount}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(preview?.recipients ?? []).slice(0, 10).map((mitglied) => (
                                    <Badge key={mitglied._id} variant="outline">
                                        {mitglied.vorname} {mitglied.nachname}
                                    </Badge>
                                ))}
                                {(preview?.recipients?.length ?? 0) > 10 ? <Badge variant="secondary">+{(preview?.recipients?.length ?? 0) - 10}</Badge> : null}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSendMail}>Mailversand starten</Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export function ListenMailManager({ vereinId }: { vereinId: Id<"verein"> }) {
    return (
        <div className="space-y-4">
            <ListenManager vereinId={vereinId} />
            <MailSender vereinId={vereinId} />
        </div>
    );
}
