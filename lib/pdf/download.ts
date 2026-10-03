export function downloadPdf(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim() || "document.pdf";
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    // Let the browser begin consuming the download before revoking its URL.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
