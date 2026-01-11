"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { ColumnDef } from "@tanstack/react-table";

export const columns: ColumnDef<Doc<"mitglied">>[] = [
    {
        accessorKey: "nummer",
        header: "Mitgliedsnummer",
    },
    {
        accessorKey: "vorname",
        header: "Vorname",
    },
    {
        accessorKey: "nachname",
        header: "Nachname",
    },
];
