import { motion, AnimatePresence } from "framer-motion";

export function StepFrame({ stepKey, children }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepKey}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 220, damping: 26, mass: 0.8 }}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
