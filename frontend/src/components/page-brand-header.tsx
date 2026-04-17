"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { useAuthStore } from "@/store";
import { ThemeToggle } from "@/components/theme-toggle";

interface PageBrandHeaderProps {
  rightSlot?: ReactNode;
  className?: string;
}

export function PageBrandHeader({ rightSlot, className = "" }: PageBrandHeaderProps) {
  const { settings } = useAuthStore();

  return (
    <div className={`flex items-center justify-between px-5 pt-4 pb-2 ${className}`.trim()}>
      <div>
        {settings?.logo_url ? (
          <Image
            src={settings.logo_url}
            alt={settings?.site_name || "Logo"}
            width={120}
            height={28}
            className="object-contain"
            style={{ height: settings.logo_height ? `${settings.logo_height}px` : "28px", width: "auto" }}
            priority
          />
        ) : (
          <h1 className="font-extrabold text-2xl text-foreground tracking-tight">
            {settings?.site_name || "HYPD"}
          </h1>
        )}
      </div>
      <div className="flex items-center gap-2">
        {rightSlot}
        <ThemeToggle />
      </div>
    </div>
  );
}
