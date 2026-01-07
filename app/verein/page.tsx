import { AuthLinks } from "@/components/nav/AuthLinks";
import { UserComponent } from "@/components/UserComponent";
import { VereinsListe } from "@/components/verein/VereinsListe";
import { api } from "@/convex/_generated/api";
import { preloadAuthQuery } from "@/lib/auth-server";
import Link from "next/link";

export default async function VereinHomePage() {
    const list = await preloadAuthQuery(api.verein.list);

    return (
        <>
            <nav className="h-12 flex items-center px-4 border-b">
                <Link href={"/"}>
                    <span className="font-bold text-2xl">OpenVerein</span>
                </Link>
                <div className="ml-auto flex gap-2">
                    <UserComponent dropdown={{ side: "bottom" }} />
                </div>
            </nav>
            <main>
                <VereinsListe preload={list} />
            </main>
        </>
    );
}
