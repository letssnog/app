import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

/** Confetti-style match overlay. Pure CSS dots, framer for choreography. */
export default function MatchAnimation({ open, profile, onClose }) {
  return (
    <AnimatePresence>
      {open && profile && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-center bg-snog-ink/95 backdrop-blur-md"
          onClick={onClose}
        >
          {/* floating hearts */}
          {Array.from({ length: 18 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ y: 0, x: 0, opacity: 0, scale: 0.4 }}
              animate={{ y: -300 - Math.random() * 200, x: (i - 9) * 18, opacity: [0, 1, 0], scale: 1 }}
              transition={{ duration: 1.8 + Math.random() * 0.8, delay: i * 0.04, ease: "easeOut" }}
              className="absolute bottom-1/3 text-snog-pink"
              style={{ fontSize: 18 + Math.random() * 22 }}
            >❤</motion.span>
          ))}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="text-center px-6 max-w-sm"
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="mx-auto mb-2 grid h-20 w-20 place-items-center rounded-full bg-snog-pink shadow-[0_0_60px_rgba(255,42,133,0.7)] animate-pulse-pink">
              <Heart className="h-10 w-10 fill-white text-white"/>
            </div>
            <div className="font-accent text-3xl text-snog-cyan">Cor blimey!</div>
            <h2 className="font-display text-5xl font-black text-snog-pink leading-[1]">It's a snog!</h2>
            <p className="mt-3 text-white/80">You and <span className="font-bold text-white">{profile.name}</span> both fancy each other.</p>
            <div className="mt-6 grid gap-2">
              <a href="/chats" className="btn-primary block text-center" data-testid="match-go-chat">Send a cheeky line →</a>
              <button className="btn-ghost" onClick={onClose} data-testid="match-keep-swiping">Keep swiping</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
