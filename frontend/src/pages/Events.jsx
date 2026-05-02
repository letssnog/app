import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CalendarDays, Users, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";

export default function Events() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/events");
      setEvents(data);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const signup = async (e) => {
    try { await api.post(`/events/${e.event_id}/signup`); toast.success("You're on the list!"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Couldn't sign up"); }
  };
  const cancel = async (e) => {
    try { await api.delete(`/events/${e.event_id}/signup`); toast.message("Cancelled"); load(); }
    catch { toast.error("Could not cancel"); }
  };
  const startEvt = async (e) => {
    try { await api.post(`/events/${e.event_id}/start`); toast.success("Event live!"); load(); }
    catch (err) { toast.error(err?.response?.data?.detail || "Couldn't start"); }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-black tracking-tight">Speed-dating</h1>
      <p className="mt-1 text-sm text-white/60">Live nights on Tuesdays & Thursdays · 7–9pm London</p>

      <div className="mt-6 space-y-3">
        {loading && <div className="h-32 animate-pulse rounded-3xl bg-white/5"/>}
        {!loading && !events.length && (
          <div className="glass rounded-3xl p-6 text-center">
            <Sparkles className="mx-auto mb-2 h-7 w-7 text-snog-cyan"/>
            <p className="text-sm text-white/70">No nights scheduled. Cheeky.</p>
          </div>
        )}
        {events.map((e) => {
          const me = user?.user_id;
          const registered = e.registered_user_ids?.includes(me);
          const dt = new Date(e.starts_at);
          const isLive = e.status === "live";
          return (
            <motion.div key={e.event_id} className="glass premium-card relative overflow-hidden rounded-3xl p-5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.22,1,0.36,1] }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-snog-pink">
                    {dt.toLocaleString("en-GB", { weekday: "long", timeZone: "Europe/London" })}
                  </div>
                  <div className="font-display text-xl font-black">{e.title}</div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-white/70">
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5"/>
                      {dt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" })}
                    </span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5"/>
                      {e.registered_user_ids?.length || 0}/{e.capacity}
                    </span>
                    {isLive && <span className="rounded-full bg-snog-pink/90 px-2 py-0.5 text-[10px] font-bold tracking-widest">LIVE NOW</span>}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {isLive ? (
                  <Link to={`/events/${e.event_id}/live`} className="btn-primary flex-1 text-center" data-testid={`evt-${e.event_id}-join-live`}>
                    Join the round →
                  </Link>
                ) : registered ? (
                  <>
                    <button onClick={()=>cancel(e)} className="btn-ghost flex-1" data-testid={`evt-${e.event_id}-cancel`}>Cancel</button>
                    <Link to={`/events/${e.event_id}/live`} className="btn-primary flex-1 text-center" data-testid={`evt-${e.event_id}-lobby`}>Lobby</Link>
                  </>
                ) : (
                  <button onClick={()=>signup(e)} className="btn-primary flex-1" data-testid={`evt-${e.event_id}-signup`}>I'm in</button>
                )}
                {user?.is_admin && !isLive && (
                  <button onClick={()=>startEvt(e)} className="btn-ghost px-4" data-testid={`evt-${e.event_id}-start`}>Start</button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      {user?.is_admin && (
        <Link to="/admin" className="mt-6 block text-center text-sm text-snog-cyan underline-offset-4 hover:underline" data-testid="link-admin">
          Open admin dashboard
        </Link>
      )}
    </div>
  );
}
