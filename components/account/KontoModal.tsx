"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { KontoPageContent } from "@/components/account/KontoPageContent";

export function KontoModal() {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={(open) => (!open ? router.back() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto p-6 sm:max-w-6xl sm:p-8">
        <DialogTitle className="sr-only">Konto</DialogTitle>
        <DialogDescription className="sr-only">
          Verwalte dein Konto und deine App-Einstellungen.
        </DialogDescription>
        <KontoPageContent modal />
      </DialogContent>
    </Dialog>
  );
}
