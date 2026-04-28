"use client";
import { ReactNode, useRef } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  const convexRef = useRef<ConvexReactClient | null>(null);
  if (!convexRef.current && typeof window !== "undefined") {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (url) {
      convexRef.current = new ConvexReactClient(url);
    }
  }
  if (!convexRef.current) return null;
  return <ConvexProvider client={convexRef.current}>{children}</ConvexProvider>;
}
