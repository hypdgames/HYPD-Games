"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Trophy, User, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { path: "/", icon: Home, label: "Feed" },
  { path: "/explore", icon: Compass, label: "Explore" },
  { path: "/idle-game", icon: Crosshair, label: "Defence" },
  { path: "/leaderboard", icon: Trophy, label: "Leaders" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/play/") || pathname.startsWith("/admin")) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-5 pt-2 px-4 pointer-events-none"
      data-testid="bottom-navigation"
    >
      <div
        className="nav-pill flex items-center justify-around w-full max-w-[400px] h-16 px-3 pointer-events-auto"
      >
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path;

          return (
            <Link
              key={path}
              href={path}
              className="flex flex-col items-center gap-0.5 relative"
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200",
                  isActive
                    ? "bg-lime"
                    : "bg-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "w-[22px] h-[22px] transition-colors duration-200",
                    isActive ? "text-black" : "text-[#888888]"
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </motion.div>
              <span
                className={cn(
                  "text-[11px] font-medium leading-none",
                  isActive ? "text-foreground" : "text-[#888888]"
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
