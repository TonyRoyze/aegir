"use client"

import { useEffect, useState } from "react"
import { MeetProgram } from "@/components/print/meet-program"
import { RegistrationSheet } from "@/components/print/registration-sheet"

export default function ArtboardPreviewPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Check if data is already in localStorage
    const storedData = localStorage.getItem('print-data');
    if (storedData) {
      try {
        setData(JSON.parse(storedData));
      } catch (e) {
        console.error("Failed to parse print data", e);
      }
    }

    // Listen for custom event
    const handleDataReady = () => {
      const storedData = localStorage.getItem('print-data');
      if (storedData) {
        try {
          setData(JSON.parse(storedData));
        } catch (e) {
          console.error("Failed to parse print data", e);
        }
      }
    };

    window.addEventListener('print-data-ready', handleDataReady);
    return () => window.removeEventListener('print-data-ready', handleDataReady);
  }, []);

  if (!data) {
    return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Waiting for print data...</div>;
  }

  // Render based on type
  if (data.type === 'meet-order') {
    return (
      <div className="min-h-screen bg-white">
        <MeetProgram
          meet={data.meet}
          registrations={data.registrations}
          orderedEvents={data.orderedEvents}
        />
      </div>
    );
  }

  if (data.type === 'registration-sheet') {
    return (
      <div className="min-h-screen bg-white">
        <RegistrationSheet
          meet={data.meet}
          registrations={data.registrations}
          filters={data.filters}
        />
      </div>
    );
  }

  // Fallback or other types
  return (
    <div className="p-10">
      <h1 className="text-xl font-bold">Unknown Document Type</h1>
      <pre className="text-xs mt-4 bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

