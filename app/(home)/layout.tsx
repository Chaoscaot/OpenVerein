import { AuthLinks } from "@/components/nav/AuthLinks";

export default function Home({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <nav className="sticky top-0 z-50 h-14 flex items-center px-6 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <span className="font-extrabold text-xl tracking-tight">
                    Open<span className="text-primary">Verein</span>
                </span>
                <div className="ml-auto flex gap-2">
                    <AuthLinks />
                </div>
            </nav>
            <main>{children}</main>
        </div>
    );
}
