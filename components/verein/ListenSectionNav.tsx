"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Id } from "@/convex/_generated/dataModel";

export function ListenSectionNav({ vereinId, canManageLists, canSendMail }: { vereinId: Id<"verein">; canManageLists: boolean; canSendMail: boolean }) {
    const pathname = usePathname();

    const items = [
        {
            href: `/verein/${vereinId}/listen`,
            label: "Übersicht",
            visible: true,
        },
        {
            href: `/verein/${vereinId}/listen/verwaltung`,
            label: "Listenverwaltung",
            visible: canManageLists,
        },
        {
            href: `/verein/${vereinId}/listen/mail`,
            label: "Mailversand",
            visible: canSendMail,
        },
    ].filter((item) => item.visible);

    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item) => {
                const active = pathname === item.href;

                return (
                    <Link key={item.href} href={item.href}>
                        <Button variant={active ? "default" : "outline"}>{item.label}</Button>
                    </Link>
                );
            })}
        </div>
    );
}
