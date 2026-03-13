"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";
import { useState } from "react";
import { SEPA } from "better-sepa";
import { SEPA_FORMATS } from "better-sepa/dist/constants";
import {
  CreditTransfer,
  CreditTransferPayment,
} from "better-sepa/dist/types/types";

export function SepaExportButton({ vereinId }: { vereinId: Id<"verein"> }) {
  const [isExporting, setIsExporting] = useState(false);
  const verein = useQuery(api.verein.get, { id: vereinId });
  const members = useQuery(api.sepa.getMembersWithSepaMandate, { vereinId });

  const handleExport = async () => {
    if (!verein || !members || members.length === 0) {
      toast.error("Keine Mitglieder mit SEPA-Mandat gefunden");
      return;
    }

    setIsExporting(true);
    try {
      const payments: CreditTransferPayment[] = members
        .filter((member) => member.sepaMandat && member.beitragssatz)
        .map((member) => ({
          recipientIBAN: member.sepaMandat!.iban,
          recipientBIC: member.sepaMandat!.bic,
          recipientName: `${member.vorname} ${member.nachname}`,
          end2endReference: `Mitgliedsbeitrag ${member.beitragssatz!.name}`,
          amount: member.beitragssatz!.betrag,
          reference: `MANDATE-${member._id}`,
        }));

      if (!verein.sepa?.iban || !verein.sepa?.bic) {
        toast.error(
          "Bitte hinterlegen Sie die SEPA-Daten des Vereins in den Einstellungen",
        );
        return;
      }

      const directDebit: CreditTransfer = {
        documentId: `SEPA-${Date.now()}`,
        documentCreationDate: new Date(),
        requestedExecutionDate: new Date(),
        batchBooking: true,
        payments: payments,
        initiatorBIC: verein.sepa.bic,
        initiatorName: verein.name,
        initiatorIBAN: verein.sepa.iban,
      };

      const [xml, json] = new SEPA(
        SEPA_FORMATS["PAIN.001.001.03"],
      ).generateDocument(directDebit);

      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sepa-lastschrift-${new Date().toISOString().split("T")[0]}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(
        `SEPA-XML mit ${payments.length} Lastschriften erfolgreich exportiert`,
      );
    } catch (error) {
      toast.error("Fehler beim Exportieren der SEPA-XML");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const disabled = isExporting || !verein || !members || members.length === 0;

  return (
    <Button
      onClick={handleExport}
      disabled={disabled}
      variant="outline"
      size="sm"
    >
      <HugeiconsIcon icon={Download01Icon} className="mr-2 h-4 w-4" />
      SEPA-XML Export {members && members.length > 0 && `(${members.length})`}
    </Button>
  );
}
