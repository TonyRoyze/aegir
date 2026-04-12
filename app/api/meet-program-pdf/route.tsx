import { NextResponse } from "next/server";

import { generateMeetProgramPdf } from "@/lib/printer.service";
import type { MeetProgramDocumentData } from "@/lib/meet-program-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim() || "start-list";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<MeetProgramDocumentData>;

    if (!body.meet?.name || !Array.isArray(body.registrations) || !Array.isArray(body.orderedEvents)) {
      return NextResponse.json({ error: "Invalid PDF payload" }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const pdfBuffer = await generateMeetProgramPdf(
      {
        meet: body.meet,
        registrations: body.registrations,
        orderedEvents: body.orderedEvents,
      },
      origin,
    );

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(body.meet.name)} - Start List.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate meet program PDF", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
