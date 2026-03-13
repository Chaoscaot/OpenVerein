import { SiteHeader } from "@/components/verein/nav/SiteHeader";
import { ListenSectionNav } from "@/components/verein/ListenSectionNav";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { fetchAuthQuery } from "@/lib/auth-server";

export default async function ListenLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ verein: string }>;
}) {
  const { verein } = await params;
  const acl = await fetchAuthQuery(api.permissions.getMyPermissions, {
    vereinId: verein as Id<"verein">,
  });
  const permissionSet = new Set(acl.permissions);

  const canManageLists =
    permissionSet.has("liste.view") ||
    permissionSet.has("liste.manage") ||
    permissionSet.has("mitglied.view");
  const canSendMail = permissionSet.has("mail.send");

  return (
    <>
      <SiteHeader title="Kommunikation"></SiteHeader>
      <div className="p-4 space-y-4">
        <ListenSectionNav
          vereinId={verein as Id<"verein">}
          canManageLists={canManageLists}
          canSendMail={canSendMail}
        />
        {children}
      </div>
    </>
  );
}
