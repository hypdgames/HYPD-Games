"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Trophy, User, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Feed" },
  { path: "/explore", icon: Search, label: "Explore" },
  { path: "/idle-game", icon: Crosshair, label: "Defence", isCenter: true },
  { path: "/leaderboard", icon: Trophy, label: "Leaders" },
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
      <div className="frosted-nav flex items-center justify-around w-full max-w-[400px] h-[68px] px-4">
        {navItems.map(({ path, icon: Icon, label, isCenter }) => {
          const isActive = pathname === path;

          /* ── Large purple center button (like Hook's "+" button) ── */
          if (isCenter) {
            return (
              <Link
                key={path}
                href={path}
                className="flex flex-col items-center -mt-5"
                data-testid="nav-defence"
              >
                <div
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center center-btn-glow transition-transform active:scale-90",
                    "bg-violet"
                  )}
                >
                  <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={path}
              href={path}
              className="flex flex-col items-center gap-0.5"
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon
                className={cn(
                  "w-6 h-6 transition-colors",
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
