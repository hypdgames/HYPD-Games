"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, ChevronRight, Crown, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/store";
import { toast } from "sonner";
import type { User } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface AdminSectionProps {
  user: User;
  token: string;
}

export function AdminSection({ user, token }: AdminSectionProps) {
  const router = useRouter();
  const [togglingPro, setTogglingPro] = useState(false);

  const handleTogglePro = async () => {
    setTogglingPro(true);
    try {
      const res = await fetch(`${API_URL}/api/user/toggle-pro`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const userRes = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          useAuthStore.setState({ user: userData });
        }
        toast.success(data.message);
      } else {
        toast.error("Failed to toggle Pro status");
      }
    } catch (e) {
      console.error("Error toggling Pro:", e);
      toast.error("Failed to toggle Pro status");
    }
    setTogglingPro(false);
  };

  return (
    <>
      {/* Admin Link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => router.push("/admin")}
        className="w-full flex items-center justify-between bg-violet/20 border border-violet/30 rounded-xl p-4 hover:bg-violet/30 transition-colors mt-6"
        data-testid="admin-link"
      >
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-violet" />
          <span className="font-bold text-foreground">Admin Dashboard</span>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </motion.button>

      {/* Pro Status Toggle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mt-4 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 rounded-xl p-4"
        data-testid="pro-toggle-section"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 flex items-center justify-center">
              <Crown className="w-5 h-5 text-black" />
            </div>
            <div>
              <span className="font-bold text-foreground">
                Pro Mode (Testing)
              </span>
              <p className="text-xs text-muted-foreground">
                {user.is_ad_free
                  ? "Ad-free gaming enabled"
                  : "Standard mode with ads"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {togglingPro && (
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            )}
            <Switch
              checked={user.is_ad_free || false}
              onCheckedChange={handleTogglePro}
              disabled={togglingPro}
              data-testid="pro-toggle"
            />
          </div>
        </div>
        <p className="text-[10px] text-amber-500/70 mt-2">
          Admin testing only: Toggle to test ad-free GamePix games
        </p>
      </motion.div>
    </>
  );
}
