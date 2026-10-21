#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import QRCode from "qrcode";

async function main() {
  const arg = process.argv[2];
  const inputPath = arg
    ? path.resolve(process.cwd(), arg)
    : path.resolve(new URL("../scripts/sample_tickets.json", import.meta.url).pathname);

  const outDir = path.resolve(process.cwd(), "tickets");
  await fs.mkdir(outDir, { recursive: true });

  const raw = await fs.readFile(inputPath, "utf8");
  const items = JSON.parse(raw || "[]");
  if (!Array.isArray(items) || items.length === 0) {
    console.error("No tickets found in", inputPath);
    process.exit(1);
  }

  const ticketHtmls = [];
  for (const it of items) {
    const ref = String(it.reference ?? it.reference_id ?? "unknown");
    const safe = ref.replace(/[^a-zA-Z0-9_-]/g, "_");
    const qr = await QRCode.toDataURL(ref, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#1a2f6e", light: "#ffffff" },
    });

    const title = it.service_name ?? it.title ?? "Appointment";
    const date = it.appointment_date ?? it.date ?? "";
    const name = it.full_name ?? it.name ?? "";
    const queue = it.queue_number ? `#${it.queue_number}` : "";
    const window = it.slot_window ?? it.window ?? "";

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Ticket ${ref}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:18px}
    .ticket{width:360px;border:1px solid #ddd;padding:12px;border-radius:10px;margin:12px auto}
    .brand{color:#1a2f6e;font-weight:700;text-align:center}
    .qr{display:block;margin:8px auto}
    .meta{margin-top:8px;text-align:center}
    .ref{font-family:monospace;background:#f3f4f6;padding:6px;border-radius:6px;display:inline-block}
  </style>
</head>
<body>
  <div class="ticket">
    <div class="brand">MESOB Hawassa</div>
    <div style="text-align:center;margin-top:8px">
      <img class="qr" src="${qr}" alt="QR code" width="180" height="180"/>
    </div>
    <div class="meta">
      <div style="margin-top:6px;font-weight:600">${title}</div>
      <div style="margin-top:6px">${date}</div>
      <div style="margin-top:6px">${name}</div>
      <div style="margin-top:6px">${queue} ${window}</div>
      <div style="margin-top:10px"><span class="ref">${ref}</span></div>
    </div>
  </div>
</body>
</html>`;

    const outFile = path.join(outDir, `ticket-${safe}.html`);
    await fs.writeFile(outFile, html, "utf8");
    ticketHtmls.push(outFile);
    console.log("Wrote", outFile);
  }

  // Create a single printable HTML that contains all tickets
  const all = ticketHtmls.map((f) => fs.readFile(f, "utf8")).length ? await Promise.all(ticketHtmls.map((f) => fs.readFile(f, "utf8"))) : [];
  const printHtml = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Print Tickets</title>
  <style>body{font-family:Arial,sans-serif} .page{page-break-after:always;margin:18px auto;max-width:420px}</style></head><body>
  ${all.map((h) => `<div class="page">${h}</div>`).join("\n")}
  </body></html>`;
  const printPath = path.join(outDir, "print.html");
  await fs.writeFile(printPath, printHtml, "utf8");
  console.log("Wrote", printPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
