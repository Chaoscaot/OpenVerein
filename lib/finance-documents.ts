import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type FinanzDokumentTyp = "rechnung" | "spendenquittung";
export type DokumentPosition = {
    bezeichnung: string;
    menge: number;
    einzelpreis: number;
};

const TYPE_MARKER_PREFIX = "[DOKUMENT_TYP:";

function euroDate(dateIsoOrUndefined?: string) {
    if (!dateIsoOrUndefined) return "-";
    return new Date(dateIsoOrUndefined).toLocaleDateString("de-DE");
}

function escapeXml(value: string) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export function encodeDokumentKommentar(dokumentTyp: FinanzDokumentTyp, kommentar?: string) {
    const clean = (kommentar ?? "").trim();
    if (!clean) {
        return `${TYPE_MARKER_PREFIX}${dokumentTyp}]`;
    }
    return `${TYPE_MARKER_PREFIX}${dokumentTyp}] ${clean}`;
}

export function decodeDokumentKommentar(rawKommentar?: string) {
    const text = rawKommentar ?? "";
    if (!text.startsWith(TYPE_MARKER_PREFIX)) {
        return {
            dokumentTyp: "rechnung" as FinanzDokumentTyp,
            kommentar: text,
        };
    }

    const endIndex = text.indexOf("]");
    if (endIndex < 0) {
        return {
            dokumentTyp: "rechnung" as FinanzDokumentTyp,
            kommentar: text,
        };
    }

    const rawType = text.slice(TYPE_MARKER_PREFIX.length, endIndex).trim();
    const dokumentTyp: FinanzDokumentTyp = rawType === "spendenquittung" ? "spendenquittung" : "rechnung";

    return {
        dokumentTyp,
        kommentar: text.slice(endIndex + 1).trim(),
    };
}

export function berechnePositionssumme(positionen: DokumentPosition[]) {
    return positionen.reduce((sum, position) => sum + position.menge * position.einzelpreis, 0);
}

