import { AuthLinks } from "@/components/nav/AuthLinks";

export default function Home({ children }: { children: React.ReactNode }) {
    return (
        <div>
            <nav className="h-12 flex items-center px-4">
                <span className="font-bold text-2xl">OpenVerein</span>
                <div className="ml-auto flex gap-2">
                    <AuthLinks />
                </div>
            </nav>
            <main>{children}</main>
        </div>
    );
}
