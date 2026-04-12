"use client";

import { usePathname } from "next/navigation";
import { LeftSidebar } from "@/components/LeftSidebar";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const isPreviewPage = pathname.startsWith("/preview");

  return (
    <>
      {!isLoginPage && !isPreviewPage && <LeftSidebar />}
      <main className={isLoginPage || isPreviewPage ? "flex-1" : "flex-1 md:pl-64 print:pl-0"}>
        <div className={isLoginPage || isPreviewPage ? "" : "container mx-auto print:p-0 print:max-w-none px-4 py-8"}>
          {children}
        </div>
      </main>
    </>
  );
}
