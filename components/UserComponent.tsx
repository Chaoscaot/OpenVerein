"use client";

import { ChevronsUpDown, Sparkles, BadgeCheck, CreditCard, Bell, LogOut } from "@hugeicons/core-free-icons";
import { DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup, DropdownMenuItem, DropdownMenu } from "./ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "./ui/avatar";
import { HugeiconsIcon } from "@hugeicons/react";
import { useIsMobile } from "@/hooks/use-mobile";
import { authClient } from "@/lib/auth-client";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import type { User } from "better-auth";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";

function User({ user }: { user: User }) {
    return (
        <>
            <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.image ?? ""} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs">{user.email}</span>
            </div>
            <HugeiconsIcon icon={ChevronsUpDown} className="ml-auto size-4" />
        </>
    );
}

export function UserComponent({ dropdown, sidebar = false }: { dropdown?: React.ComponentProps<typeof DropdownMenuContent>; sidebar?: boolean }) {
    return sidebar ? (
        <SidebarMenu>
            <InternalUserComponent dropdown={dropdown} sidebar={sidebar} />
        </SidebarMenu>
    ) : (
        <InternalUserComponent dropdown={dropdown} sidebar={sidebar} />
    );
}

function InternalUserComponent({ dropdown, sidebar = false }: { dropdown?: React.ComponentProps<typeof DropdownMenuContent>; sidebar?: boolean }) {
    const isMobile = useIsMobile();
    const router = useRouter();
    const { data } = authClient.useSession();

    if (!data) {
        return null;
    }

    const user = data.user;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {sidebar ? (
                    <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                        <User user={user} />
                    </SidebarMenuButton>
                ) : (
                    <Button variant="ghost" size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                        <User user={user} />
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4} {...dropdown}>
                <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                        <Avatar className="h-8 w-8 rounded-lg">
                            <AvatarImage src={user.image ?? ""} alt={user.name} />
                            <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                        </Avatar>
                        <div className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">{user.name}</span>
                            <span className="truncate text-xs">{user.email}</span>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={Sparkles} className="size-4" />
                        Premium aktivieren
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={BadgeCheck} className="size-4" />
                        Konto
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={CreditCard} className="size-4" />
                        Rechnungen
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <HugeiconsIcon icon={Bell} className="size-4" />
                        Benachrichtigungen
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.replace("/") } })}>
                    <HugeiconsIcon icon={LogOut} className="size-4" />
                    Abmelden
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
