import { ListenManager } from "@/components/verein/ListenMailManager";
import { Id } from "@/convex/_generated/dataModel";

export default async function ListenVerwaltungPage({
  params,
}: {
  params: Promise<{ verein: string }>;
}) {
  const { verein } = await params;

  return <ListenManager vereinId={verein as Id<"verein">} />;
}
