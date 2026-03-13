"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, ChevronDown, Delete02Icon, Edit02Icon } from "@hugeicons/core-free-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

type TaskRole = "admin" | "bearbeiter" | "mitarbeiter";
type TaskStatus = "offen" | "in_bearbeitung" | "blockiert" | "erledigt";

type ListMemberForm = {
    mitgliedId: Id<"mitglied">;
    rolle: TaskRole;
};

type SearchableOption = {
    value: string;
    label: string;
    description?: string;
};

const ROLE_OPTIONS: { value: TaskRole; label: string }[] = [
    { value: "admin", label: "Admin" },
    { value: "bearbeiter", label: "Bearbeiter" },
    { value: "mitarbeiter", label: "Mitarbeiter" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
    { value: "offen", label: "Offen" },
    { value: "in_bearbeitung", label: "In Bearbeitung" },
    { value: "blockiert", label: "Blockiert" },
    { value: "erledigt", label: "Erledigt" },
];

function formatDate(value?: string) {
    if (!value) {
        return "Kein Datum";
    }

    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
    }).format(new Date(`${value}T12:00:00`));
}

function getRoleLabel(role: TaskRole) {
    return ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
}

function getStatusLabel(status: TaskStatus) {
    return STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function getStatusVariant(status: TaskStatus) {
    switch (status) {
        case "erledigt":
            return "secondary" as const;
        case "blockiert":
            return "destructive" as const;
        case "in_bearbeitung":
            return "default" as const;
        default:
            return "outline" as const;
    }
}

function StateCard({ title, description }: { title: string; description: string }) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
        </Card>
    );
}

