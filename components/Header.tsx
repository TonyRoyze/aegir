"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Menu, Home, UserPlus, Clock, BookImage, Calendar, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';

// You might not have use-media-query hook, standard drawer usage handles responsiveness mostly by being conditional or using 'vaul' logic?
// Actually shadcn Drawer is often used for mobile dialogs.
// Let's implement the responsive structure.

const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Register', href: '/register', icon: UserPlus },
  { label: 'Event Order', href: '/event_order', icon: ListOrdered },
  { label: 'Meets', href: '/meets', icon: Calendar },
  { label: 'Timing', href: '/timing', icon: Clock },
  { label: 'Gallery', href: '/gallery', icon: BookImage },
]

function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2 p-4">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Header() {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-background fixed left-0 top-0 z-30 print:hidden">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
            <span>Aegir</span>
          </Link>
        </div>
        <NavLinks />
      </aside>

      {/* Mobile Header with Drawer */}
      <div className="md:hidden fixed bottom-4 right-4 z-50 print:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="default" size="icon" className="rounded-full shadow-lg">
              <Menu className="h-5 w-5" />
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader className="text-left">
              <DrawerTitle>Menu</DrawerTitle>
            </DrawerHeader>
            <NavLinks />
            <DrawerFooter className="p-4">
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
