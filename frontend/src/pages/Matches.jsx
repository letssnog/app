import { useEffect, useState } from "react";
import { api, fileUrl } from "@/lib/api";
import { Heart, X, Star, Sparkles, MapPin, Briefcase, Eye, Wand2 } from "lucide-react";
import { toast } from "sonner";
import ProfileDetail from "@/components/ProfileDetail";
import DateRequestSheet from "@/components/DateRequestSheet";
import MatchAnimation from "@/components/MatchAnimation";
import { motion } from "framer-motion";

export default function Matches() {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState({});
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [matchToast, setMatchToast] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [dateSheet, setDateSheet] = useState(false);
  const [fullProfile, setFullProfile] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/matches/daily");
      setData(data); setIdx(0);
      // Kick off Snog AI insights asynchronously (don't block UI)
      api.get("/snog_ai/insights")
        .then(({ data }) => setInsights(data.insights || {}))
        .catch(()=>{});
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const profile = data?.profiles?.[idx];

  const swipe = async (action, dateRequest = null) => {
    if (!profile) return;
    try {
      const payload = { target_id: profile.user_id, action };
      if (dateRequest) payload.date_request = dateRequest;
      const { data: res } = await api.post("/matches/swipe", payload);
      if (res.matched) {
        setMatchToast(profile);
      } else if (dateRequest) {
        toast.success("Date request sent · 48h ticking ⏳");
      }
    } catch { toast.error("Couldn't save that"); }
    setDetailOpen(false);
    setDateSheet(false);
    setIdx((i) => i + 1);
  };

  const openDetail = async () => {
    if (!profile) return;
    try {
      const { data } = await api.get(`/users/${profile.user_id}`);
      setFullProfile(data);
      setDetailOpen(true);
    } catch { toast.error("Couldn't load profile"); }
  };

  if (loading) return <SkeletonCard/>;

  const remaining = (data?.profiles?.length || 0) - idx;
  if (!data || remaining <= 0) {
    return (
      <div className="pt-10 text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-3xl bg-snog-pink/15">
          <Sparkles className="h-9 w-9 text-snog-pink"/>
        </div>
        <h1 className="font-display text-3xl font-black">All snogged out for today</h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-white/70">
          {data?.total ? `You powered through ${data.total} smart matches.` : "We're still finding your tribe."} New ones drop at midnight, London time.
        </p>
        <div className="mt-6 grid gap-3">
          <button onClick={load} className="btn-ghost w-full">Refresh</button>
          <a href="/events" className="btn-primary w-full text-center">Try a speed-dating night</a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-black tracking-tight">Today's snogs</h1>
          <p className="text-sm text-white/60">{remaining} of {data.total} left · resets at midnight</p>
        </div>
        <span className="font-accent text-2xl text-snog-cyan">#{idx + 1}</span>
      </div>

      <button className="relative aspect-[3/4] w-full block premium-pressable" onClick={openDetail} data-testid="open-profile-detail">
        {data.profiles.slice(idx, idx + 3).reverse().map((p, i, arr) => {
          const top = i === arr.length - 1;
          return <SwipeCard key={p.user_id} profile={p} z={i + 1} active={top} insight={top ? insights[p.user_id] : null}/>;
        })}
        <span className="pointer-events-none absolute right-3 bottom-20 z-30 inline-flex items-center gap-1 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold backdrop-blur">
          <Eye className="h-3.5 w-3.5"/> Tap for full profile
        </span>
      </button>

      <div className="mt-6 flex items-center justify-center gap-5">
        <ActionBtn testid="swipe-pass-btn" onClick={()=>swipe("pass")} cls="border-white/15 hover:border-white/40 text-white">
          <X className="h-7 w-7"/>
        </ActionBtn>
        <ActionBtn testid="swipe-super-btn" onClick={()=>setDateSheet(true)} cls="border-snog-cyan/60 text-snog-cyan hover:bg-snog-cyan/10" big>
          <Star className="h-8 w-8 fill-snog-cyan"/>
        </ActionBtn>
        <ActionBtn testid="swipe-like-btn" onClick={()=>swipe("like")} cls="border-snog-pink text-snog-pink bg-snog-pink/10 hover:bg-snog-pink/25" big>
          <Heart className="h-8 w-8 fill-snog-pink"/>
        </ActionBtn>
      </div>
      <p className="mt-3 text-center text-[11px] text-white/50">Tap ⭐ to suggest a date along with your like</p>

      <MatchAnimation open={!!matchToast} profile={matchToast} onClose={()=>setMatchToast(null)}/>

      <ProfileDetail
        open={detailOpen} profile={fullProfile}
        onClose={()=>setDetailOpen(false)}
        onPass={()=>swipe("pass")}
        onLike={()=>swipe("like")}
        onSuggestDate={()=>{ setDetailOpen(false); setDateSheet(true); }}
      />

      <DateRequestSheet
        open={dateSheet} profile={profile}
        onClose={()=>setDateSheet(false)}
        onSubmit={(dr)=>swipe("super", dr)}
      />
    </div>
  );
}

function SwipeCard({ profile, z, active, insight }) {
  const photo = profile.photos?.[0];
  const stackY = -(z - 1) * 8;
  const stackScale = 1 - (z - 1) * 0.04;
  return (
    <motion.div
      className="swipe-card premium-card absolute inset-0 overflow-hidden rounded-[28px] border border-white/10 bg-snog-navy"
      initial={{ opacity: 0, y: stackY + 14 }}
      animate={{ opacity: active ? 1 : 0.7, y: stackY, scale: stackScale }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={{ zIndex: 20 - z }}
    >
      {photo
        ? <img src={fileUrl(photo)} alt={profile.name} className="h-full w-full object-cover"/>
        : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-snog-navy to-snog-ink"><Heart className="h-12 w-12 text-snog-pink/40"/></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent"/>
      <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
        <div className="rounded-full bg-snog-pink/95 px-3 py-1 text-[11px] font-bold tracking-widest">
          {Math.round(profile.score * 100)}% MATCH
        </div>
        {insight?.vibe && (
          <div className="rounded-full bg-gradient-to-r from-snog-pink to-snog-cyan px-2.5 py-1 text-[10px] font-bold tracking-wide flex items-center gap-1">
            <Wand2 className="h-3 w-3"/> {insight.vibe}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="font-display text-3xl font-black leading-tight">
          {profile.name}{profile.age ? <span className="text-white/80">, {profile.age}</span> : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/70">
          <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3"/> London</span>
          {profile.job && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3"/>{profile.job}</span>}
        </div>
        {profile.bio && <p className="mt-2 line-clamp-2 text-sm text-white/85">{profile.bio}</p>}
        {!!profile.match_reasons?.length && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.match_reasons.map((r) => (
              <span key={r} className="rounded-full border border-white/15 bg-black/35 px-2 py-0.5 text-[10px] text-white/85">
                {r}
              </span>
            ))}
          </div>
        )}
        {insight?.why && (
          <div className="mt-2 flex items-start gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 backdrop-blur-sm border border-white/10">
            <Wand2 className="h-3.5 w-3.5 text-snog-cyan mt-0.5 shrink-0"/>
            <p className="text-[11px] leading-snug text-white/90"><span className="font-semibold text-snog-cyan">Snog AI: </span>{insight.why}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ActionBtn({ children, onClick, cls, big, testid }) {
  return (
    <button data-testid={testid} onClick={(e)=>{ e.stopPropagation(); onClick(); }}
      className={`grid place-items-center rounded-full border-2 transition-all active:scale-95 ${cls} ${big ? "h-16 w-16" : "h-14 w-14"}`}>
      {children}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse">
      <div className="mb-4 h-9 w-2/3 rounded bg-white/10"/>
      <div className="aspect-[3/4] w-full rounded-3xl bg-white/5"/>
      <div className="mt-6 flex justify-center gap-5">
        <div className="h-14 w-14 rounded-full bg-white/10"/>
        <div className="h-16 w-16 rounded-full bg-white/10"/>
        <div className="h-16 w-16 rounded-full bg-white/10"/>
      </div>
    </div>
  );
}
