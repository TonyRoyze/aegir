import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { printerService } from "@/lib/printer/printer.service";
import { Id } from "@/convex/_generated/dataModel";

// Initialize Convex Client
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Ensure params are treated correctly for Next.js 15+
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ meetId: string }> } // Type as Promise for Next.js 15
) {
  try {
    const { meetId } = await params;

    if (!meetId) {
      return NextResponse.json({ error: "Meet ID is required" }, { status: 400 });
    }

    // validate meetId format if necessary, assuming it's a valid ID string
    const id = meetId as Id<"meets">;

    // 1. Fetch data
    // Optimally we would have a 'getById' query, but we'll use what's available
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
      type: 'meet-order',
      meet: meetData,
      registrations: registrations,
      orderedEvents: meetData.events
    };

    // 3. Generate PDF
    const pdfBuffer = await printerService.printToPdf(payload);

    // 4. Return PDF
    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Meet Order ${meetData.name.replace(/\s+/g, '_')}.pdf"`,
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
