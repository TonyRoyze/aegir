import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PDFDocument } from "pdf-lib";
import { PdfLayout, loadPdfAsset } from "../lib/pdf/layout";
import { generateRegistrationSheetPdf } from "../lib/pdf/registration-sheet";
import { buildMeetProgramEvents } from "../lib/meet-program-pdf";

// Font files are loaded through the same fetch interface used by the browser.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input) => {
  const path = String(input);
  try { return new Response(await readFile(new URL(`../public${path}`, import.meta.url))); }
  catch { return new Response(null, { status: 404 }); }
};

const events = Array.from({ length: 13 }, (_, i) => `M: ${i + 1}00m Freestyle`);
const meet = { name: "University Championship", events };
const names = ["José François D’Souza", "නුවන් පෙරේරා", "அருண் குமார்", "A long participant name that must wrap without losing any part of the name"];
const registrations = Array.from({ length: 70 }, (_, i) => ({
  student: { name: `${names[i % names.length]} ${i}`, registrationNumber: `2026/SCI/${i}`, gender: "Male" as const, faculty: "Science" },
  events: [events[i % events.length]],
}));

test("registration pagination preserves complete rows, filtering and repeated headings in every event section", async () => {
  const captured: Array<{ page: number; cells: string[]; top: number; height: number; bottom: number }> = [];
  const originalRow = PdfLayout.prototype.row;
  const originalBlock = PdfLayout.prototype.block;
  PdfLayout.prototype.block = function (value, x, top, width, size, bold, centered) {
    const height = originalBlock.call(this, value, x, top, width, size, bold, centered);
    assert.ok(top + height <= this.bottom, `text extends below page: ${value}`);
    return height;
  };
  PdfLayout.prototype.row = function (cells, widths, height, bold, size) {
    captured.push({ page: this.pdf.getPages().indexOf(this.page), cells, top: this.y, height, bottom: this.bottom });
    assert.ok(this.y + height <= this.bottom, `row extends below page: ${cells.join(" ")}`);
    assert.ok(Math.abs(widths.reduce((sum, width) => sum + width, 0) - this.contentWidth) < 0.001);
    originalRow.call(this, cells, widths, height, bold, size);
  };
  try {
    const excluded = { student: { name: "Excluded Student", gender: "Female" as const, faculty: "Science" }, events: [] };
    const bytes = await generateRegistrationSheetPdf({ meet, registrations: [...registrations, excluded], filters: { gender: "Male", faculty: "Science" } }, new Date("2026-10-02T00:00:00Z"));
    const pdf = await PDFDocument.load(bytes);
    assert.ok(pdf.getPageCount() >= 6);
    assert.ok(pdf.getPages().every((page) => page.getWidth() > page.getHeight()));
    for (const registration of registrations) assert.equal(captured.filter((row) => row.cells[1] === registration.student.name).length, 2);
    assert.equal(captured.some((row) => row.cells.includes("Excluded Student")), false);
    for (const page of new Set(captured.filter((row) => /^\d+$/.test(row.cells[0])).map((row) => row.page))) {
      assert.equal(captured.filter((row) => row.page === page && row.cells[0] === "#").length, 1);
    }
    assert.ok(captured.some((row) => row.height > 30 && /^\d+$/.test(row.cells[0])));
  } finally { PdfLayout.prototype.row = originalRow; PdfLayout.prototype.block = originalBlock; }
});

test("empty registration sheet is a valid single landscape page", async () => {
  const pdf = await PDFDocument.load(await generateRegistrationSheetPdf({ meet: { ...meet, events: [] }, registrations: [], filters: { gender: "Female", faculty: "USCS" } }));
  assert.equal(pdf.getPageCount(), 1);
});

test("fonts shape Latin, Sinhala and Tamil and reject unsupported glyphs or missing assets", async () => {
  const layout = await PdfLayout.create();
  for (const name of names) {
    assert.ok(layout.measure(name) > 0);
    const lines = layout.wrap(name, 75);
    assert.ok(lines.every((line) => layout.measure(line) <= 75));
  }
  assert.throws(() => layout.measure("🏊"), /U\+1F3CA/);
  await assert.rejects(loadPdfAsset("/fonts/missing.ttf"), /Could not load PDF asset/);
  layout.newPage();
  assert.throws(() => layout.ensure(layout.height * 2), /too tall/);
});

test("meet program retains event order, mixed relay teams, empty lanes and lane seeding", () => {
  const student = (name: string, faculty: string, gender: string) => ({ student: { name, faculty, gender }, events: ["Relay", "Freestyle"] });
  const result = buildMeetProgramEvents([student("A", "Science", "Male"), student("B", "Science", "Male"), student("C", "Arts", "Female")], ["Freestyle", "Relay", "Empty"]);
  assert.deepEqual(result.map((event) => event.name), ["Freestyle", "Relay", "Empty"]);
  assert.equal(result[0].groups[0].heats[0][2]?.name, "A");
  assert.equal(result[1].groups.flatMap((group) => group.heats.flat()).filter(Boolean).length, 2);
  assert.deepEqual(result[1].groups.map((group) => group.label), ["Mixed"]);
  assert.equal(result[2].groups[0].heats[0].length, 6);
  assert.ok(result[2].groups[0].heats[0].every((lane) => lane === null));
});

test.after(() => { globalThis.fetch = originalFetch; });
