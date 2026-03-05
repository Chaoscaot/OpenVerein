import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { RollenManager } from "@/components/verein/RollenManager";
import { Id } from "@/convex/_generated/dataModel";

export default async function RollenPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;

    return (
        <>
            <SiteHeader title="Rollen & Rechte"></SiteHeader>
            <div className="p-4 space-y-4">
                <RollenManager vereinId={verein as Id<"verein">} />
            </div>
        </>
    );
}
