"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Feed" },
  { path: "/explore", icon: Search, label: "Explore" },
  { path: "/liked", icon: Heart, label: "Liked" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/play/") || pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-4"
      data-testid="bottom-navigation"
    >
      <div className="frosted-nav flex items-center justify-around w-full max-w-[500px] h-[58px] px-4">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path;

          return (
            <Link
              key={path}
              href={path}
              className="flex flex-col items-center gap-0.5"
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon
                className={cn(
                  "w-[22px] h-[22px] transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
                strokeWidth={isActive ? 2.2 : 1.6}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
