import { motion, useReducedMotion } from "framer-motion";
import { Heart, Sparkles, Coffee, MapPin } from "lucide-react";

const ICONS = { Heart, Sparkles, Coffee, MapPin };

/** Fun "holding" interstitials between onboarding sections. */
export default function HoldingScreen({ icon = "Heart", title, subtitle, accent = "Pulling that together…" }) {
  const Icon = ICONS[icon] || Heart;
  const reduce = useReducedMotion();
  const ease = "easeOut";
  const childDur = reduce ? 0.08 : 0.16;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: reduce
        ? { duration: 0.08 }
        : { staggerChildren: 0.055, delayChildren: 0.03 },
    },
  };

  const item = {
    hidden: { opacity: 0, y: reduce ? 0 : 6, scale: reduce ? 1 : 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: childDur, ease },
    },
  };

  const fadeOnly = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { duration: childDur, ease } },
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-0 px-6 text-center"
    >
      <motion.div
        variants={item}
        className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-snog-pink/95 shadow-[0_8px_24px_rgba(255,42,133,0.28)]"
      >
        <Icon className="h-9 w-9 fill-white text-white" />
      </motion.div>
      <motion.h2 variants={item} className="font-display text-3xl font-black tracking-tight">
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p variants={item} className="mx-auto mt-2 max-w-xs text-sm text-white/70">
          {subtitle}
        </motion.p>
      )}
      <motion.p variants={fadeOnly} className="mt-6 font-accent text-2xl text-snog-cyan">
        {accent}
      </motion.p>
    </motion.div>
  );
}
