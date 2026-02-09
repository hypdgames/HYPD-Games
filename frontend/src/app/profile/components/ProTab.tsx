"use client";

import { motion } from "framer-motion";
import { ProPlansDisplay } from "./AuthView";

export function ProTab() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <ProPlansDisplay />
    </motion.div>
  );
}
