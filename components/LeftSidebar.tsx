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
import { Menu, Home, UserPlus, Users, Clock, BookImage, Calendar, ListOrdered, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/AuthProvider';


const NAV_ITEMS = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Register', href: '/register', icon: UserPlus },
  { label: 'Event Order', href: '/event_order', icon: ListOrdered },
  { label: 'Timing', href: '/timing', icon: Clock },
  { label: 'Meets', href: '/meets', icon: Calendar },
  { label: 'Gallery', href: '/gallery', icon: BookImage },
]

function NavLinks() {
  const pathname = usePathname();
  const { user } = useAuth();

  const navItems = [...NAV_ITEMS];
  if (user?.role === "super_admin") {
    navItems.push({ label: 'Users', href: '/users', icon: Users });
  }
  

  return (
    <nav className="flex flex-col gap-2 p-4">
      {navItems.map((item) => {
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

export function LeftSidebar() {
  const { user, logout } = useAuth();
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
        <div className="mt-auto p-4 border-t border-muted-foreground/10 bg-muted/20">
          <div className="flex flex-col gap-1 px-3 py-2 mb-2">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-[10px] uppercase font-bold tracking-wider text-primary opacity-80">{user?.role?.replace("_", " ")}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Drawer */}
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
            <div className="p-4 border-t border-muted-foreground/10 bg-muted/5 mt-auto">
              <div className="flex flex-col gap-1 px-3 py-2 mb-2">
                <p className="text-sm font-semibold truncate">{user?.name}</p>
                <p className="text-[10px] uppercase font-bold tracking-wider text-primary opacity-80">{user?.role?.replace("_", " ")}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={logout}
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sign Out
              </Button>
            </div>
            <DrawerFooter className="p-4 flex-none mt-0">
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