export async function generateDokumentPdf(params: {
    dokumentTyp: FinanzDokumentTyp;
    vereinName: string;
    vereinAddress: string;
    mitgliedName?: string;
    rechnungsempfaenger?: string;
    zweck: string;
    dokumentNummer?: string;
    dokumentDatumIso?: string;
    buchungsDatumIso: string;
    betrag: number;
    waehrung: string;
    positionen?: DokumentPosition[];
}) {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const empfaengerName = params.rechnungsempfaenger?.trim() || params.mitgliedName?.trim() || "-";

    // --- Color palette ---
    const primaryColor = rgb(0.13, 0.2, 0.38);
    const accentColor = rgb(0.22, 0.42, 0.68);
    const lightBg = rgb(0.95, 0.96, 0.98);
    const grayText = rgb(0.45, 0.45, 0.45);
    const darkText = rgb(0.13, 0.13, 0.13);
    const white = rgb(1, 1, 1);
    const borderGray = rgb(0.82, 0.82, 0.82);

    // --- Page dimensions ---
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const ml = 56;
    const mr = 56;
    const contentWidth = pageWidth - ml - mr;
    const rightEdge = pageWidth - mr;

    /** Right-align text helper */
    const drawTextRight = (text: string, x: number, y: number, size: number, f: typeof font, color: typeof darkText) => {
        const w = f.widthOfTextAtSize(text, size);
        page.drawText(text, { x: x - w, y, size, font: f, color });
    };

    // =============================================
    //  TOP ACCENT BAR
    // =============================================
    page.drawRectangle({ x: 0, y: pageHeight - 6, width: pageWidth, height: 6, color: primaryColor });

    // =============================================
    //  HEADER – Verein name & address (left)
    // =============================================
    let y = pageHeight - 50;
    page.drawText(params.vereinName, { x: ml, y, size: 18, font: fontBold, color: primaryColor });
    y -= 16;
    page.drawText(params.vereinAddress, { x: ml, y, size: 9, font, color: grayText });

    // =============================================
    //  HEADER – Document type title (right)
    // =============================================
    const title = params.dokumentTyp === "rechnung" ? "Rechnung" : "Spendenquittung";
    drawTextRight(title, rightEdge, pageHeight - 50, 22, fontBold, primaryColor);

    // =============================================
    //  ACCENT SEPARATOR
    // =============================================
    y -= 18;
    page.drawRectangle({ x: ml, y, width: contentWidth, height: 2, color: accentColor });

    // =============================================
    //  TWO-COLUMN INFO BLOCK
    //  Left: recipient    Right: document metadata
    // =============================================
    y -= 28;
    const metaLabelX = 360;
    const metaValueX = 465;

    // -- Recipient (left) --
    page.drawText("Empf\u00E4nger", { x: ml, y, size: 8, font, color: grayText });
    page.drawText(empfaengerName, { x: ml, y: y - 15, size: 12, font: fontBold, color: darkText });

    // -- Meta info (right) --
    const metaRows = [
        { label: "Dokumentnummer", value: params.dokumentNummer || "-" },
        { label: "Dokumentdatum", value: euroDate(params.dokumentDatumIso) },
        { label: "Buchungsdatum", value: euroDate(params.buchungsDatumIso) },
    ];
    let metaY = y;
    for (const row of metaRows) {
        page.drawText(row.label, { x: metaLabelX, y: metaY, size: 8, font, color: grayText });
        page.drawText(row.value, { x: metaValueX, y: metaY, size: 9, font: fontBold, color: darkText });
        metaY -= 16;
    }

    // -- Zweck --
    y -= 48;
    page.drawText("Zweck", { x: ml, y, size: 8, font, color: grayText });
    y -= 14;
    page.drawText(params.zweck, { x: ml, y, size: 10, font, color: darkText });

    // =============================================
    //  POSITIONS TABLE (only for Rechnung with items)
    // =============================================
    y -= 32;
    const hasPositionen = params.dokumentTyp === "rechnung" && (params.positionen?.length ?? 0) > 0;

    if (hasPositionen) {
        const rowH = 24;
        const colBez = ml + 42;
        const colMengeR = 360;
        const colEinzelR = 438;
        const colSummeR = rightEdge - 8;

        // --- Table header row ---
        page.drawRectangle({ x: ml, y: y - 6, width: contentWidth, height: rowH, color: primaryColor });
        page.drawText("Pos.", { x: ml + 8, y: y + 1, size: 8, font: fontBold, color: white });
        page.drawText("Bezeichnung", { x: colBez, y: y + 1, size: 8, font: fontBold, color: white });
        drawTextRight("Menge", colMengeR, y + 1, 8, fontBold, white);
        drawTextRight("Einzelpreis", colEinzelR, y + 1, 8, fontBold, white);
        drawTextRight("Summe", colSummeR, y + 1, 8, fontBold, white);
        y -= rowH + 1;

        // --- Table body rows ---
        for (let i = 0; i < (params.positionen?.length ?? 0); i++) {
            const pos = params.positionen![i];
            const lineTotal = pos.menge * pos.einzelpreis;

            // Alternating row background
            if (i % 2 === 0) {
                page.drawRectangle({ x: ml, y: y - 6, width: contentWidth, height: rowH, color: lightBg });
            }

            page.drawText(`${i + 1}`, { x: ml + 14, y: y + 1, size: 9, font, color: darkText });
            page.drawText(pos.bezeichnung, { x: colBez, y: y + 1, size: 9, font, color: darkText });
            drawTextRight(pos.menge.toFixed(2), colMengeR, y + 1, 9, font, darkText);
            drawTextRight(`${pos.einzelpreis.toFixed(2)} ${params.waehrung}`, colEinzelR, y + 1, 9, font, darkText);
            drawTextRight(`${lineTotal.toFixed(2)} ${params.waehrung}`, colSummeR, y + 1, 9, font, darkText);

            y -= rowH;
        }

        // Bottom border of table
        page.drawLine({ start: { x: ml, y: y + rowH - 6 }, end: { x: rightEdge, y: y + rowH - 6 }, thickness: 0.6, color: borderGray });
    } else {
        // Thin separator before total when there is no table
        page.drawLine({ start: { x: ml, y }, end: { x: rightEdge, y }, thickness: 0.6, color: borderGray });
    }

    // =============================================
    //  TOTAL AMOUNT BOX
    // =============================================
    y -= 14;
    const totalLabel = "Gesamtbetrag:";
    const totalValue = `${Math.abs(params.betrag).toFixed(2)} ${params.waehrung}`;
    const totalLabelW = fontBold.widthOfTextAtSize(totalLabel, 13);
    const totalValueW = fontBold.widthOfTextAtSize(totalValue, 13);
    const boxPadH = 14;
    const boxPadV = 10;
    const boxW = totalLabelW + totalValueW + boxPadH * 2 + 16;
    const boxX = rightEdge - boxW;

    page.drawRectangle({ x: boxX, y: y - boxPadV, width: boxW, height: 32, color: primaryColor });
    page.drawText(totalLabel, { x: boxX + boxPadH, y: y + 1, size: 13, font: fontBold, color: white });
    page.drawText(totalValue, { x: boxX + boxPadH + totalLabelW + 16, y: y + 1, size: 13, font: fontBold, color: white });

    // =============================================
    //  SPENDENQUITTUNG NOTE
    // =============================================
    if (params.dokumentTyp === "spendenquittung") {
        y -= 44;
        page.drawRectangle({ x: ml, y: y - 6, width: contentWidth, height: 24, color: lightBg });
        page.drawText("Diese Spendenquittung wurde elektronisch erstellt.", { x: ml + 10, y: y + 1, size: 9, font, color: grayText });
    }

    // =============================================
    //  FOOTER
    // =============================================
    page.drawLine({ start: { x: ml, y: 52 }, end: { x: rightEdge, y: 52 }, thickness: 0.8, color: accentColor });
    page.drawText("Automatisch erstellt durch OpenVerein", { x: ml, y: 38, size: 8, font, color: grayText });

    // Bottom accent bar
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 6, color: primaryColor });

    return await doc.save();
}

