import { motion } from "framer-motion";
import { Heart, Sparkles, Coffee, MapPin } from "lucide-react";

const ICONS = { Heart, Sparkles, Coffee, MapPin };

/** Fun "holding" interstitials between onboarding sections. */
export default function HoldingScreen({ icon = "Heart", title, subtitle, accent = "Pulling that together…" }) {
  const Icon = ICONS[icon] || Heart;
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="grid min-h-[60vh] place-items-center text-center px-6"
    >
      <div>
        <motion.div
          initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-snog-pink shadow-[0_0_40px_rgba(255,42,133,0.55)]"
        >
          <Icon className="h-9 w-9 fill-white text-white"/>
        </motion.div>
        <motion.h2
          initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.15 }}
          className="font-display text-3xl font-black tracking-tight"
        >{title}</motion.h2>
        {subtitle && (
          <motion.p
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}
            className="mx-auto mt-2 max-w-xs text-sm text-white/70"
          >{subtitle}</motion.p>
        )}
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
          className="mt-6 font-accent text-2xl text-snog-cyan"
        >{accent}</motion.p>
      </div>
    </motion.div>
  );
}
