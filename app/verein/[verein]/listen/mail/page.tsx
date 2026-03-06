import { MailSender } from "@/components/verein/ListenMailManager";
import { Id } from "@/convex/_generated/dataModel";

export default async function ListenMailPage({ params }: { params: Promise<{ verein: string }> }) {
    const { verein } = await params;

    return <MailSender vereinId={verein as Id<"verein">} />;
}
