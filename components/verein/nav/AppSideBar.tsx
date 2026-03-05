import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { VereinSwitcher } from "./VereinSwitcher";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { getToken } from "@/lib/auth-server";
import { Id } from "@/convex/_generated/dataModel";
import { UserComponent } from "@/components/UserComponent";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, DashboardBrowsingIcon, Person, Settings, Coins } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

export async function AppSidebar({ id }: { id: string }) {
    const token = await getToken();
    const activeVerein = await fetchQuery(api.verein.get, { id: id as Id<"verein"> }, { token });
    const acl = await fetchQuery(api.permissions.getMyPermissions, { vereinId: id as Id<"verein"> }, { token });
    const permissionSet = new Set(acl.permissions);

    const canDashboard = permissionSet.has("dashboard.view") || permissionSet.has("verein.view");
    const canMitgliederSection = permissionSet.has("mitglied.view") || permissionSet.has("mitglied.create");
    const canMitgliederList = permissionSet.has("mitglied.view");
    const canMitgliederCreate = permissionSet.has("mitglied.create");
    const canFinanzenSection = permissionSet.has("finanzen.view") || permissionSet.has("kasse.view") || permissionSet.has("buchung.view") || permissionSet.has("beitragssatz.view");
    const canKassen = permissionSet.has("kasse.view") || permissionSet.has("buchung.view");
    const canBeitragssaetze = permissionSet.has("beitragssatz.view");
    const canRollen = permissionSet.has("rolle.view") || permissionSet.has("rolle.manage");
    const canSettings = permissionSet.has("settings.view");

    return (
        <Sidebar collapsible="icon" className="border-r-0!" variant="inset">
            <SidebarHeader>
                <VereinSwitcher activeVerein={activeVerein} />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Verein</SidebarGroupLabel>
                    <SidebarMenu>
                        {canDashboard && (
                            <Link href={`/verein/${id}`}>
                                <SidebarMenuButton tooltip={"Verein Dashboard"}>
                                    <HugeiconsIcon icon={DashboardBrowsingIcon} />
                                    <span>Dashboard</span>
                                </SidebarMenuButton>
                            </Link>
                        )}
                        {canMitgliederSection && (
                            <Collapsible asChild className="group/collapsible">
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton tooltip={"Mitglieder Verwaltung"}>
                                            <HugeiconsIcon icon={Person} />
                                            <span>Personen Verwaltung</span>
                                            <HugeiconsIcon icon={ChevronRight} className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {canMitgliederList && (
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton asChild>
                                                        <Link href={`/verein/${id}/mitglieder`}>
                                                            <span>Mitglieder</span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )}
                                            {canMitgliederCreate && (
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton asChild>
                                                        <Link href={`/verein/${id}/mitglieder/neu`}>
                                                            <span>Person Anlegen</span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        )}
                        {canFinanzenSection && (
                            <Collapsible asChild className="group/collapsible">
                                <SidebarMenuItem>
                                    <CollapsibleTrigger asChild>
                                        <SidebarMenuButton tooltip={"Finanzen"}>
                                            <HugeiconsIcon icon={Coins} />
                                            <span>Finanz Verwaltung</span>
                                            <HugeiconsIcon icon={ChevronRight} className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                                        </SidebarMenuButton>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {canKassen && (
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton asChild>
                                                        <Link href={`/verein/${id}/finanzen`}>
                                                            <span>Kassen</span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )}
                                            {canBeitragssaetze && (
                                                <SidebarMenuSubItem>
                                                    <SidebarMenuSubButton asChild>
                                                        <Link href={`/verein/${id}/finanzen/beitragssaetze`}>
                                                            <span>Beitragssätze</span>
                                                        </Link>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            )}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </SidebarMenuItem>
                            </Collapsible>
                        )}
                        {canSettings && (
                            <Link href={`/verein/${id}/settings`}>
                                <SidebarMenuButton tooltip={"Vereinseinstellungen"}>
                                    <HugeiconsIcon icon={Settings} />
                                    <span>Einstellungen</span>
                                </SidebarMenuButton>
                            </Link>
                        )}
                        {canRollen && (
                            <Link href={`/verein/${id}/rollen`}>
                                <SidebarMenuButton tooltip={"Rollen & Rechteverwaltung"}>
                                    <HugeiconsIcon icon={Person} />
                                    <span>Rollen & Rechte</span>
                                </SidebarMenuButton>
                            </Link>
                        )}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <UserComponent sidebar />
            </SidebarFooter>
        </Sidebar>
    );
}
