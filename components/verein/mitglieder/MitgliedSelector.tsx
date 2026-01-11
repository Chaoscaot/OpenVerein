import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useDebounce } from "@/lib/utils";
import { Check, ChevronDown } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "convex/react";
import { useState } from "react";

export function MitgliedSelector({ value, vereinId, onChange }: { value?: Id<"mitglied"> | undefined; vereinId: Id<"verein">; onChange?: (id: Id<"mitglied"> | undefined) => void }) {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const mitglieder = useQuery(api.mitglieder.search, { searchTerm: debouncedSearch, vereinId });
    const selectedMitglied = useQuery(api.mitglieder.get, { id: value });

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="outline" id="date" className="justify-between font-normal">
                    {selectedMitglied ? `${selectedMitglied.vorname} ${selectedMitglied.nachname}` : "Mitglied wählen"}
                    <HugeiconsIcon icon={ChevronDown} />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="p-0">
                <Command shouldFilter={false}>
                    <CommandInput placeholder="Mitglied Suchen..." className="h-9" onValueChange={setSearch} value={search} />
                    <CommandList>
                        <CommandEmpty>Nichts gefunden.</CommandEmpty>
                        <CommandGroup>
                            {mitglieder?.map((mitglied) => (
                                <CommandItem
                                    key={mitglied._id}
                                    onSelect={() => {
                                        if (onChange) {
                                            if (value === mitglied._id) {
                                                onChange(undefined);
                                            } else {
                                                onChange(mitglied._id);
                                            }
                                        }
                                    }}
                                >
                                    <HugeiconsIcon icon={Check} className={`size-4 shrink-0 ${value === mitglied._id ? "opacity-100" : "opacity-0"}`} />
                                    {mitglied.vorname} {mitglied.nachname} ({mitglied.nummer})
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
