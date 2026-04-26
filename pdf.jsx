// Stedly Protocol — real PDF generation (jsPDF, hand-laid)
//
// Templates match the on-screen ws-pdf-canvas previews in spirit but are
// laid out for proper A4 paper dimensions. Output is a base64 string ready
// to attach to a Gmail draft via createGmailDraft({ attachment: { ... } }).
//
// Why hand-built and not html2canvas:
//   - Text-searchable (recipient can ⌘F inside the PDF)
//   - 1/10th the file size of an image-based render
//   - Crisp at any zoom (vector text), no font-rasterization issues
//   - Doesn't depend on the Workstation being visible / mounted

(function () {
  // jsPDF UMD bundle exposes window.jspdf.jsPDF
  function getJsPDF() {
    if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    if (window.jsPDF) return window.jsPDF;
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // Layout primitives — A4 portrait, mm units.
  // Page is 210mm wide × 297mm tall.
  // We use a 20mm side margin and 22mm top margin for a Mercury/Stripe feel.
  // ─────────────────────────────────────────────────────────────────
  const PAGE = { w: 210, h: 297, marginX: 20, marginY: 22 };

  function setupDoc() {
    const JsPDF = getJsPDF();
    if (!JsPDF) throw new Error("jsPDF not loaded — check the CDN script in index.html");
    const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    return doc;
  }

  // Brand mark — solid green rounded square ("S")
  function drawBrandMark(doc, x, y, size = 7) {
    doc.setFillColor(21, 128, 61); // #15803D
    doc.roundedRect(x, y, size, size, 1.2, 1.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size * 1.2);
    doc.text("S", x + size / 2, y + size * 0.72, { align: "center" });
  }

  // Header band — brand mark + company name + doc kind + date
  function drawHeader(doc, { brand, docKind, docNumber, dateStr }) {
    const x = PAGE.marginX, y = PAGE.marginY;
    drawBrandMark(doc, x, y);
    doc.setTextColor(9, 9, 11);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(brand.toUpperCase(), x + 11, y + 3.6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text(`${docKind} · ${docNumber}`, x + 11, y + 7.4);
    // Date right-aligned
    doc.setTextColor(113, 113, 122);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(dateStr, PAGE.w - PAGE.marginX, y + 6, { align: "right" });
    // Divider
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.2);
    doc.line(x, y + 12, PAGE.w - PAGE.marginX, y + 12);
    return y + 18; // next content y
  }

  // Three-column meta strip (To / Attn / Terms etc.)
  function drawMeta(doc, y, fields) {
    const x = PAGE.marginX;
    const colW = (PAGE.w - PAGE.marginX * 2) / fields.length;
    fields.forEach((f, i) => {
      const cx = x + i * colW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(161, 161, 170);
      doc.text(f.label.toUpperCase(), cx, y);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(9, 9, 11);
      doc.text(String(f.value), cx, y + 5);
    });
    return y + 12;
  }

  // Line-item table. Columns: Item | Qty | Rate | Total
  function drawTable(doc, y, { rows, totals }) {
    const x = PAGE.marginX;
    const tableW = PAGE.w - PAGE.marginX * 2;
    // Column widths: Item flex, Qty 18, Rate 30, Total 32
    const cQty = tableW - 18 - 30 - 32;
    const cols = [
      { x, w: cQty, align: "left",  label: "Item" },
      { x: x + cQty, w: 18, align: "right", label: "Qty" },
      { x: x + cQty + 18, w: 30, align: "right", label: "Rate" },
      { x: x + cQty + 18 + 30, w: 32, align: "right", label: "Total" },
    ];
    // Header
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(161, 161, 170);
    cols.forEach((c) => {
      const tx = c.align === "right" ? c.x + c.w : c.x;
      doc.text(c.label.toUpperCase(), tx, y, { align: c.align });
    });
    y += 2;
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.2);
    doc.line(x, y, x + tableW, y);
    y += 5;

    // Rows
    rows.forEach((row) => {
      const values = [row.item, row.qty || "", row.rate || "", row.total || ""];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(9, 9, 11);
      cols.forEach((c, i) => {
        const tx = c.align === "right" ? c.x + c.w : c.x;
        doc.text(String(values[i]), tx, y, { align: c.align });
      });
      y += 5.5;
      doc.setDrawColor(244, 244, 245);
      doc.setLineWidth(0.15);
      doc.line(x, y - 2, x + tableW, y - 2);
    });

    // Subtotal (optional)
    if (totals && totals.subtotal) {
      y += 2;
      doc.setFillColor(250, 250, 250);
      doc.rect(x, y - 4, tableW, 7, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(63, 63, 70);
      doc.text("Subtotal", x + 2, y);
      doc.setFont("helvetica", "bold");
      doc.text(totals.subtotal, x + tableW - 1, y, { align: "right" });
      y += 5.5;
    }

    // Net total — green band, key visual emphasis
    if (totals && totals.netTotal) {
      doc.setFillColor(220, 252, 231);
      doc.rect(x, y - 1, tableW, 9, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text("Net total", x + 2, y + 5);
      doc.text(totals.netTotal, x + tableW - 1, y + 5, { align: "right" });
      y += 12;
    }

    return y;
  }

  // Bottom-of-page footer line
  function drawFooter(doc, y, footerText) {
    if (!footerText) return y;
    doc.setDrawColor(228, 228, 231);
    doc.setLineWidth(0.2);
    doc.line(PAGE.marginX, PAGE.h - 24, PAGE.w - PAGE.marginX, PAGE.h - 24);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(113, 113, 122);
    doc.text(footerText, PAGE.marginX, PAGE.h - 18);
    return y;
  }

  // ─────────────────────────────────────────────────────────────────
  // Templates
  // ─────────────────────────────────────────────────────────────────

  function buildQuotePdf({ active, pdf, brand = "STUDIO & CO", dateStr }) {
    const doc = setupDoc();
    let y = drawHeader(doc, {
      brand,
      docKind: "QUOTE",
      docNumber: pdf.docNumber || "Q-1042",
      dateStr: dateStr || formatDate(new Date()),
    });
    y = drawMeta(doc, y, [
      { label: "To",    value: pdf.to    || active.co   || "—" },
      { label: "Attn",  value: pdf.attn  || active.from || "—" },
      { label: "Terms", value: pdf.terms || "Net-30" },
    ]);
    y = drawTable(doc, y, {
      rows: pdf.rows || [
        { item: "OAK → DFW", qty: 120, rate: "$1,840", total: "$220,800" },
        { item: "OAK → SEA", qty: 88,  rate: "$1,210", total: "$106,480" },
        { item: "LAX → PHX", qty: 54,  rate: "$960",   total: "$51,840"  },
      ],
      totals: {
        subtotal: pdf.subtotal || "$379,120",
        netTotal: pdf.total    || pdf.netTotal || "$42,800 / mo",
      },
    });
    drawFooter(doc, y, pdf.footer || "90-day price lock · Net-30 · Standard fuel surcharge per Schedule A");
    return doc;
  }

  function buildInvoicePdf({ active, pdf, brand = "STUDIO & CO", dateStr }) {
    const doc = setupDoc();
    let y = drawHeader(doc, {
      brand,
      docKind: "INVOICE",
      docNumber: pdf.docNumber || "INV-2026-03-014",
      dateStr: dateStr || formatDate(new Date()),
    });
    y = drawMeta(doc, y, [
      { label: "Bill to", value: pdf.to      || active.co   || "—" },
      { label: "Project", value: pdf.project || "Atherton residence" },
      { label: "Terms",   value: pdf.terms   || "Net-15" },
    ]);
    y = drawTable(doc, y, {
      rows: pdf.rows || [
        { item: "Cabinet design — kitchen",   qty: 1, rate: "$8,200", total: "$8,200" },
        { item: "Cabinet design — main bath", qty: 1, rate: "$4,800", total: "$4,800" },
        { item: "Site visits",                qty: 3, rate: "$1,140", total: "$3,420" },
        { item: "Drawings + spec sheets",     qty: 1, rate: "$2,000", total: "$2,000" },
      ],
      totals: { netTotal: pdf.total || "$18,420" },
    });
    drawFooter(doc, y, pdf.footer || "Net-15 from invoice date · ACH preferred · Wire details on request");
    return doc;
  }

  function buildOnboardingPdf({ active, pdf, brand = "STUDIO & CO", dateStr }) {
    const doc = setupDoc();
    let y = drawHeader(doc, {
      brand,
      docKind: "ONBOARDING",
      docNumber: pdf.docNumber || "WELCOME PACK",
      dateStr: dateStr || formatDate(new Date()),
    });
    y += 4;
    const items = pdf.items || [
      { num: "01", title: "Welcome & how we work",       sub: "What to expect in the first two weeks · primary contacts" },
      { num: "02", title: "Statement of Work",           sub: "Scope, milestones, change-order protocol" },
      { num: "03", title: "Master Services Agreement",   sub: "Pre-filled · countersigned by Studio" },
      { num: "04", title: "W-9 / banking forms",         sub: "For your accounting team" },
      { num: "05", title: "Brand & access kit",          sub: "Drive folder, Slack channel, dashboard link" },
      { num: "06", title: "Kickoff agenda",              sub: "Pre-filled, suggested 60-min slot" },
    ];
    items.forEach((it) => {
      const x = PAGE.marginX;
      const w = PAGE.w - PAGE.marginX * 2;
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(x, y, w, 14, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(21, 128, 61);
      doc.text(it.num, x + 4, y + 5.5);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(9, 9, 11);
      doc.text(it.title, x + 14, y + 5.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(113, 113, 122);
      doc.text(it.sub, x + 14, y + 10);
      y += 16;
    });
    drawFooter(doc, y, pdf.footer || "Welcome aboard. We're glad to have you.");
    return doc;
  }

  function formatDate(d) {
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  // ─────────────────────────────────────────────────────────────────
  // Public surface — give it { active, pdf } and get back base64 + meta.
  // active = the dashboard queue item (sender, subject, etc.)
  // pdf    = the active.pdf shape (kind, name, optional rows/totals)
  // ─────────────────────────────────────────────────────────────────
  function buildPdfDoc({ active, pdf }) {
    if (!pdf || !pdf.kind) throw new Error("buildPdfDoc requires active.pdf with a .kind");
    if (pdf.kind === "invoice")    return buildInvoicePdf({ active, pdf });
    if (pdf.kind === "onboarding") return buildOnboardingPdf({ active, pdf });
    return buildQuotePdf({ active, pdf });
  }

  function buildPdfBase64({ active, pdf }) {
    const doc = buildPdfDoc({ active, pdf });
    // datauristring is "data:application/pdf;filename=...;base64,XXXX"
    // We just want the base64 chunk for the Gmail attachment.
    const dataUri = doc.output("datauristring");
    const base64 = dataUri.split(",", 2)[1] || "";
    return {
      base64,
      filename: pdf.name || `Stedly-${pdf.kind}.pdf`,
      mime: "application/pdf",
    };
  }

  // For previewing the real PDF in a new tab — handy debug.
  function openPdfInNewTab({ active, pdf }) {
    const doc = buildPdfDoc({ active, pdf });
    window.open(doc.output("bloburl"), "_blank", "noopener");
  }

  Object.assign(window, {
    buildPdfDoc,
    buildPdfBase64,
    openPdfInNewTab,
  });
})();
