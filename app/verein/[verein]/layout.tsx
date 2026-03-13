import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/verein/nav/AppSideBar";
import { SiteHeader } from "@/components/verein/nav/SiteHeader";

export default async function VereinLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ verein: string }>;
}) {
  const { verein } = await params;

  return (
    <SidebarProvider
      className="bg-sidebar"
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar id={verein} />
      <SidebarInset className="rounded-2xl m-0.5">
        <div>{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
