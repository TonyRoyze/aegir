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
  const convexRef = useRef<ConvexReactClient | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (url) {
      convexRef.current = new ConvexReactClient(url);
    }
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!convexRef.current) {
    return (
      <div suppressHydrationWarning>
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <ConvexProvider client={convexRef.current}>{children}</ConvexProvider>;
}
