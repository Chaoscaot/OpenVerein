"use client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronsUpDown, Plus } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { Doc } from "@/convex/_generated/dataModel";
import Image from "next/image";
import Link from "next/link";

export function VereinSwitcher({
  activeVerein,
}: {
  activeVerein: Doc<"verein">;
}) {
  const { isMobile } = useSidebar();
  const vereine = useQuery(api.verein.list);
  const router = useRouter();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Image
                  src={"/icon.svg"}
                  width={24}
                  height={24}
                  alt="Verein Logo"
                  className="shrink-0"
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeVerein.name}
                </span>
                <span className="truncate text-xs">{activeVerein.owner}</span>
              </div>
              <HugeiconsIcon icon={ChevronsUpDown} />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Vereine
            </DropdownMenuLabel>
            {vereine?.map((verein, index) => (
              <Link key={verein.name} href={`/verein/${verein._id}`}>
                <DropdownMenuItem className="gap-2 p-2">
                  <div className="flex size-6 items-center justify-center rounded-md border">
                    <Image
                      src={"/icon.svg"}
                      width={24}
                      height={24}
                      alt="Verein Logo"
                      className="size-3.5 shrink-0"
                    />
                  </div>
                  {verein.name}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </DropdownMenuItem>
              </Link>
            ))}
            <DropdownMenuSeparator />
            <Link href={"/verein/new"}>
              <DropdownMenuItem className="gap-2 p-2">
                <div className="flex size-6 items-center justify-center rounded-md border bg-transparent">
                  <HugeiconsIcon icon={Plus} className="size-3.5 shrink-0" />
                </div>
                <div className="text-muted-foreground font-medium">
                  Verein Erstellen
                </div>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
