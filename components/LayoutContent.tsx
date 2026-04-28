"use client";

import { usePathname } from "next/navigation";
import { LeftSidebar } from "@/components/LeftSidebar";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const isPreviewPage = pathname.startsWith("/preview");
  const isPublicMeetPage = pathname.startsWith("/meets/public");

  if (isPublicMeetPage) {
    return (
      <main className="flex-1 md:pl-64">
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    );
  }

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
