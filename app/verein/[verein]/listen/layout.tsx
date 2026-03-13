import { SiteHeader } from "@/components/verein/nav/SiteHeader";

export default async function ListenLayout({ children, params }: { children: React.ReactNode; params: Promise<{ verein: string }> }) {
    const { verein } = await params;

    return (
        <>
            <SiteHeader title="Listen & Mail"></SiteHeader>
            <div className="p-4 space-y-4">{children}</div>
        </>
    );
}
