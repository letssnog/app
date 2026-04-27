import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { Sparkles, Wand2, X, ChevronRight } from "lucide-react";
import { toast } from "sonner";

/**
 * Snog AI icebreaker modal. Calls /api/snog_ai/icebreaker/{matchId}
 * and lets the user tap one to insert into their composer.
 */
export default function SnogAIIcebreaker({ open, matchId, onPick, onClose }) {
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState([]);

  const generate = async () => {
    setLoading(true); setLines([]);
    try {
      const { data } = await api.post(`/snog_ai/icebreaker/${matchId}`);
      setLines(data.icebreakers || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Snog AI dozed off");
    } finally { setLoading(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center bg-snog-ink/85 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 26 }}
            onClick={(e)=>e.stopPropagation()}
            className="glass w-full max-w-md rounded-3xl p-5"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-snog-pink to-snog-cyan">
                    <Wand2 className="h-3.5 w-3.5 text-white"/>
                  </span>
                  <span className="font-display text-base font-bold tracking-tight">Snog AI</span>
                </div>
                <h2 className="mt-1 font-display text-2xl font-black">Stuck on what to say?</h2>
                <p className="text-xs text-white/60 mt-1">Tap one to drop it in your composer. Tweak as you fancy.</p>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X className="h-4 w-4"/></button>
            </div>

            {!lines.length && !loading && (
              <button onClick={generate} data-testid="ai-generate-btn"
                className="btn-primary mt-5 w-full">
                <Sparkles className="mr-2 inline h-4 w-4"/> Generate icebreakers
              </button>
            )}
            {loading && (
              <div className="mt-5 grid place-items-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-snog-pink/15 animate-pulse-pink">
                  <Wand2 className="h-5 w-5 text-snog-pink"/>
                </div>
                <p className="mt-2 text-xs text-white/60">Snog AI is being witty…</p>
              </div>
            )}
            {!!lines.length && (
              <div className="mt-4 space-y-2">
                {lines.map((l, i) => (
                  <button key={i} onClick={()=>onPick(l)}
                    data-testid={`ai-line-${i}`}
                    className="group flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition-all hover:border-snog-pink hover:bg-snog-pink/10">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-snog-pink/20 text-[11px] font-bold text-snog-pink">{i+1}</span>
                    <span className="text-sm flex-1">{l}</span>
                    <ChevronRight className="mt-0.5 h-4 w-4 text-white/40 group-hover:text-snog-pink"/>
                  </button>
                ))}
                <button onClick={generate} data-testid="ai-regen-btn" className="btn-ghost w-full py-2 text-xs">
                  <Sparkles className="mr-1 inline h-3.5 w-3.5"/> Regenerate
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
