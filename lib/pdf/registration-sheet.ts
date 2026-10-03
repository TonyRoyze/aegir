import type { RegistrationSheetDocumentData } from "@/lib/registration-sheet-pdf";
import { displayFaculty } from "@/lib/swimming-utils";
import { PdfLayout } from "./layout";
import { rgb } from "pdf-lib";

// Repeat identity columns in horizontal sections instead of shrinking many events.
const EVENTS_PER_SECTION = 10;
export async function generateRegistrationSheetPdf(data: RegistrationSheetDocumentData, date = new Date()) {
  const layout = await PdfLayout.create(true);
  const { meet, filters } = data;
  const registrations = data.registrations.filter((reg) => reg.student?.gender === filters.gender && reg.student?.faculty === filters.faculty);
  const gender = filters.gender === "Male" ? "Men" : "Women";
  layout.pdf.setTitle(`Registration Sheet - ${meet.name}`);
  layout.header = () => {
    layout.y += layout.block(meet.name || "Meet Name", layout.margin, layout.y, layout.contentWidth, 15, true, true);
    layout.y += layout.block("Department of Physical Education", layout.margin, layout.y, layout.contentWidth, 10, true, true);
    layout.y += layout.block("University of Colombo", layout.margin, layout.y, layout.contentWidth, 10, true, true) + 8;
    layout.y += layout.block(`Team: ${displayFaculty(filters.faculty)}    |    ${gender}    |    Date: ${date.toLocaleDateString()}`, layout.margin, layout.y, layout.contentWidth, 9) + 5;
    layout.y += layout.block("Entry Form", layout.margin, layout.y, layout.contentWidth, 12, true, true) + 10;
  };
  layout.newPage();
  const sections: string[][] = [];
  for (let i = 0; i < meet.events.length; i += EVENTS_PER_SECTION) sections.push(meet.events.slice(i, i + EVENTS_PER_SECTION));
  if (!sections.length) sections.push([]);

  sections.forEach((events, sectionIndex) => {
    if (sectionIndex) layout.newPage();
    const baseWidths = [28, 205, 105];
    const eventWidth = (layout.contentWidth - baseWidths.reduce((sum, width) => sum + width, 0)) / Math.max(1, events.length);
    const widths = events.length ? [...baseWidths, ...events.map(() => eventWidth)] : [28, layout.contentWidth - 133, 105];
    const headings = ["#", "Student Name", "Reg. No", ...events];
    const headerHeight = layout.rowHeight(headings, widths, 8, true, 30);
    const tableHeader = () => {
      if (sections.length > 1) {
        layout.y += layout.block(`Event section ${sectionIndex + 1} of ${sections.length} — all students repeated`, layout.margin, layout.y, layout.contentWidth, 9, true) + 5;
      }
      layout.ensure(headerHeight + 24);
      layout.row(headings, widths, headerHeight, true, 8);
    };
    tableHeader();
    if (!registrations.length) {
      const message = `No registrations found for ${gender} - ${displayFaculty(filters.faculty)}`;
      const height = layout.rowHeight([message], [layout.contentWidth]);
      layout.ensure(height, tableHeader);
      layout.row([message], [layout.contentWidth], height);
    }
    registrations.forEach((reg, index) => {
      const cells = [String(index + 1), reg.student?.name || "", reg.student?.registrationNumber || "", ...events.map(() => "")];
      const height = layout.rowHeight(cells, widths);
      layout.ensure(height, tableHeader);
      const top = layout.y;
      layout.row(cells, widths, height);
      events.forEach((event, eventIndex) => {
        if (!reg.events?.includes(event)) return;
        const x = layout.margin + baseWidths.reduce((sum, width) => sum + width, 0) + eventIndex * eventWidth + eventWidth / 2;
        const y = layout.height - top - height / 2;
        layout.page.drawLine({ start: { x: x - 4, y }, end: { x: x - 1, y: y - 3 }, thickness: 1, color: rgb(0, 0, 0) });
        layout.page.drawLine({ start: { x: x - 1, y: y - 3 }, end: { x: x + 5, y: y + 4 }, thickness: 1, color: rgb(0, 0, 0) });
      });
    });
  });

  // Keep the certification and signature fields together on the final page.
  layout.ensure(240);
  layout.y += 15;
  layout.y += layout.block("One Student can apply only for a maximum of three events excluding relays and IM", layout.margin, layout.y, layout.contentWidth, 9) + 16;
  layout.text("Name of the team captain:", layout.margin, layout.y);
  layout.line(layout.margin + 125, layout.y + 14, 330);
  layout.line(layout.width - layout.margin - 145, layout.y + 14, 145);
  layout.text("Signature", layout.width - layout.margin - 145, layout.y + 18, 8);
  layout.y += 36;
  layout.text("Contact No: -", layout.margin, layout.y);
  layout.line(layout.margin + 70, layout.y + 14, 200);
  layout.y += 30;
  layout.y += layout.block("I hereby certify the above mentioned students are internal students of the above mentioned team.", layout.margin, layout.y, layout.contentWidth, 9) + 18;
  const signatureWidth = (layout.contentWidth - 140) / 2;
  layout.line(layout.margin, layout.y + 28, signatureWidth - 20);
  layout.block("Instructor /PE (Team Representative)", layout.margin, layout.y + 35, signatureWidth - 20, 8);
  layout.line(layout.margin + signatureWidth, layout.y + 28, signatureWidth - 20);
  layout.block("Signature of Dean / Director / AR", layout.margin + signatureWidth, layout.y + 35, signatureWidth - 20, 8);
  layout.rect(layout.width - layout.margin - 60, layout.y - 12, 60, 60);
  layout.text("Stamp", layout.width - layout.margin - 45, layout.y + 51, 8);
  layout.y += 76;
  layout.block("Contact: - Mr. Wasantha Rathnayake (Instructor in Physical Education) - 071 8834468", layout.margin, layout.y, layout.contentWidth, 8);
  return layout.save();
}
