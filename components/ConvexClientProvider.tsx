"use client";
import { ReactNode, useState, useEffect, useRef } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Loader2 } from "lucide-react";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [urlMissing, setUrlMissing] = useState(false);
  const convexRef = useRef<ConvexReactClient | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      setUrlMissing(true);
    } else {
      convexRef.current = new ConvexReactClient(url);
    }
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (urlMissing || !convexRef.current) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive font-semibold">Configuration Error</p>
        <p className="text-sm text-muted-foreground">NEXT_PUBLIC_CONVEX_URL is not set.</p>
      </div>
    );
  }

  return <ConvexProvider client={convexRef.current}>{children}</ConvexProvider>;
}
