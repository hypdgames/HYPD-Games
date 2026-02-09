"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Trophy, User, PawPrint } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Feed" },
  { path: "/explore", icon: Compass, label: "Explore" },
  { path: "/idle-game", icon: PawPrint, label: "Pet Idle", isCenter: true },
  { path: "/leaderboard", icon: Trophy, label: "Leaders" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Hide on game player pages
  if (pathname.startsWith("/play/")) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 glass border-t border-border z-50"
      data-testid="bottom-navigation"
    >
      <div className="flex justify-around max-w-md mx-auto py-3">
        {navItems.map(({ path, icon: Icon, label, isCenter }) => {
          const isActive = pathname === path;

          if (isCenter) {
            return (
              <Link
                key={path}
                href={path}
                className="flex flex-col items-center justify-center w-14 touch-target relative -mt-5"
                data-testid="nav-pet-idle"
              >
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg",
                    isActive
                      ? "bg-lime text-black scale-110"
                      : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-lime/50"
                  )}
                >
                  <Icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <span
                  className={cn(
                    "text-[10px] mt-0.5 font-medium",
                    isActive ? "text-lime font-bold" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={path}
              href={path}
              className={cn(
                "flex flex-col items-center justify-center w-14 touch-target transition-all duration-200 relative",
                isActive
                  ? "text-lime"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  isActive && "scale-110"
                )}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span
                className={cn(
                  "text-[10px] mt-0.5 font-medium",
                  isActive && "font-bold"
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
