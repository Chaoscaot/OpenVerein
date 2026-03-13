"use client";

import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export function BeitragssatzSelector({
  verein,
  vereinId,
  value,
  onChange,
}: {
  verein?: Doc<"verein">;
  vereinId?: Id<"verein">;
  value?: Id<"beitrags_satz">;
  onChange?: (id: Id<"beitrags_satz"> | undefined) => void;
}) {
  const resolvedVereinId = vereinId ?? verein?._id;
  const beitragssaetze = useQuery(
    api.beitragssatz.list,
    resolvedVereinId ? { vereinId: resolvedVereinId } : "skip",
  );

  return (
    <Select
      value={value}
      onValueChange={(val) => onChange && onChange(val as Id<"beitrags_satz">)}
    >
      <SelectTrigger
        className="w-full"
        disabled={beitragssaetze === undefined || beitragssaetze.length === 0}
      >
        <SelectValue placeholder="Beitragssatz wählen..." />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {beitragssaetze?.map((bs) => (
            <SelectItem key={bs._id} value={bs._id}>
              {bs.name} - {bs.betrag} {bs.waehrung}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
