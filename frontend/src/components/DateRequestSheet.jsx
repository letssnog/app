import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DATE_ACTIVITIES, TIMEFRAMES } from "@/lib/options";
import { X, Send } from "lucide-react";

/** Modal for suggesting a date along with a like. */
export default function DateRequestSheet({ open, profile, onSubmit, onClose }) {
  const [activity, setActivity] = useState("drinks");
  const [timeframe, setTimeframe] = useState("this_weekend");
  const [message, setMessage] = useState("");

  return (
    <AnimatePresence>
      {open && profile && (
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
                <div className="font-accent text-2xl text-snog-pink">Bold move</div>
                <h2 className="font-display text-2xl font-black">Suggest a date with {profile.name}?</h2>
                <p className="text-xs text-white/60 mt-1">They'll have 48 hours to respond before it expires.</p>
              </div>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10"><X className="h-4 w-4"/></button>
            </div>

            <div className="mt-5">
              <Label>Activity</Label>
              <div className="grid grid-cols-4 gap-2">
                {DATE_ACTIVITIES.map((a) => (
                  <button key={a.k} type="button" onClick={()=>setActivity(a.k)}
                    data-testid={`dr-activity-${a.k}`}
                    className={`rounded-2xl border p-3 text-center text-xs transition-all ${
                      activity === a.k ? "border-snog-pink bg-snog-pink/15" : "border-white/10 hover:border-white/30"
                    }`}>
                    <div className="text-lg leading-none">{a.emoji}</div>
                    <div className="mt-1 font-semibold">{a.t}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <Label>When?</Label>
              <div className="flex flex-wrap gap-2">
                {TIMEFRAMES.map((t) => (
                  <button key={t.k} type="button" onClick={()=>setTimeframe(t.k)}
                    data-testid={`dr-timeframe-${t.k}`}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                      timeframe === t.k ? "border-snog-pink bg-snog-pink/15 text-white" : "border-white/15 text-white/70 hover:border-white/40"
                    }`}>{t.t}</button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <Label>Add a cheeky note (optional)</Label>
              <textarea rows="2" maxLength="160" value={message} onChange={(e)=>setMessage(e.target.value)}
                placeholder="Reckon you'd be brilliant company on a Tuesday."
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"/>
            </div>

            <button data-testid="dr-submit"
              onClick={()=>onSubmit({ activity, timeframe, message })}
              className="btn-primary mt-5 w-full">
              <Send className="mr-1 inline h-4 w-4"/> Send like + date request
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Label({ children }) { return <div className="mb-2 text-xs uppercase tracking-wider text-white/60">{children}</div>; }
