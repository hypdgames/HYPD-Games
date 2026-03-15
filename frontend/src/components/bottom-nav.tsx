"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Trophy, User, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const navItems = [
  { path: "/", icon: Home, label: "Feed" },
  { path: "/explore", icon: Compass, label: "Explore" },
  { path: "/idle-game", icon: Crosshair, label: "Defence", isCenter: true },
  { path: "/leaderboard", icon: Trophy, label: "Leaders" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/play/")) return null;

  return (
    /* Floating pill — centered, doesn't touch the edges */
    <nav
      className="fixed bottom-4 left-0 right-0 z-50 flex justify-center px-6"
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around w-full max-w-sm bg-[#0f0f0f] rounded-[32px] px-4 py-3 shadow-2xl shadow-black/60">
        {navItems.map(({ path, icon: Icon, label, isCenter }) => {
          const isActive = pathname === path;

          if (isCenter) {
            return (
              <Link
                key={path}
                href={path}
                className="flex flex-col items-center gap-1"
                data-testid="nav-defence"
              >
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center border-2 transition-all duration-200",
                    isActive
                      ? "border-lime bg-lime/10"
                      : "border-lime/80 bg-transparent"
                  )}
                >
                  <Icon
                    className={cn("w-5 h-5", isActive ? "text-lime" : "text-white")}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                </motion.div>
                <span className={cn(
                  "text-[9px] font-semibold tracking-wide",
                  isActive ? "text-lime" : "text-white/50"
                )}>
                  {label}
                </span>
              </Link>
            );
          }

          /* Profile gets a subtle circular tint */
          const isProfile = label === "Profile";

          return (
            <Link
              key={path}
              href={path}
              className="flex flex-col items-center gap-1"
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <motion.div
                whileTap={{ scale: 0.88 }}
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200",
                  isProfile && !isActive && "bg-white/8",
                  isProfile && isActive && "bg-lime/20",
                  !isProfile && "bg-transparent"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors duration-200",
                    isActive ? "text-lime" : "text-white/60"
                  )}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
              </motion.div>
              <span className={cn(
                "text-[9px] font-semibold tracking-wide",
                isActive ? "text-lime" : "text-white/50"
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
