import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api, fileUrl } from "@/lib/api";
import { MessageCircleHeart, Clock, Check, X } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Pressable } from "@/components/PremiumMotion";

export default function Chats() {
  const [threads, setThreads] = useState([]);
  const [requests, setRequests] = useState({ incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.get("/chat/threads"),
        api.get("/date_requests"),
      ]);
      setThreads(t.data); setRequests(r.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const id = setInterval(load, 8000); return ()=>clearInterval(id); }, [load]);

  const respond = async (id, accept) => {
    try {
      const { data } = await api.post(`/date_requests/${id}/respond`, { accept });
      if (accept && data.match_id) toast.success("Match made — chat's open!");
      else if (!accept) toast.message("Politely declined");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Couldn't respond"); }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-black">Chats</h1>
      <p className="mt-1 text-sm text-white/60">Mutual snogs · talk like grown-ups, plan a real date</p>

      {/* Incoming date requests */}
      {!!requests.incoming.length && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-snog-pink">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-snog-pink/20">{requests.incoming.length}</span>
            Date requests
          </div>
            <div className="space-y-2">
            <AnimatePresence>
            {requests.incoming.map((r) => (
              <motion.div key={r.request_id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}
                className="glass premium-card relative overflow-hidden rounded-3xl p-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10 shrink-0">
                    {r.other.photos?.[0] && <img src={fileUrl(r.other.photos[0])} className="h-full w-full object-cover" alt=""/>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-bold">{r.other.name}{r.other.age ? `, ${r.other.age}` : ""}</div>
                    <div className="text-xs text-white/70">
                      Wants <span className="font-semibold text-white">{r.activity.replace(/_/g,' ')}</span> · {r.timeframe.replace(/_/g,' ')}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-snog-cyan">
                      <Clock className="h-3 w-3"/><Countdown to={r.expires_at}/>
                    </div>
                  </div>
                </div>
                {r.message && <div className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-xs italic">“{r.message}”</div>}
                <div className="mt-3 flex gap-2">
                  <Pressable onClick={()=>respond(r.request_id, false)} data-testid={`dr-decline-${r.request_id}`} className="btn-ghost flex-1 py-2 text-xs"><X className="mr-1 inline h-3.5 w-3.5"/>Decline</Pressable>
                  <Pressable onClick={()=>respond(r.request_id, true)} data-testid={`dr-accept-${r.request_id}`} className="btn-primary flex-1 py-2 text-xs"><Check className="mr-1 inline h-3.5 w-3.5"/>Yes please</Pressable>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Outgoing pending */}
      {!!requests.outgoing.filter(r=>r.status==="pending").length && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/60">Sent</div>
          <div className="flex gap-2 overflow-x-auto pb-2 scroll-hide">
            {requests.outgoing.filter(r=>r.status==="pending").map((r)=>(
              <div key={r.request_id} className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
                <div className="h-7 w-7 overflow-hidden rounded-full bg-white/10">
                  {r.other.photos?.[0] && <img src={fileUrl(r.other.photos[0])} className="h-full w-full object-cover" alt=""/>}
                </div>
                <span className="text-xs">{r.other.name} · <Countdown to={r.expires_at}/></span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 space-y-2">
        {loading && <div className="h-20 animate-pulse rounded-2xl bg-white/5"/>}
        {!loading && !threads.length && !requests.incoming.length && (
          <div className="glass rounded-3xl p-6 text-center">
            <MessageCircleHeart className="mx-auto h-8 w-8 text-snog-pink"/>
            <p className="mt-3 font-display text-lg">No mutuals yet</p>
            <p className="text-sm text-white/60">Get back to swiping or hop into a speed-dating night.</p>
          </div>
        )}
        {threads.map((t) => (
          <Link key={t.match_id} to={`/chats/${t.match_id}`} data-testid={`chat-row-${t.match_id}`}
            className="glass premium-card flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-white/[0.06]">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10">
              {t.other.photos?.[0] && <img src={fileUrl(t.other.photos[0])} alt="" className="h-full w-full object-cover"/>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <div className="font-display font-bold">{t.other.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-snog-pink">{t.source}</div>
              </div>
              <div className="line-clamp-1 text-sm text-white/60">
                {t.chat_open ? (t.last_message?.body || "Say hi 👋") : "Chat closed"}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Countdown({ to }) {
  const [t, setT] = useState(formatDelta(to));
  useEffect(()=>{ const id = setInterval(()=>setT(formatDelta(to)), 30000); return ()=>clearInterval(id); }, [to]);
  return <span>{t}</span>;
}
function formatDelta(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return `${Math.floor(h/24)}d left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${m}m left`;
}
