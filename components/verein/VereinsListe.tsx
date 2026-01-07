"use client";

import { api } from "@/convex/_generated/api";
import { Preloaded, usePreloadedQuery } from "convex/react";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../ui/empty";
import { HugeiconsIcon } from "@hugeicons/react";
import { FolderLibraryIcon } from "@hugeicons/core-free-icons";
import { Button } from "../ui/button";
import Link from "next/link";
import { Card, CardHeader, CardTitle } from "../ui/card";

export function VereinsListe({ preload }: { preload: Preloaded<typeof api.verein.list> }) {
    const vereine = usePreloadedQuery(preload);

    if (vereine.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={FolderLibraryIcon} />
                    </EmptyMedia>
                    <EmptyTitle>Keine Vereine gefunden</EmptyTitle>
                    <EmptyDescription>Es wurden noch keine Vereine erstellt. Klicke auf "Verein erstellen", um einen neuen Verein zu erstellen.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                    <div className="flex gap-2">
                        <Link href={"/verein/new"}>
                            <Button>Verein erstellen</Button>
                        </Link>
                        <Button variant="secondary">Verein beitreten</Button>
                    </div>
                </EmptyContent>
            </Empty>
        );
    }

    return (
        <div className="p-8">
            <div className="flex justify-end items-center">
                <Link href={"/verein/new"}>
                    <Button>Verein erstellen</Button>
                </Link>
            </div>
            <div className="pt-2 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {vereine.map((verein) => (
                    <Link href={`/verein/${verein._id}`}>
                        <Card>
                            <CardHeader>
                                <CardTitle>{verein.name}</CardTitle>
                            </CardHeader>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
