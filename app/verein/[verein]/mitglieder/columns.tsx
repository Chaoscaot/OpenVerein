"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon, PencilEdit01Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";

function ActionsCell({ row }: { row: any }) {
    const deleteMember = useMutation(api.mitglieder.remove);
    const router = useRouter();
    const member = row.original;

    const handleDelete = async () => {
        if (confirm(`Möchten Sie das Mitglied ${member.vorname} ${member.nachname} wirklich löschen?`)) {
            try {
                await deleteMember({ id: member._id });
                toast.success("Mitglied erfolgreich gelöscht");
            } catch (error) {
                toast.error("Fehler beim Löschen des Mitglieds");
            }
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Menü öffnen</span>
                    <HugeiconsIcon icon={MoreHorizontalIcon} className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Aktionen</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push(`/verein/${member.vereinId}/mitglieder/${member._id}`)}>
                    <HugeiconsIcon icon={PencilEdit01Icon} className="mr-2 h-4 w-4" />
                    Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                    <HugeiconsIcon icon={Delete02Icon} className="mr-2 h-4 w-4" />
                    Löschen
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const typLabels: Record<string, string> = {
    bewerber: "Bewerber",
    mitglied: "Mitglied",
    fördermitglied: "Fördermitglied",
    kontakt: "Kontakt",
    ausgeschieden: "Ausgeschieden",
};

export const columns: ColumnDef<Doc<"mitglied">>[] = [
    {
        accessorKey: "nummer",
        header: "Nr.",
    },
    {
        accessorKey: "vorname",
        header: "Vorname",
    },
    {
        accessorKey: "nachname",
        header: "Nachname",
    },
    {
        accessorKey: "kontakt.email",
        header: "E-Mail",
        cell: ({ row }) => row.original.kontakt.email,
    },
    {
        accessorKey: "kontakt.phone",
        header: "Telefon",
        cell: ({ row }) => row.original.kontakt.phone || "-",
    },
    {
        accessorKey: "anschrift.city",
        header: "Ort",
        cell: ({ row }) => row.original.anschrift.city,
    },
    {
        accessorKey: "typ",
        header: "Typ",
        cell: ({ row }) => <Badge variant={row.original.typ === "mitglied" ? "default" : "secondary"}>{typLabels[row.original.typ]}</Badge>,
    },
    {
        id: "actions",
        cell: ({ row }) => <ActionsCell row={row} />,
    },
];
