"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Coins, Trophy, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store";

const navItems = [
  { path: "/", icon: Home, label: "Feed" },
  { path: "/explore", icon: Compass, label: "Explore" },
  { path: "/wallet", icon: Coins, label: "Wallet" },
  { path: "/leaderboard", icon: Trophy, label: "Leaders" },
  { path: "/profile", icon: User, label: "Profile" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  
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
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path;
          const isWallet = path === "/wallet";
          
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
                  isActive && "scale-110",
                  isWallet && "text-yellow-500"
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
              {/* Show coin balance indicator */}
              {isWallet && user && (user.coin_balance || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded-full min-w-[16px] text-center">
                  {(user.coin_balance || 0) > 999 ? "999+" : user.coin_balance}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
