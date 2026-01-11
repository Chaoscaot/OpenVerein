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
import { ChevronRight, DashboardBrowsingIcon, Person } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";

export async function AppSidebar({ id }: { id: string }) {
    const token = await getToken();
    const activeVerein = await fetchQuery(api.verein.get, { id: id as Id<"verein"> }, { token });

    return (
        <Sidebar collapsible="icon" className="border-r-0!" variant="inset">
            <SidebarHeader>
                <VereinSwitcher activeVerein={activeVerein} />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Verein</SidebarGroupLabel>
                    <SidebarMenu>
                        <Link href={`/verein/${id}`}>
                            <SidebarMenuButton tooltip={"Verein Dashboard"}>
                                <HugeiconsIcon icon={DashboardBrowsingIcon} />
                                <span>Dashboard</span>
                            </SidebarMenuButton>
                        </Link>
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
                                        <SidebarMenuSubItem>
                                            <SidebarMenuSubButton asChild>
                                                <Link href={`/verein/${id}/mitglieder`}>
                                                    <span>Mitglieder</span>
                                                </Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                        <SidebarMenuSubItem>
                                            <SidebarMenuSubButton asChild>
                                                <Link href={`/verein/${id}/mitglieder/neu`}>
                                                    <span>Person Anlegen</span>
                                                </Link>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </SidebarMenuItem>
                        </Collapsible>
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <UserComponent sidebar />
            </SidebarFooter>
        </Sidebar>
    );
}
