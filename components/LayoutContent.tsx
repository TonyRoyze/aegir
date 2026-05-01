"use client";

import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { LeftSidebar } from "@/components/LeftSidebar";
import { cn } from '@/lib/utils';

const SidebarContext = createContext<{
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}>({ collapsed: false, setCollapsed: () => {} });

export function useSidebar() {
  return useContext(SidebarContext);
}

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const isLoginPage = pathname === "/login";
  const isPreviewPage = pathname.startsWith("/preview");
  const isPublicMeetPage = pathname.startsWith("/meets/public");

  if (isPublicMeetPage) {
    return (
      <main className="flex-1">
        <div className="container mx-auto px-4 py-8">
          {children}
        </div>
      </main>
    );
  }

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {!isLoginPage && !isPreviewPage && <LeftSidebar />}
      <main
        className={cn(
          "flex-1 print:pl-0 transition-[padding] duration-300",
          isLoginPage || isPreviewPage ? "" : "md:pl-64",
          collapsed && "md:!pl-16"
        )}
      >
        <div className={isLoginPage || isPreviewPage ? "" : "container mx-auto print:p-0 print:max-w-none px-4 py-8"}>
          {children}
        </div>
      </main>
    </SidebarContext.Provider>
  );
}
