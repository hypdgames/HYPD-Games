"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Shield, ChevronRight } from "lucide-react";

export function AdminSection() {
  const router = useRouter();

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
    </>
  );
}
