import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Send, MapPin, CalendarPlus, ShieldCheck, Copy, MoreVertical, Flag, Ban, Wand2 } from "lucide-react";
import { toast } from "sonner";
import SnogAIIcebreaker from "@/components/SnogAIIcebreaker";
import ReportUserModal from "@/components/ReportUserModal";
import { motion } from "framer-motion";

export default function ChatThread() {
  const { matchId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [body, setBody] = useState("");
  const [planOpen, setPlanOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMessage, setReportMessage] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const scrollerRef = useRef(null);
  const quickReplies = [
    "How's your week going?",
    "What's your ideal first date in London?",
    "Fancy a coffee or a walk this weekend?",
  ];

  const load = useCallback(async () => {
    const { data } = await api.get(`/chat/threads/${matchId}/messages`);
    setData(data);
    if (data.gate?.gated) {
      const fb = data.gate.feedback || {};
      if (!fb[user?.user_id]) setFeedbackOpen(true);
    }
  }, [matchId, user?.user_id]);
  useEffect(() => { load(); const id = setInterval(load, 4000); return ()=>clearInterval(id); }, [load]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [data?.messages?.length]);

  const send = async (e) => {
    e?.preventDefault?.();
    if (!body.trim()) return;
    try {
      await api.post(`/chat/threads/${matchId}/messages`, { body });
      setBody(""); load();
    } catch (err) { toast.error(err?.response?.data?.detail || "Couldn't send"); }
  };

  if (!data) return <div className="pt-10 text-center text-white/50">Loading…</div>;
  const other = data.other;

  const blockUser = async () => {
    if (!confirm(`Block ${other.name}? They'll never appear again.`)) return;
    try { await api.post("/blocks", { user_id: other.user_id }); toast.success("Blocked"); nav("/chats"); }
    catch { toast.error("Couldn't block"); }
  };

  return (
    <div className="flex h-[calc(100svh-100px)] flex-col">
      {/* Header */}
      <motion.div className="glass premium-card flex items-center gap-3 rounded-2xl p-3 relative"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
        <Link to="/chats" className="text-white/70" data-testid="chat-back"><ArrowLeft className="h-5 w-5"/></Link>
        <div className="h-11 w-11 overflow-hidden rounded-xl bg-white/10">
          {other?.photos?.[0] && <img src={fileUrl(other.photos[0])} className="h-full w-full object-cover" alt=""/>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-base font-bold">{other?.name}</div>
          <div className="text-xs text-white/50">
            {data.match.chat_open ? (data.gate?.gated ? "Feedback time" : "Cracking on") : "Chat ended"}
          </div>
        </div>
        <button data-testid="plan-date-btn" onClick={()=>setPlanOpen(true)} className="btn-primary px-3 py-2 text-xs">
          <CalendarPlus className="mr-1 inline h-3.5 w-3.5"/> Plan
        </button>
        <button data-testid="chat-menu" onClick={()=>setMenuOpen((o)=>!o)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10">
          <MoreVertical className="h-4 w-4"/>
        </button>
        {menuOpen && (
          <div className="absolute right-2 top-14 z-30 w-44 overflow-hidden rounded-2xl border border-white/10 bg-snog-navy shadow-2xl">
            <button onClick={()=>{ setMenuOpen(false); setReportOpen(true); }}
              data-testid="menu-report" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm hover:bg-white/5">
              <Flag className="h-4 w-4 text-snog-pink"/> Report
            </button>
            <button onClick={()=>{ setMenuOpen(false); blockUser(); }}
              data-testid="menu-block" className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-white/5">
              <Ban className="h-4 w-4"/> Block user
            </button>
          </div>
        )}
      </motion.div>

      {/* Messages */}
      <div ref={scrollerRef} className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-white/[0.03] p-3 scroll-hide premium-card">
        {data.messages.length === 0 && (
          <p className="text-center text-xs text-white/40 mt-10">Be the first to say something cheeky.</p>
        )}
        {data.messages.map((m) => {
          const mine = m.sender_id === user?.user_id;
          const canReportMessage = !mine && !m.system && other?.user_id;
          return (
            <div key={m.id} className={`group flex gap-1 ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-snog-pink text-white" : "bg-white/10 text-white"}`}
              >
                {m.body}
              </div>
              {canReportMessage && (
                <button
                  type="button"
                  title="Report message"
                  data-testid={`report-msg-${m.id}`}
                  onClick={() =>
                    setReportMessage({ id: m.id, body: m.body, senderId: m.sender_id })
                  }
                  className="grid h-8 w-8 shrink-0 place-items-center self-center rounded-lg text-white/35 opacity-0 transition hover:bg-white/10 hover:text-snog-pink group-hover:opacity-100"
                >
                  <Flag className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Composer */}
      {user?.is_restricted && (
        <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-100">
          Your account can&apos;t send messages right now. If you think this is wrong, contact support.
        </p>
      )}

      {data.match.chat_open && !data.gate?.gated ? (
        <>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scroll-hide">
            {quickReplies.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => setBody(text)}
                className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] text-white/80 hover:border-snog-cyan hover:text-snog-cyan"
              >
                {text}
              </button>
            ))}
          </div>
          <form onSubmit={send} className="mt-2 flex items-center gap-2">
          <button type="button" onClick={()=>setAiOpen(true)} data-testid="ai-icebreaker-open"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-snog-pink to-snog-cyan text-white shadow-[0_0_18px_-6px_rgba(255,42,133,0.6)]"
            title="Snog AI icebreaker">
            <Wand2 className="h-4 w-4"/>
          </button>
          <input data-testid="chat-input" value={body} onChange={(e)=>setBody(e.target.value)}
            placeholder={user?.is_restricted ? "Sending disabled" : "Type a message…"}
            disabled={!!user?.is_restricted}
            className="flex-1 rounded-full border border-white/10 bg-white/8 px-4 py-2.5 outline-none focus:border-snog-pink disabled:opacity-45"/>
          <button data-testid="chat-send" disabled={!!user?.is_restricted} className="grid h-11 w-11 place-items-center rounded-full bg-snog-pink disabled:opacity-45"><Send className="h-4 w-4"/></button>
          </form>
        </>
      ) : data.gate?.gated && !feedbackOpen ? (
        <button onClick={()=>setFeedbackOpen(true)} className="btn-primary mt-2">Submit post-date feedback</button>
      ) : (
        <div className="mt-2 rounded-2xl bg-white/5 p-3 text-center text-xs text-white/60">
          Chat closed. Plenty more fish in the Thames.
        </div>
      )}

      {planOpen && <PlanDateModal matchId={matchId} onClose={()=>{ setPlanOpen(false); load(); }}/>}
      {feedbackOpen && <FeedbackModal matchId={matchId} onClose={()=>{ setFeedbackOpen(false); load(); }}/>}
      {reportOpen && (
        <ReportUserModal
          reportedUserId={other?.user_id}
          matchId={matchId}
          onClose={() => setReportOpen(false)}
        />
      )}
      {reportMessage && (
        <ReportUserModal
          reportedUserId={reportMessage.senderId}
          matchId={matchId}
          messageId={reportMessage.id}
          messagePreview={reportMessage.body}
          onClose={() => setReportMessage(null)}
        />
      )}
    </div>
  );
}

function PlanDateModal({ matchId, onClose }) {
  const [venues, setVenues] = useState([]);
  const [plan, setPlan] = useState({ venue_name: "", venue_address: "", lat: null, lng: null, planned_at: "" });
  const [created, setCreated] = useState(null);

  useEffect(() => {
    api.get("/london/venues").then(({ data }) => setVenues(data));
    api.get(`/chat/threads/${matchId}/plan`).then(({ data }) => {
      if (data?.planned_at) {
        setCreated(data);
        setPlan({
          venue_name: data.venue_name, venue_address: data.venue_address,
          lat: data.lat, lng: data.lng,
          planned_at: new Date(data.planned_at).toISOString().slice(0,16),
        });
      }
    });
  }, [matchId]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(`/chat/threads/${matchId}/plan_date`, {
        ...plan, planned_at: new Date(plan.planned_at).toISOString(),
      });
      setCreated(data); toast.success("Date planned!");
    } catch { toast.error("Couldn't save"); }
  };

  const safetyUrl = created?.safety_token ? `${window.location.origin}/safety/${created.safety_token}` : null;

  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-2xl font-black">Plan a date</h2>
      <p className="mb-4 text-xs text-white/60">Pick a London spot and a time. Then share with a mate, just to be sensible.</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-white/60">When?</div>
          <input type="datetime-local" data-testid="plan-when"
            value={plan.planned_at} onChange={(e)=>setPlan({...plan, planned_at:e.target.value})}
            className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"/>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-white/60">Venue</div>
          <div className="grid max-h-44 grid-cols-1 gap-2 overflow-y-auto pr-1 scroll-hide">
            {venues.map((v) => (
              <button key={v.name} type="button"
                onClick={()=>setPlan({...plan, venue_name:v.name, venue_address:v.address, lat:v.lat, lng:v.lng})}
                className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-left text-xs ${
                  plan.venue_name === v.name ? "border-snog-pink bg-snog-pink/15" : "border-white/10 hover:border-white/30"
                }`}>
                <div>
                  <div className="text-sm font-bold">{v.name}</div>
                  <div className="text-white/60">{v.address}</div>
                </div>
                <MapPin className="h-4 w-4 text-snog-pink"/>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs uppercase tracking-wider text-white/60">Or custom address</div>
          <input value={plan.venue_address} onChange={(e)=>setPlan({...plan, venue_address:e.target.value, venue_name: plan.venue_name || "Custom spot"})}
            className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2 text-sm"
            placeholder="e.g. Borough Market"/>
        </div>
        <button data-testid="plan-save" className="btn-primary w-full" disabled={!plan.planned_at || !plan.venue_name}>
          Save the date
        </button>
      </form>

      {safetyUrl && (
        <div className="mt-4 rounded-2xl border border-snog-cyan/40 bg-snog-cyan/10 p-3 text-xs">
          <div className="mb-2 flex items-center gap-2 text-snog-cyan"><ShieldCheck className="h-4 w-4"/> Safety share link</div>
          <div className="flex items-center gap-2 break-all">
            <code className="flex-1">{safetyUrl}</code>
            <button onClick={()=>{ navigator.clipboard.writeText(safetyUrl); toast.success("Copied"); }}
              data-testid="safety-copy" className="rounded-md bg-white/10 p-1.5"><Copy className="h-3.5 w-3.5"/></button>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent("Off on a date — details here: " + safetyUrl)}`}
             target="_blank" rel="noreferrer"
             data-testid="safety-whatsapp"
             className="mt-2 inline-flex w-full justify-center rounded-full bg-snog-cyan/20 px-3 py-2 text-snog-cyan">
            Send via WhatsApp
          </a>
        </div>
      )}
    </Modal>
  );
}

function FeedbackModal({ matchId, onClose }) {
  const [enjoyed, setEnjoyed] = useState(null);
  const [want, setWant] = useState(null);
  const [done, setDone] = useState(null);
  const submit = async () => {
    if (enjoyed === null || want === null) return;
    try {
      const { data } = await api.post(`/chat/threads/${matchId}/feedback`, { enjoyed, want_continue: want });
      setDone(data);
    } catch { toast.error("Couldn't submit"); }
  };
  return (
    <Modal onClose={onClose}>
      {!done ? (
        <>
          <h2 className="font-display text-2xl font-black">Post-date feedback</h2>
          <p className="mb-4 text-xs text-white/60">Both yes? Chat unlocks. Either no? Closes graciously. Ghosting is for wankers.</p>
          <Question label="Did you enjoy the date?">
            <Toggle value={enjoyed} onChange={setEnjoyed}/>
          </Question>
          <Question label="Want to keep chatting / plan another?">
            <Toggle value={want} onChange={setWant}/>
          </Question>
          <button data-testid="feedback-submit" className="btn-primary mt-4 w-full" onClick={submit} disabled={enjoyed===null||want===null}>
            Submit
          </button>
        </>
      ) : (
        <div className="text-center">
          <h2 className="font-display text-2xl font-black">{done.chat_open ? "Crack on!" : "Done & dusted"}</h2>
          <p className="mt-2 text-sm text-white/70">
            {done.chat_open
              ? "You both said yes. Chat's wide open."
              : done.both_submitted
                ? "Thanks for being honest. Chat closed gracefully."
                : "Thanks. Waiting on the other half."}
          </p>
          <button onClick={onClose} className="btn-primary mt-4">Close</button>
        </div>
      )}
    </Modal>
  );
}

function Question({ label, children }) {
  return <div className="mt-3"><div className="mb-2 font-display text-base font-bold">{label}</div>{children}</div>;
}
function Toggle({ value, onChange }) {
  return (
    <div className="flex gap-2">
      <button onClick={()=>onChange(true)} data-testid="fb-yes"
        className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${value===true?"bg-snog-pink text-white":"bg-white/10"}`}>Yes</button>
      <button onClick={()=>onChange(false)} data-testid="fb-no"
        className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${value===false?"bg-white/80 text-snog-ink":"bg-white/10"}`}>No</button>
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-snog-ink/85 p-4 backdrop-blur-md" onClick={onClose}>
      <div className="glass relative w-full max-w-md rounded-3xl p-6" onClick={(e)=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