export function generateZugferdXml(params: {
    dokumentTyp: FinanzDokumentTyp;
    vereinName: string;
    vereinAddress: string;
    mitgliedName?: string;
    rechnungsempfaenger?: string;
    zweck: string;
    dokumentNummer?: string;
    dokumentDatumIso?: string;
    buchungsDatumIso: string;
    betrag: number;
    waehrung: string;
    positionen?: DokumentPosition[];
}) {
    const issueDate = (params.dokumentDatumIso ?? new Date().toISOString()).slice(0, 10).replaceAll("-", "");
    const bookingDate = params.buchungsDatumIso.slice(0, 10).replaceAll("-", "");
    const empfaengerName = params.rechnungsempfaenger?.trim() || params.mitgliedName?.trim() || "Unbekannt";
    const guideline = "urn:cen.eu:en16931:2017";
    const idPrefix = params.dokumentTyp === "rechnung" ? "INV" : "DON";
    const dokumentId = escapeXml(params.dokumentNummer || `${idPrefix}-${Date.now()}`);

    return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>${guideline}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${dokumentId}</ram:ID>
    <ram:TypeCode>${params.dokumentTyp === "rechnung" ? "380" : "875"}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${issueDate}</udt:DateTimeString>
    </ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>${escapeXml(params.zweck)}</ram:Content>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
${(params.positionen ?? [])
    .map((position, index) => {
        const lineTotal = position.menge * position.einzelpreis;
        return `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${index + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${escapeXml(position.bezeichnung)}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${position.einzelpreis.toFixed(2)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="H87">${position.menge.toFixed(2)}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${lineTotal.toFixed(2)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`;
    })
    .join("\n")}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty>
        <ram:Name>${escapeXml(params.vereinName)}</ram:Name>
      </ram:SellerTradeParty>
      <ram:BuyerTradeParty>
        <ram:Name>${escapeXml(empfaengerName)}</ram:Name>
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery>
      <ram:ActualDeliverySupplyChainEvent>
        <ram:OccurrenceDateTime>
          <udt:DateTimeString format="102">${bookingDate}</udt:DateTimeString>
        </ram:OccurrenceDateTime>
      </ram:ActualDeliverySupplyChainEvent>
    </ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>${escapeXml(params.waehrung)}</ram:InvoiceCurrencyCode>
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:GrandTotalAmount>${Math.abs(params.betrag).toFixed(2)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${Math.abs(params.betrag).toFixed(2)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}

export async function generateZugferdEmbeddedPdf(params: {
    dokumentTyp: FinanzDokumentTyp;
    vereinName: string;
    vereinAddress: string;
    mitgliedName?: string;
    rechnungsempfaenger?: string;
    zweck: string;
    dokumentNummer?: string;
    dokumentDatumIso?: string;
    buchungsDatumIso: string;
    betrag: number;
    waehrung: string;
    positionen?: DokumentPosition[];
}) {
    const pdfBytes = await generateDokumentPdf(params);
    const xml = generateZugferdXml(params);

    const pdf = await PDFDocument.load(pdfBytes);
    const xmlBytes = new TextEncoder().encode(xml);
    await pdf.attach(xmlBytes, "zugferd-invoice.xml", {
        mimeType: "application/xml",
        description: "ZUGFeRD XML eingebettet",
        creationDate: new Date(),
        modificationDate: new Date(),
    });

    return await pdf.save();
}