function SearchableDropdown({
    buttonLabel,
    placeholder,
    searchPlaceholder,
    emptyLabel,
    options,
    onSelect,
    disabled = false,
}: {
    buttonLabel: string;
    placeholder: string;
    searchPlaceholder: string;
    emptyLabel: string;
    options: SearchableOption[];
    onSelect: (value: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    const filteredOptions = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) {
            return options;
        }

        return options.filter((option) => `${option.label} ${option.description ?? ""}`.toLowerCase().includes(query));
    }, [options, search]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="justify-between" disabled={disabled} title={placeholder}>
                    {buttonLabel}
                    <HugeiconsIcon icon={ChevronDown} />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[22rem] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
                    <CommandList>
                        <CommandEmpty>{emptyLabel}</CommandEmpty>
                        <CommandGroup>
                            {filteredOptions.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => {
                                        onSelect(option.value);
                                        setSearch("");
                                        setOpen(false);
                                    }}
                                >
                                    <div className="min-w-0">
                                        <p>{option.label}</p>
                                        {option.description ? <p className="truncate text-xs text-muted-foreground">{option.description}</p> : null}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function AufgabenManager({ vereinId }: { vereinId: Id<"verein"> }) {
    const overview = useQuery(api.aufgaben.overview, { vereinId });
    const availableMembers = useQuery(api.aufgaben.availableMembers, overview ? { vereinId } : "skip");

    const [selectedListId, setSelectedListId] = useState<Id<"aufgaben_liste"> | null>(null);

    const listDetails = useQuery(api.aufgaben.listDetails, selectedListId ? { listeId: selectedListId } : "skip");

    const createList = useMutation(api.aufgaben.createList);
    const updateList = useMutation(api.aufgaben.updateList);
    const updateListMembers = useMutation(api.aufgaben.updateListMembers);
    const removeList = useMutation(api.aufgaben.removeList);
    const createTask = useMutation(api.aufgaben.createTask);
    const updateTask = useMutation(api.aufgaben.updateTask);
    const removeTask = useMutation(api.aufgaben.removeTask);

    const [listDialogOpen, setListDialogOpen] = useState(false);
    const [editingListId, setEditingListId] = useState<Id<"aufgaben_liste"> | null>(null);
    const [listName, setListName] = useState("");
    const [listDescription, setListDescription] = useState("");
    const [listMembers, setListMembers] = useState<ListMemberForm[]>([]);

    const [taskDialogOpen, setTaskDialogOpen] = useState(false);
    const [editingTaskId, setEditingTaskId] = useState<Id<"aufgabe"> | null>(null);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskStart, setTaskStart] = useState("");
    const [taskEnd, setTaskEnd] = useState("");
    const [taskStatus, setTaskStatus] = useState<TaskStatus>("offen");
    const [taskAssignees, setTaskAssignees] = useState<Id<"mitglied">[]>([]);
    const [taskDependencies, setTaskDependencies] = useState<Id<"aufgabe">[]>([]);

    useEffect(() => {
        if (!overview?.accessibleLists.length) {
            setSelectedListId(null);
            return;
        }

        if (!selectedListId || !overview.accessibleLists.some((liste) => liste._id === selectedListId)) {
            setSelectedListId(overview.accessibleLists[0]._id);
        }
    }, [overview, selectedListId]);

    const availableListMemberOptions = useMemo(() => {
        if (!availableMembers) {
            return [];
        }

        const selectedIds = new Set(listMembers.map((member) => member.mitgliedId));
        return availableMembers
            .filter((mitglied) => !selectedIds.has(mitglied._id))
            .map((mitglied) => ({
                value: mitglied._id,
                label: mitglied.name,
                description: mitglied.email,
            }));
    }, [availableMembers, listMembers]);

    const availableTaskAssigneeOptions = useMemo(() => {
        if (!listDetails) {
            return [];
        }

        const selectedIds = new Set(taskAssignees);
        return listDetails.members
            .filter((mitglied) => !selectedIds.has(mitglied.mitgliedId))
            .map((mitglied) => ({
                value: mitglied.mitgliedId,
                label: mitglied.name,
                description: `${mitglied.email} · ${getRoleLabel(mitglied.rolle)}`,
            }));
    }, [listDetails, taskAssignees]);

    const availableDependencyOptions = useMemo(() => {
        if (!listDetails) {
            return [];
        }

        const selectedIds = new Set(taskDependencies);
        return listDetails.tasks
            .filter((task) => !selectedIds.has(task._id) && (!editingTaskId || task._id !== editingTaskId))
            .map((task) => ({
                value: task._id,
                label: task.titel,
                description: getStatusLabel(task.status),
            }));
    }, [editingTaskId, listDetails, taskDependencies]);

    const selectedTaskAssignees = useMemo(() => {
        if (!listDetails) {
            return [];
        }

        const selectedIds = new Set(taskAssignees);
        return listDetails.members.filter((mitglied) => selectedIds.has(mitglied.mitgliedId));
    }, [listDetails, taskAssignees]);

    const selectedTaskDependencies = useMemo(() => {
        if (!listDetails) {
            return [];
        }

        const selectedIds = new Set(taskDependencies);
        return listDetails.tasks.filter((task) => selectedIds.has(task._id));
    }, [listDetails, taskDependencies]);

    const isEditingList = editingListId !== null;
    const canCreateLists = (overview?.canCreateLists ?? false) || (overview?.accessibleLists.some((liste) => liste.role === "admin") ?? false);

    const startCreateList = () => {
        setEditingListId(null);
        setListName("");
        setListDescription("");
        setListMembers([]);
        setListDialogOpen(true);
    };

    const startEditList = () => {
        if (!listDetails?.list.canManageMembers) {
            return;
        }

        setEditingListId(listDetails.list._id);
        setListName(listDetails.list.name);
        setListDescription(listDetails.list.beschreibung ?? "");
        setListMembers(
            listDetails.members.map((member) => ({
                mitgliedId: member.mitgliedId,
                rolle: member.rolle,
            })),
        );
        setListDialogOpen(true);
    };

    const toggleListMember = (mitgliedId: Id<"mitglied">, checked: boolean) => {
        setListMembers((current) => {
            if (checked) {
                if (current.some((member) => member.mitgliedId === mitgliedId)) {
                    return current;
                }

                return [...current, { mitgliedId, rolle: "mitarbeiter" }];
            }

            return current.filter((member) => member.mitgliedId !== mitgliedId);
        });
    };

    const changeListMemberRole = (mitgliedId: Id<"mitglied">, rolle: TaskRole) => {
        setListMembers((current) => current.map((member) => (member.mitgliedId === mitgliedId ? { ...member, rolle } : member)));
    };

    const startCreateTask = () => {
        if (!listDetails?.list.canCreateTasks) {
            return;
        }

        setEditingTaskId(null);
        setTaskTitle("");
        setTaskDescription("");
        setTaskStart("");
        setTaskEnd("");
        setTaskStatus("offen");
        setTaskAssignees([]);
        setTaskDependencies([]);
        setTaskDialogOpen(true);
    };

    const startEditTask = (taskId: Id<"aufgabe">) => {
        const task = listDetails?.tasks.find((item) => item._id === taskId);
        if (!task || !task.canEdit) {
            return;
        }

        setEditingTaskId(taskId);
        setTaskTitle(task.titel);
        setTaskDescription(task.beschreibung ?? "");
        setTaskStart(task.start ?? "");
        setTaskEnd(task.ende ?? "");
        setTaskStatus(task.status);
        setTaskAssignees(task.zustaendige);
        setTaskDependencies(task.abhaengigkeiten);
        setTaskDialogOpen(true);
    };

    const toggleTaskAssignee = (mitgliedId: Id<"mitglied">, checked: boolean) => {
        setTaskAssignees((current) => {
            if (checked) {
                return Array.from(new Set([...current, mitgliedId]));
            }

            return current.filter((id) => id !== mitgliedId);
        });
    };

    const toggleTaskDependency = (taskId: Id<"aufgabe">, checked: boolean) => {
        setTaskDependencies((current) => {
            if (checked) {
                return Array.from(new Set([...current, taskId]));
            }

            return current.filter((id) => id !== taskId);
        });
    };

    const handleSaveList = async () => {
        const trimmedName = listName.trim();
        if (!trimmedName) {
            toast.error("Bitte gib einen Listennamen ein");
            return;
        }

        try {
            if (editingListId) {
                await updateList({
                    listeId: editingListId,
                    name: trimmedName,
                    beschreibung: listDescription.trim() || undefined,
                });
                await updateListMembers({
                    listeId: editingListId,
                    members: listMembers,
                });
                toast.success("Aufgabenliste aktualisiert");
            } else {
                const newListId = await createList({
                    vereinId,
                    name: trimmedName,
                    beschreibung: listDescription.trim() || undefined,
                });
                setSelectedListId(newListId);
                toast.success("Aufgabenliste erstellt");
            }

            setListDialogOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Aufgabenliste konnte nicht gespeichert werden");
        }
    };

    const handleDeleteList = async () => {
        if (!listDetails?.list.canDeleteList) {
            return;
        }

        if (!window.confirm("Aufgabenliste wirklich löschen? Alle Aufgaben gehen dabei verloren.")) {
            return;
        }

        try {
            await removeList({ listeId: listDetails.list._id });
            toast.success("Aufgabenliste gelöscht");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Aufgabenliste konnte nicht gelöscht werden");
        }
    };

    const handleSaveTask = async () => {
        if (!selectedListId) {
            return;
        }

        const trimmedTitle = taskTitle.trim();
        if (!trimmedTitle) {
            toast.error("Bitte gib einen Aufgabentitel ein");
            return;
        }

        try {
            if (editingTaskId) {
                await updateTask({
                    taskId: editingTaskId,
                    titel: trimmedTitle,
                    beschreibung: taskDescription.trim() || undefined,
                    start: taskStart || undefined,
                    ende: taskEnd || undefined,
                    status: taskStatus,
                    zustaendige: taskAssignees,
                    abhaengigkeiten: taskDependencies,
                });
                toast.success("Aufgabe aktualisiert");
            } else {
                await createTask({
                    listeId: selectedListId,
                    titel: trimmedTitle,
                    beschreibung: taskDescription.trim() || undefined,
                    start: taskStart || undefined,
                    ende: taskEnd || undefined,
                    status: taskStatus,
                    zustaendige: taskAssignees,
                    abhaengigkeiten: taskDependencies,
                });
                toast.success("Aufgabe erstellt");
            }

            setTaskDialogOpen(false);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Aufgabe konnte nicht gespeichert werden");
        }
    };

    const handleDeleteTask = async (taskId: Id<"aufgabe">) => {
        if (!window.confirm("Aufgabe wirklich löschen?")) {
            return;
        }

        try {
            await removeTask({ taskId });
            toast.success("Aufgabe gelöscht");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Aufgabe konnte nicht gelöscht werden");
        }
    };

    if (overview === undefined) {
        return <StateCard title="Aufgaben" description="Aufgabenbereich wird geladen..." />;
    }

    if (!overview.canOpenModule) {
        return <StateCard title="Kein Zugriff" description="Du bist aktuell keiner Aufgabenliste zugeordnet und kannst keine neuen Listen anlegen." />;
    }

    return (
        <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Aufgabenlisten</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{overview.totalAccessibleLists}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Listen mit Zugriff für dieses Konto</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Offene Aufgaben</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{overview.totalOpenTasks}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Über alle sichtbaren Listen hinweg</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Mir zugewiesen</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{overview.assignedOpenTasks}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Offen oder in Bearbeitung</p>
                </div>
                <div className="rounded-2xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">Anstehend</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{overview.upcomingMineCount}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Mit Datum und direkter Zuständigkeit</p>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                        <CardTitle>Aufgabenlisten</CardTitle>
                        <CardDescription>Wähle eine Liste aus, um Aufgaben, Zuständigkeiten und Abhängigkeiten zu verwalten.</CardDescription>
                    </div>
                    {canCreateLists ? (
                        <Button onClick={startCreateList}>
                            <HugeiconsIcon icon={Add01Icon} />
                            Liste erstellen
                        </Button>
                    ) : null}
                </CardHeader>
                <CardContent>
                    {overview.accessibleLists.length === 0 ? (
                        <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                            Es gibt noch keine sichtbaren Aufgabenlisten. Lege die erste Liste an, um Aufgaben zu planen.
                        </div>
                    ) : (
                        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                            {overview.accessibleLists.map((liste) => {
                                const isActive = liste._id === selectedListId;
                                return (
                                    <button
                                        key={liste._id}
                                        type="button"
                                        onClick={() => setSelectedListId(liste._id)}
                                        className={`rounded-3xl border p-5 text-left transition-colors ${isActive ? "border-primary bg-primary/5" : "bg-background hover:bg-muted/40"}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <p className="text-lg font-semibold">{liste.name}</p>
                                                <p className="text-sm text-muted-foreground">{liste.beschreibung || "Keine Beschreibung hinterlegt"}</p>
                                            </div>
                                            <Badge variant={isActive ? "default" : "outline"}>{getRoleLabel(liste.role)}</Badge>
                                        </div>
                                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Offen</p>
                                                <p className="text-lg font-semibold">{liste.openTaskCount}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Mit mir</p>
                                                <p className="text-lg font-semibold">{liste.assignedToMeCount}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Team</p>
                                                <p className="text-lg font-semibold">{liste.memberCount}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {selectedListId && listDetails ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-4">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <CardTitle>{listDetails.list.name}</CardTitle>
                                    <Badge variant="outline">{getRoleLabel(listDetails.list.role)}</Badge>
                                </div>
                                <CardDescription>{listDetails.list.beschreibung || "Diese Liste bündelt Aufgaben und Verantwortlichkeiten für ein Team oder ein Projekt."}</CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {listDetails.list.canCreateTasks ? (
                                    <Button onClick={startCreateTask}>
                                        <HugeiconsIcon icon={Add01Icon} />
                                        Aufgabe anlegen
                                    </Button>
                                ) : null}
                                {listDetails.list.canManageMembers ? (
                                    <Button variant="outline" onClick={startEditList}>
                                        <HugeiconsIcon icon={Edit02Icon} />
                                        Liste verwalten
                                    </Button>
                                ) : null}
                                {listDetails.list.canDeleteList ? (
                                    <Button variant="destructive" onClick={handleDeleteList}>
                                        <HugeiconsIcon icon={Delete02Icon} />
                                        Löschen
                                    </Button>
                                ) : null}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {listDetails.tasks.length === 0 ? (
                                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">In dieser Liste gibt es noch keine Aufgaben.</div>
                            ) : (
                                listDetails.tasks.map((task) => (
                                    <div key={task._id} className="rounded-3xl border p-5 space-y-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-lg font-semibold">{task.titel}</p>
                                                    <Badge variant={getStatusVariant(task.status)}>{getStatusLabel(task.status)}</Badge>
                                                    {task.isAssignedToMe ? <Badge variant="secondary">Mir zugewiesen</Badge> : null}
                                                </div>
                                                <p className="text-sm text-muted-foreground">{task.beschreibung || "Keine Beschreibung hinterlegt"}</p>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {task.canEdit ? (
                                                    <Button size="sm" variant="outline" onClick={() => startEditTask(task._id)}>
                                                        Bearbeiten
                                                    </Button>
                                                ) : null}
                                                {task.canDelete ? (
                                                    <Button size="sm" variant="destructive" onClick={() => handleDeleteTask(task._id)}>
                                                        Löschen
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </div>

                                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                            <div className="rounded-2xl border p-3">
                                                <p className="text-sm text-muted-foreground">Start</p>
                                                <p className="mt-1 font-medium">{formatDate(task.start)}</p>
                                            </div>
                                            <div className="rounded-2xl border p-3">
                                                <p className="text-sm text-muted-foreground">Ende</p>
                                                <p className="mt-1 font-medium">{formatDate(task.ende)}</p>
                                            </div>
                                            <div className="rounded-2xl border p-3 md:col-span-2">
                                                <p className="text-sm text-muted-foreground">Zuständige</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {task.zustaendigeNamen.length === 0 ? (
                                                        <span className="text-sm text-muted-foreground">Noch niemand zugeordnet</span>
                                                    ) : (
                                                        task.zustaendigeNamen.map((name) => (
                                                            <Badge key={name} variant="secondary">
                                                                {name}
                                                            </Badge>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {task.dependencies.length > 0 ? (
                                            <div className="rounded-2xl border p-4">
                                                <p className="text-sm text-muted-foreground">Abhängigkeiten</p>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    {task.dependencies.map((dependency) => (
                                                        <Badge key={dependency._id} variant="outline">
                                                            {dependency.titel}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Team der Liste</CardTitle>
                                <CardDescription>Alle Personen der Liste sehen alle Aufgaben. Mitarbeiter dürfen nur eigene Aufgaben bearbeiten.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {listDetails.members.map((member) => (
                                    <div key={member.mitgliedId} className="flex items-center justify-between gap-3 rounded-2xl border p-4">
                                        <div>
                                            <p className="font-medium">{member.name}</p>
                                            <p className="text-sm text-muted-foreground">{member.email}</p>
                                        </div>
                                        <Badge variant="outline">{getRoleLabel(member.rolle)}</Badge>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Meine anstehenden Aufgaben</CardTitle>
                                <CardDescription>Direkter Blick auf Aufgaben mit Termin aus allen sichtbaren Listen.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {overview.upcomingMine.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Aktuell stehen für dich keine termingebundenen Aufgaben an.</div>
                                ) : (
                                    overview.upcomingMine.map((task) => (
                                        <button
                                            key={task._id}
                                            type="button"
                                            className="w-full rounded-2xl border p-4 text-left transition-colors hover:bg-muted/40"
                                            onClick={() => setSelectedListId(task.listeId)}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-medium">{task.titel}</p>
                                                    <p className="text-sm text-muted-foreground">{task.listeName}</p>
                                                </div>
                                                <Badge variant={getStatusVariant(task.status)}>{getStatusLabel(task.status)}</Badge>
                                            </div>
                                            <p className="mt-3 text-sm text-muted-foreground">{task.ende ? `Fällig ${formatDate(task.ende)}` : `Start ${formatDate(task.start)}`}</p>
                                        </button>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            ) : null}

            <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{isEditingList ? "Aufgabenliste bearbeiten" : "Neue Aufgabenliste"}</DialogTitle>
                        <DialogDescription>
                            {isEditingList
                                ? "Admins verwalten Personen der Liste. Bearbeiter dürfen alle Aufgaben bearbeiten, Mitarbeiter nur eigene."
                                : "Beim Anlegen wirst du automatisch als erster Admin hinzugefügt. Weitere Personen kannst du direkt nach der Erstellung ergänzen."}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="task-list-name">Name</Label>
                            <Input id="task-list-name" value={listName} onChange={(event) => setListName(event.target.value)} placeholder="z.B. Sommerfest 2026" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="task-list-description">Beschreibung</Label>
                            <Textarea
                                id="task-list-description"
                                value={listDescription}
                                onChange={(event) => setListDescription(event.target.value)}
                                placeholder="Wofür wird diese Aufgabenliste genutzt?"
                            />
                        </div>

                        {isEditingList ? (
                            <div className="grid gap-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <Label>Personen & Rollen</Label>
                                        <p className="text-sm text-muted-foreground">Mindestens eine Person muss Admin der Liste sein.</p>
                                    </div>
                                    <SearchableDropdown
                                        buttonLabel="Person hinzufügen"
                                        placeholder="Person auswählen"
                                        searchPlaceholder="Person suchen"
                                        emptyLabel="Keine passende Person gefunden"
                                        options={availableListMemberOptions}
                                        onSelect={(value) => toggleListMember(value as Id<"mitglied">, true)}
                                        disabled={availableListMemberOptions.length === 0}
                                    />
                                </div>

                                {listMembers.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Noch keine weiteren Personen hinzugefügt.</div>
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {listMembers.map((member) => {
                                            const mitglied = availableMembers?.find((entry) => entry._id === member.mitgliedId);
                                            if (!mitglied) {
                                                return null;
                                            }

                                            return (
                                                <div key={mitglied._id} className="rounded-2xl border p-4 space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-medium">{mitglied.name}</p>
                                                            <p className="text-sm text-muted-foreground truncate">{mitglied.email}</p>
                                                        </div>
                                                        <Button size="sm" variant="ghost" onClick={() => toggleListMember(mitglied._id, false)}>
                                                            Entfernen
                                                        </Button>
                                                    </div>

                                                    <Select value={member.rolle} onValueChange={(value) => changeListMemberRole(mitglied._id, value as TaskRole)}>
                                                        <SelectTrigger className="w-full">
                                                            <SelectValue placeholder="Rolle wählen" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {ROLE_OPTIONS.map((option) => (
                                                                <SelectItem key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                                Nach dem Speichern bist du automatisch als erster Admin in der Liste. Weitere Personen und Rollen kannst du danach über „Liste verwalten“ ergänzen.
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button onClick={handleSaveList}>Speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingTaskId ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</DialogTitle>
                        <DialogDescription>Lege Termin, Abhängigkeiten und verantwortliche Personen für die Aufgabe fest.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6">
                        <div className="grid gap-2">
                            <Label htmlFor="task-title">Titel</Label>
                            <Input id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="z.B. Helferplan finalisieren" />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="task-description">Beschreibung</Label>
                            <Textarea
                                id="task-description"
                                value={taskDescription}
                                onChange={(event) => setTaskDescription(event.target.value)}
                                placeholder="Was ist zu tun, welche Infos sind wichtig?"
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="grid gap-2">
                                <Label htmlFor="task-start">Start</Label>
                                <Input id="task-start" type="date" value={taskStart} onChange={(event) => setTaskStart(event.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="task-end">Ende</Label>
                                <Input id="task-end" type="date" value={taskEnd} onChange={(event) => setTaskEnd(event.target.value)} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Status</Label>
                                <Select value={taskStatus} onValueChange={(value) => setTaskStatus(value as TaskStatus)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Status wählen" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {STATUS_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <Label>Zuständige</Label>
                                        <p className="text-sm text-muted-foreground">Diese Personen dürfen die Aufgabe mindestens bearbeiten.</p>
                                    </div>
                                    <SearchableDropdown
                                        buttonLabel="Person auswählen"
                                        placeholder="Person auswählen"
                                        searchPlaceholder="Person suchen"
                                        emptyLabel="Keine weitere Person verfügbar"
                                        options={availableTaskAssigneeOptions}
                                        onSelect={(value) => toggleTaskAssignee(value as Id<"mitglied">, true)}
                                        disabled={availableTaskAssigneeOptions.length === 0}
                                    />
                                </div>
                                {selectedTaskAssignees.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Noch keine zuständige Person ausgewählt.</div>
                                ) : (
                                    <div className="grid gap-3 max-h-80 overflow-y-auto pr-1">
                                        {selectedTaskAssignees.map((mitglied) => (
                                            <div key={mitglied.mitgliedId} className="flex items-start justify-between gap-3 rounded-2xl border p-4">
                                                <span className="min-w-0 flex-1">
                                                    <span className="block font-medium">{mitglied.name}</span>
                                                    <span className="block truncate text-sm text-muted-foreground">{mitglied.email}</span>
                                                </span>
                                                <Button size="sm" variant="ghost" onClick={() => toggleTaskAssignee(mitglied.mitgliedId, false)}>
                                                    Entfernen
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <Label>Abhängigkeiten</Label>
                                        <p className="text-sm text-muted-foreground">Aufgaben, die vorher abgeschlossen sein sollten.</p>
                                    </div>
                                    <SearchableDropdown
                                        buttonLabel="Aufgabe auswählen"
                                        placeholder="Aufgabe auswählen"
                                        searchPlaceholder="Aufgabe suchen"
                                        emptyLabel="Keine weitere Aufgabe verfügbar"
                                        options={availableDependencyOptions}
                                        onSelect={(value) => toggleTaskDependency(value as Id<"aufgabe">, true)}
                                        disabled={availableDependencyOptions.length === 0}
                                    />
                                </div>
                                {selectedTaskDependencies.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Keine Abhängigkeiten ausgewählt.</div>
                                ) : (
                                    <div className="grid gap-3 max-h-80 overflow-y-auto pr-1">
                                        {selectedTaskDependencies.map((task) => (
                                            <div key={task._id} className="flex items-start justify-between gap-3 rounded-2xl border p-4">
                                                <span className="min-w-0 flex-1">
                                                    <span className="block font-medium">{task.titel}</span>
                                                    <span className="block text-sm text-muted-foreground">{getStatusLabel(task.status)}</span>
                                                </span>
                                                <Button size="sm" variant="ghost" onClick={() => toggleTaskDependency(task._id, false)}>
                                                    Entfernen
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button onClick={handleSaveTask}>Speichern</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
