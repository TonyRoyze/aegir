import { buildMeetProgramEvents, type MeetProgramDocumentData } from "@/lib/meet-program-pdf";
import { displayFaculty, LANES_PER_HEAT } from "@/lib/swimming-utils";
import { embedLogo, PdfLayout } from "./layout";

function displayEventName(name: string) {
  return name.replace(/^\s*([MW]):\s*/i, (_, gender: string) =>
    gender.toUpperCase() === "M" ? "Men's " : "Women's ");
}

export async function generateMeetProgramPdf(data: MeetProgramDocumentData) {
  const layout = await PdfLayout.create();
  const logos = await Promise.all([embedLogo(layout.pdf, "/university-logo.svg"), embedLogo(layout.pdf, "/swimming-logo.svg")]);
  layout.pdf.setTitle(`${data.meet.name} - Start List`);
  layout.header = () => {
    const top = layout.y;
    logos.forEach((logo, index) => layout.page.drawImage(logo, {
      x: index ? layout.width - layout.margin - 48 : layout.margin,
      y: layout.height - top - 48, width: 48, height: 48,
    }));
    const titleHeight = layout.block(data.meet.name || "Meet Name", layout.margin + 60, top, layout.contentWidth - 120, 16, true, true);
    layout.block("START LIST", layout.margin + 60, top + titleHeight + 4, layout.contentWidth - 120, 10, true, true);
    layout.y = top + Math.max(48, titleHeight + 22) + 12;
    layout.line(layout.margin, layout.y, layout.contentWidth);
    layout.y += 14;
  };
  layout.newPage();
  const pageContentTop = layout.y;
  const events = buildMeetProgramEvents(data.registrations, data.orderedEvents);
  if (!events.length) layout.block("No events scheduled", layout.margin, layout.y, layout.contentWidth, 11);
  for (const event of events) {
    const relay = event.name.toLowerCase().includes("relay");
    const widths = relay ? [35, layout.contentWidth - 145, 70, 40] : [35, layout.contentWidth - 215, 70, 70, 40];
    const headings = relay ? ["Lane", "Team", "Timing", "Place"] : ["Lane", "Name", "Team", "Timing", "Place"];
    const eventLabel = `Event No: ${String(event.number).padStart(2, "0")}    ${displayEventName(event.name)}`;
    const eventHeight = layout.wrap(eventLabel, layout.contentWidth - 10, 11, true).length * 16.5 + 12;
    const drawEvent = (continued = false) => {
      layout.row([continued ? `${eventLabel} (continued)` : eventLabel], [layout.contentWidth],
        layout.rowHeight([continued ? `${eventLabel} (continued)` : eventLabel], [layout.contentWidth], 11, true), true, 11);
      layout.y += 8;
    };
    let firstHeat = true;
    for (const group of event.groups) {
      for (const [heatIndex, heat] of group.heats.entries()) {
        const cells = Array.from({ length: LANES_PER_HEAT }, (_, index) => {
          const student = heat[index];
          return relay ? [String(index + 1), displayFaculty(student?.faculty), "", ""] :
            [String(index + 1), student?.name || "", displayFaculty(student?.faculty), "", ""];
        });
        const heights = cells.map((row) => layout.rowHeight(row, widths, 9, false, 27));
        const headingHeight = layout.rowHeight(headings, widths, 9, true);
        const heatHeight = 24 + headingHeight + heights.reduce((sum, height) => sum + height, 0);
        const drawHeatHeader = () => {
          layout.y += layout.block(`${group.label ? `${group.label} | ` : ""}Heat ${String(heatIndex + 1).padStart(2, "0")}`, layout.margin, layout.y, layout.contentWidth, 10, true) + 5;
          layout.row(headings, widths, headingHeight, true);
        };
        // Keep a whole heat together when possible; oversized heats repeat context.
        const needed = (firstHeat ? eventHeight + 8 : 0) + heatHeight;
        if (layout.y > pageContentTop && layout.y + needed > layout.bottom) {
          layout.newPage();
          drawEvent(!firstHeat);
        } else if (firstHeat) drawEvent();
        layout.ensure(24 + headingHeight + heights[0], () => drawEvent(true));
        drawHeatHeader();
        cells.forEach((row, index) => {
          layout.ensure(heights[index], () => { drawEvent(true); drawHeatHeader(); });
          layout.row(row, widths, heights[index]);
        });
        layout.y += 14;
        firstHeat = false;
      }
    }
    if (firstHeat) {
      layout.ensure(eventHeight + 35);
      drawEvent();
      layout.y += layout.block("No participants registered", layout.margin, layout.y, layout.contentWidth, 9) + 10;
    }
    layout.y += 8;
  }
  return layout.save();
}
