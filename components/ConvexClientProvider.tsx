"use client";
import { ReactNode, useState, useEffect } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Loader2 } from "lucide-react";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [client, setClient] = useState<ConvexReactClient | null>();
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    const connection = url ? new ConvexReactClient(url) : null;
    // Client setup is deferred so server rendering has the same loading state.
    let active = true;
    queueMicrotask(() => {
      if (active) setClient(connection);
    });
    return () => {
      active = false;
      void connection?.close();
    };
  }, []);

  if (client === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (client === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive font-semibold">Configuration Error</p>
        <p className="text-sm text-muted-foreground">
          NEXT_PUBLIC_CONVEX_URL is not set.
        </p>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
