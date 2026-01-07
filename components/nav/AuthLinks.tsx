"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import Link from "next/link";
import { Button } from "../ui/button";
import { UserComponent } from "../UserComponent";

export function AuthLinks() {
    return (
        <>
            <Authenticated>
                <Link href={"/verein"}>
                    <Button>Vereine</Button>
                </Link>
                <UserComponent dropdown={{ side: "bottom" }} />
            </Authenticated>
            <Unauthenticated>
                <Link href={"/login"}>
                    <Button variant="secondary">Anmelden</Button>
                </Link>
                <Link href={"/signup"}>
                    <Button>Registrieren</Button>
                </Link>
            </Unauthenticated>
        </>
    );
}
