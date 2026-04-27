import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api, fileUrl, API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Send, Timer, Heart, X } from "lucide-react";
import { toast } from "sonner";

export default function EventLive() {
  const { eventId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [secsLeft, setSecsLeft] = useState(null);
  const wsRef = useRef(null);

  const refresh = async () => {
    const { data } = await api.get(`/events/${eventId}/state`);
    setState(data);
  };

  useEffect(() => { refresh(); const id = setInterval(refresh, 5000); return ()=>clearInterval(id); }, [eventId]);

  useEffect(() => {
    if (!state || state.current_round < 1) return;
    setMessages([]);
    const cookie = document.cookie.match(/session_token=([^;]+)/);
    let token = cookie?.[1];
    if (!token) {
      // fallback: ask backend (not ideal); for now just attempt
      api.get("/auth/me").catch(()=>{});
      token = "cookie";
    }
    const wsUrl = API.replace(/^http/, "ws") + `/ws/event/${eventId}?token=${encodeURIComponent(token)}`;
    try {
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (e) => {
        try { setMessages((m) => [...m, JSON.parse(e.data)]); } catch {}
      };
      wsRef.current = ws;
      return () => ws.close();
    } catch {}
  }, [eventId, state?.current_round]);

  // Timer
  useEffect(() => {
    if (!state?.round_started_at || !state.round_seconds) { setSecsLeft(null); return; }
    const start = new Date(state.round_started_at).getTime();
    const end = start + state.round_seconds * 1000;
    const tick = () => setSecsLeft(Math.max(0, Math.round((end - Date.now())/1000)));
    tick(); const id = setInterval(tick, 1000); return ()=>clearInterval(id);
  }, [state?.round_started_at, state?.round_seconds]);

  const send = (e) => {
    e?.preventDefault?.();
    if (!body.trim() || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ body }));
    setBody("");
  };

  const decide = async (decision) => {
    try {
      await api.post(`/events/${eventId}/round_decision`, {
        round_idx: state.current_round - 1,
        opponent_id: state.opponent.user_id,
        decision,
      });
      toast.success(decision === "yes" ? "Said yes 🌶" : "Polite no.");
    } catch { toast.error("Couldn't save"); }
  };

  const advance = async () => {
    try { const { data } = await api.post(`/events/${eventId}/next_round`);
      if (data.ended) { toast.success("Event done. Check chats for matches!"); nav("/chats"); return; }
      refresh(); setMessages([]);
    } catch { toast.error("Couldn't advance"); }
  };

  if (!state) return <div className="pt-10 text-center text-white/60">Loading the room…</div>;

  if (state.status !== "live") {
    return (
      <div className="pt-10 text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-snog-pink/15">
          <Timer className="h-7 w-7 text-snog-pink"/>
        </div>
        <h1 className="font-display text-3xl font-black">Lobby</h1>
        <p className="mt-2 text-sm text-white/70">Hang tight — the host will start the rounds shortly.</p>
        {state.is_admin && (
          <button onClick={()=>api.post(`/events/${eventId}/start`).then(refresh).catch((e)=>toast.error(e?.response?.data?.detail||"Need 2+ signups"))}
            className="btn-primary mt-6">Start event (admin)</button>
        )}
      </div>
    );
  }

  if (!state.opponent) {
    return (
      <div className="pt-10 text-center">
        <h1 className="font-display text-3xl font-black">No partner this round</h1>
        <p className="mt-2 text-sm text-white/70">Sit this one out, mate. Next round in a sec.</p>
        {state.is_admin && <button onClick={advance} className="btn-primary mt-5">Next round</button>}
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100svh-100px)] flex-col">
      <div className="glass flex items-center gap-3 rounded-2xl p-3">
        <div className="h-12 w-12 overflow-hidden rounded-xl bg-white/10">
          {state.opponent.photos?.[0] && <img src={fileUrl(state.opponent.photos[0])} className="h-full w-full object-cover" alt=""/>}
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-widest text-snog-pink">Round {state.current_round} of 3</div>
          <div className="font-display text-lg font-bold">{state.opponent.name}{state.opponent.age?`, ${state.opponent.age}`:""}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-2xl font-black text-snog-cyan">
            {secsLeft !== null ? `${Math.floor(secsLeft/60)}:${String(secsLeft%60).padStart(2,'0')}` : "--:--"}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-white/50">Round timer</div>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-snog-pink/30 bg-snog-pink/10 p-3 text-sm">
        <span className="font-accent text-xl text-snog-pink">Icebreaker → </span>{state.icebreaker}
      </div>

      <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-white/[0.03] p-3 scroll-hide">
        {messages.length === 0 && <p className="text-center text-xs text-white/40">Say something cheeky...</p>}
        {messages.map((m, i) => {
          const mine = m.from === user?.user_id;
          return (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-snog-pink text-white" : "bg-white/10 text-white"}`}>
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="mt-2 flex items-center gap-2">
        <input data-testid="evt-msg-input" value={body} onChange={(e)=>setBody(e.target.value)}
          className="flex-1 rounded-full bg-white/8 border border-white/10 px-4 py-2.5 outline-none focus:border-snog-pink"
          placeholder="Type a message…"/>
        <button data-testid="evt-msg-send" className="grid h-11 w-11 place-items-center rounded-full bg-snog-pink"><Send className="h-4 w-4"/></button>
      </form>

      <div className="mt-3 flex gap-2">
        <button onClick={()=>decide("no")} className="btn-ghost flex-1" data-testid="evt-decision-no"><X className="mr-1 inline h-4 w-4"/>Pass</button>
        <button onClick={()=>decide("yes")} className="btn-primary flex-1" data-testid="evt-decision-yes"><Heart className="mr-1 inline h-4 w-4 fill-white"/>Date them</button>
        {state.is_admin && (
          <button onClick={advance} className="btn-ghost px-3" data-testid="evt-next-round">Next →</button>
        )}
      </div>
    </div>
  );
}
