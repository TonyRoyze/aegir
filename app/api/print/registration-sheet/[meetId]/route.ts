import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { printerService } from "@/lib/printer/printer.service";
import { Id } from "@/convex/_generated/dataModel";

// Initialize Convex Client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> }
) {
  try {
    const { meetId } = await params;
    const { searchParams } = new URL(request.url);

    // Get filter parameters from query string
    const gender = searchParams.get('gender') as "Male" | "Female" || "Male";
    const faculty = searchParams.get('faculty') || "";

    if (!meetId) {
      return NextResponse.json({ error: "Meet ID is required" }, { status: 400 });
    }

    const id = meetId as Id<"meets">;

    // 1. Fetch data
    const [allMeets, registrations] = await Promise.all([
      convex.query(api.meets.getMeets, {}),
      convex.query(api.registrations.get, { meetId: id })
    ]);

    const meetData = allMeets.find((m: any) => m._id === meetId);

    if (!meetData) {
      return NextResponse.json({ error: "Meet not found" }, { status: 404 });
    }

    // 2. Prepare data payload
    const payload = {
      type: 'registration-sheet',
      meet: meetData,
      registrations: registrations,
      filters: {
        gender,
        faculty
      }
    };

    // 3. Generate PDF (landscape for registration sheet)
    const pdfBuffer = await printerService.printToPdf(payload, { landscape: true });

    // 4. Return PDF
    const genderLabel = gender === "Male" ? "Men" : "Women";
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Registration Sheet ${meetData.name.replace(/\s+/g, '_')} ${genderLabel} ${faculty}.pdf"`,
      },
    });

  } catch (error) {
    console.error("PDF Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: String(error) },
      { status: 500 }
    );
  }
}
