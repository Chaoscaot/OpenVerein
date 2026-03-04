"use client";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import Link from "next/link";
import { Button } from "../ui/button";
import { UserComponent } from "../UserComponent";
import { Suspense } from "react";

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
                <UnauthenticatedLinks />
            </Unauthenticated>
            <AuthLoading>
                <UnauthenticatedLinks />
            </AuthLoading>
        </>
    );
}

function UnauthenticatedLinks() {
    return (
        <>
            <Link href={"/login"}>
                <Button variant="secondary">Anmelden</Button>
            </Link>
            <Link href={"/signup"}>
                <Button>Registrieren</Button>
            </Link>
        </>
    );
}
