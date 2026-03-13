"use client";

import { useMemo, useRef, useState } from "react";
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

type RecipientTargetOption = {
    key: string;
    name: string;
    description: string;
    kind: "list" | "role" | "member";
    recipientCount: number;
    blockedCount: number;
};

function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function getMailStatusVariant(status: "queued" | "sent" | "failed") {
    switch (status) {
        case "sent":
            return "secondary" as const;
        case "failed":
            return "destructive" as const;
        default:
            return "outline" as const;
    }
}

function getMailStatusLabel(status: "queued" | "sent" | "failed") {
    switch (status) {
        case "sent":
            return "Versendet";
        case "failed":
            return "Fehlgeschlagen";
        default:
            return "In Warteschlange";
    }
}

function formatFileSize(size: number) {
    if (size < 1024) {
        return `${size} B`;
    }
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getRecipientTargetLabel(kind: RecipientTargetOption["kind"]) {
    switch (kind) {
        case "role":
            return "Rolle";
        case "member":
            return "Person";
        default:
            return "Liste";
    }
}

function getRecipientTargetBadgeVariant(kind: RecipientTargetOption["kind"]) {
    switch (kind) {
        case "role":
            return "outline" as const;
        case "member":
            return "default" as const;
        default:
            return "secondary" as const;
    }
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

function RecipientTargetInput({ options, selectedKeys, onChange }: { options: RecipientTargetOption[]; selectedKeys: string[]; onChange: (value: string[]) => void }) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const optionByKey = useMemo(() => new Map(options.map((option) => [option.key, option])), [options]);

    const selectedOptions = useMemo(() => selectedKeys.map((key) => optionByKey.get(key)).filter((option): option is RecipientTargetOption => option !== undefined), [optionByKey, selectedKeys]);

    const filteredOptions = useMemo(() => {
        const selected = new Set(selectedKeys);
        const normalizedQuery = query.trim().toLowerCase();

        return options.filter((option) => {
            if (selected.has(option.key)) {
                return false;
            }

            if (!normalizedQuery) {
                return true;
            }

            return `${option.name} ${option.description} ${getRecipientTargetLabel(option.kind)}`.toLowerCase().includes(normalizedQuery);
        });
    }, [options, query, selectedKeys]);

    const groupedOptions = useMemo(
        () => ({
            list: filteredOptions.filter((option) => option.kind === "list"),
            role: filteredOptions.filter((option) => option.kind === "role"),
            member: filteredOptions.filter((option) => option.kind === "member"),
        }),
        [filteredOptions],
    );

    const addOption = (key: string) => {
        if (selectedKeys.includes(key)) {
            return;
        }

        onChange([...selectedKeys, key]);
        setQuery("");
        setOpen(true);
        inputRef.current?.focus();
    };

    const removeOption = (key: string) => {
        onChange(selectedKeys.filter((currentKey) => currentKey !== key));
    };

    return (
        <div className="grid gap-2">
            <Label htmlFor="mail-recipients">Empfänger</Label>
            <div className="relative">
                <div
                    className="min-h-11 rounded-md border bg-background px-3 py-2 flex flex-wrap items-center gap-2 focus-within:ring-1 focus-within:ring-ring"
                    onClick={() => {
                        setOpen(true);
                        inputRef.current?.focus();
                    }}
                >
                    {selectedOptions.map((option) => (
                        <Badge key={option.key} variant={getRecipientTargetBadgeVariant(option.kind)} className="gap-2 py-1 pl-2 pr-1">
                            <span className="max-w-48 truncate">{option.name}</span>
                            <span className="text-[10px] uppercase opacity-70">{getRecipientTargetLabel(option.kind)}</span>
                            <button
                                type="button"
                                className="rounded-sm px-1 text-xs opacity-80 transition hover:opacity-100"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    removeOption(option.key);
                                }}
                                aria-label={`${option.name} entfernen`}
                            >
                                ×
                            </button>
                        </Badge>
                    ))}

                    <input
                        id="mail-recipients"
                        ref={inputRef}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        onBlur={() => {
                            window.setTimeout(() => setOpen(false), 120);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Backspace" && query.length === 0 && selectedKeys.length > 0) {
                                removeOption(selectedKeys[selectedKeys.length - 1]);
                                return;
                            }

                            if ((event.key === "Enter" || event.key === "Tab") && filteredOptions.length > 0) {
                                event.preventDefault();
                                addOption(filteredOptions[0].key);
                                return;
                            }

                            if (event.key === "Escape") {
                                setOpen(false);
                            }
                        }}
                        placeholder={selectedOptions.length === 0 ? "Listen, Rollen oder Personen eingeben..." : "Weitere Empfänger hinzufügen..."}
                        className="h-7 min-w-[14rem] flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
                        autoComplete="off"
                    />
                </div>

                {open ? (
                    <div className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-md border bg-popover shadow-md">
                        {filteredOptions.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-muted-foreground">Keine passenden Listen, Rollen oder Personen gefunden.</p>
                        ) : (
                            (["list", "role", "member"] as const).map((kind) => {
                                const group = groupedOptions[kind];
                                if (group.length === 0) {
                                    return null;
                                }

                                return (
                                    <div key={kind} className="border-b last:border-b-0">
                                        <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{getRecipientTargetLabel(kind)}</p>
                                        <div className="pb-1">
                                            {group.map((option) => (
                                                <button
                                                    key={option.key}
                                                    type="button"
                                                    className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-accent hover:text-accent-foreground"
                                                    onMouseDown={(event) => event.preventDefault()}
                                                    onClick={() => addOption(option.key)}
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate font-medium">{option.name}</p>
                                                        <p className="truncate text-xs text-muted-foreground">{option.description}</p>
                                                    </div>
                                                    <Badge variant={getRecipientTargetBadgeVariant(option.kind)} className="shrink-0">
                                                        {option.recipientCount}
                                                    </Badge>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                ) : null}
            </div>
            <p className="text-sm text-muted-foreground">Tippe frei wie in einem E-Mail-Programm. Vorschläge werden aus Listen, Rollen und Personen ergänzt.</p>
        </div>
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

    const recipientTargets = useQuery(api.listen.recipientTargets, canSend ? { vereinId } : "skip");
    const history = useQuery(api.listen.history, canRead ? { vereinId, limit: 10 } : "skip");
    const sendMail = useMutation(api.listen.sendMail);
    const deleteFile = useMutation(api.files.deleteFile);
    const uploadFile = useUploadFile(api.files);

    const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>([]);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const validSelectedTargetKeys = useMemo(() => {
        if (!recipientTargets) {
            return selectedTargetKeys;
        }

        const validKeys = new Set(recipientTargets.map((target) => target.key));
        return selectedTargetKeys.filter((key) => validKeys.has(key));
    }, [recipientTargets, selectedTargetKeys]);

    const preview = useQuery(api.listen.previewRecipients, canSend ? { vereinId, targetKeys: validSelectedTargetKeys } : "skip");

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

        if (validSelectedTargetKeys.length === 0) {
            toast.error("Bitte wähle mindestens ein Empfängerziel aus");
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
                targetKeys: validSelectedTargetKeys,
                subject,
                body,
                attachments,
            });
            toast.success(`Mailversand gestartet für ${result.recipientCount} Empfänger`);
            setSubject("");
            setBody("");
            setSelectedTargetKeys([]);
            setAttachments([]);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Mail konnte nicht versendet werden");
        }
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
                <CardDescription>Empfänger wie in einem Mailprogramm eingeben und automatisch aus Listen, Rollen oder Personen vervollständigen lassen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!canSend ? (
                    <p className="text-sm text-muted-foreground">Dir fehlt die Berechtigung zum Versenden von E-Mails.</p>
                ) : (
                    <>
                        <RecipientTargetInput options={recipientTargets ?? []} selectedKeys={validSelectedTargetKeys} onChange={setSelectedTargetKeys} />

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
                                    <p className="text-sm text-muted-foreground">Doppelte E-Mail-Adressen werden automatisch entfernt. Abgemeldete Empfänger werden übersprungen.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {preview?.blockedCount ? <Badge variant="outline">{preview.blockedCount} abgemeldet</Badge> : null}
                                    <Badge variant="secondary">{preview?.recipientCount ?? 0} Empfänger</Badge>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(preview?.targetSummaries ?? []).map((summary) => (
                                    <Badge key={summary.key} variant={getRecipientTargetBadgeVariant(summary.kind)}>
                                        {summary.name}: {summary.recipientCount}
                                        {summary.blockedCount > 0 ? ` · ${summary.blockedCount} abgemeldet` : ""}
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

                        <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="font-medium">Mail-Historie</p>
                                    <p className="text-sm text-muted-foreground">Die letzten Versandaufträge mit Status und Versanddetails.</p>
                                </div>
                                <Badge variant="outline">{history?.length ?? 0} Einträge</Badge>
                            </div>

                            <div className="space-y-3">
                                {(history ?? []).length === 0 ? (
                                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Noch keine Versandhistorie vorhanden.</div>
                                ) : (
                                    (history ?? []).map((entry) => (
                                        <div key={entry._id} className="rounded-lg border p-4 space-y-3">
                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                <div className="space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="font-medium">{entry.subject}</p>
                                                        <Badge variant={getMailStatusVariant(entry.status)}>{getMailStatusLabel(entry.status)}</Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">Erstellt am {formatDateTime(entry.createdAt)}</p>
                                                    {entry.completedAt ? <p className="text-sm text-muted-foreground">Abgeschlossen am {formatDateTime(entry.completedAt)}</p> : null}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline">{entry.recipientCount} Empfänger</Badge>
                                                    <Badge variant="outline">{entry.sentMessages ?? 0} Nachrichten</Badge>
                                                    <Badge variant="outline">{entry.attachments.length} Anhänge</Badge>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {entry.listNames.map((name) => (
                                                    <Badge key={`${entry._id}-${name}`} variant="secondary">
                                                        {name}
                                                    </Badge>
                                                ))}
                                            </div>

                                            <div className="space-y-1 text-sm text-muted-foreground">
                                                {entry.requestedByEmail ? <p>Angefordert von: {entry.requestedByEmail}</p> : null}
                                                <p>Antwortadresse: {entry.replyTo}</p>
                                                {entry.lastError ? <p className="text-destructive">Fehler: {entry.lastError}</p> : null}
                                            </div>

                                            <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-wrap">{entry.body}</div>
                                        </div>
                                    ))
                                )}
                            </div>
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
