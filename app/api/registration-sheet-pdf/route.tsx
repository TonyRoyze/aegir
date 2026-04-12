import { NextResponse } from "next/server";

import { generateRegistrationSheetPdf } from "@/lib/printer.service";
import type { RegistrationSheetDocumentData } from "@/lib/registration-sheet-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "").trim() || "registration-sheet";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<RegistrationSheetDocumentData>;

    if (
      !body.meet?.name ||
      !Array.isArray(body.meet?.events) ||
      !Array.isArray(body.registrations) ||
      !body.filters?.gender ||
      !body.filters?.faculty
    ) {
      return NextResponse.json({ error: "Invalid PDF payload" }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const pdfBuffer = await generateRegistrationSheetPdf(
      {
        meet: body.meet,
        registrations: body.registrations,
        filters: body.filters,
      },
      origin,
    );

    const genderLabel = body.filters.gender === "Male" ? "Men" : "Women";
    const filename = `Registration Sheet ${body.meet.name} ${genderLabel} ${body.filters.faculty}.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${sanitizeFileName(filename)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to generate registration sheet PDF", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
