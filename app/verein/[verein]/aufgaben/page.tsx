import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { AufgabenManager } from "@/components/verein/AufgabenManager";
import { Id } from "@/convex/_generated/dataModel";

export default async function AufgabenPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;

    return (
        <>
            <SiteHeader title="Aufgaben" />
            <div className="p-4">
                <AufgabenManager vereinId={verein as Id<"verein">} />
            </div>
        </>
    );
}
