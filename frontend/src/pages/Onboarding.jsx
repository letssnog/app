import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Camera, ChevronRight, X, Check, Star, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  PRONOUN_OPTIONS, SMOKE_OPTIONS, DRINK_OPTIONS, WORKOUT_OPTIONS,
  HAS_KIDS, WANTS_KIDS, RELIGIONS, ZODIACS, EDUCATION, INTEREST_POOL,
} from "@/lib/options";
import HoldingScreen from "@/components/HoldingScreen";

/**
 * Multi-page onboarding wizard with framer-motion transitions.
 * Each step is its own page; "holding" interstitials appear between groups.
 */
const STEPS = [
  // Group 1: identity
  { key: "name", group: "About you" },
  { key: "age", group: "About you" },
  { key: "pronouns", group: "About you" },
  { key: "looking_for", group: "About you" },
  // hold 1
  { key: "hold:vibe", group: "hold", icon: "Sparkles", title: "Right, let's get the vibe", subtitle: "A few quick taps and we'll find your tribe.", accent: "Loosening up..." },
  // Group 2: bio bits
  { key: "job", group: "About you" },
  { key: "education", group: "About you" },
  { key: "height", group: "About you" },
  { key: "bio", group: "About you" },
  // hold 2
  { key: "hold:lifestyle", group: "hold", icon: "Coffee", title: "Lifestyle stuff", subtitle: "No judgment. Just helps the smart matching.", accent: "Brewing options..." },
  // Group 3: lifestyle
  { key: "smokes", group: "Lifestyle" },
  { key: "drinks", group: "Lifestyle" },
  { key: "workout", group: "Lifestyle" },
  { key: "kids", group: "Lifestyle" },
  { key: "religion", group: "Lifestyle" },
  { key: "zodiac", group: "Lifestyle" },
  // hold 3
  { key: "hold:photos", group: "hold", icon: "Heart", title: "Now, the fun bit", subtitle: "Pop in 4–6 photos. Real you, please.", accent: "Polishing the lens..." },
  // Group 4: media + prompts
  { key: "interests", group: "You in 3 words" },
  { key: "photos", group: "Photos" },
  { key: "prompts", group: "Prompts" },
  // hold 4
  { key: "hold:quiz", group: "hold", icon: "MapPin", title: "Last bit – the Vibe Quiz", subtitle: "8 questions. Powers your daily smart matches.", accent: "Stretching..." },
  // Group 5: quiz
  { key: "quiz", group: "Vibe Quiz" },
];

export default function Onboarding() {
  const nav = useNavigate();
  const { user, setUser, refresh } = useAuth();
  const [idx, setIdx] = useState(0);
  const [profile, setProfile] = useState({
    name: user?.name || "",
    age: user?.age || "",
    pronouns: user?.pronouns || "",
    gender: user?.gender || "",
    looking_for: user?.looking_for || "everyone",
    bio: user?.bio || "",
    height_cm: user?.height_cm || "",
    job: user?.job || "",
    education: user?.education || "",
    interests: user?.interests || [],
    age_min: user?.age_min || 21,
    age_max: user?.age_max || 45,
    smokes: user?.smokes || "",
    drinks: user?.drinks || "",
    workout: user?.workout || "",
    has_kids: user?.has_kids || "",
    wants_kids: user?.wants_kids || "",
    religion: user?.religion || "",
    zodiac: user?.zodiac || "",
    prompts: user?.prompts || [],
  });
  const [photos, setPhotos] = useState(user?.photos || []);
  const [quizQs, setQuizQs] = useState([]);
  const [answers, setAnswers] = useState(Array(8).fill(null));
  const [promptList, setPromptList] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/quiz/questions").then(({ data }) => setQuizQs(data));
    api.get("/profile_prompts").then(({ data }) => setPromptList(data));
  }, []);

  const step = STEPS[idx];
  const totalReal = STEPS.filter((s) => s.group !== "hold").length;
  const realIdx = STEPS.slice(0, idx + 1).filter((s) => s.group !== "hold").length;

  const next = () => setIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setIdx((i) => Math.max(i - 1, 0));

  // Auto-advance hold screens
  useEffect(() => {
    if (step?.group === "hold") {
      const t = setTimeout(next, 1700);
      return () => clearTimeout(t);
    }
  }, [idx]); // eslint-disable-line

  const persist = async (extra = {}) => {
    const payload = { ...profile, ...extra };
    if (payload.age) payload.age = parseInt(payload.age);
    if (payload.height_cm) payload.height_cm = parseInt(payload.height_cm);
    payload.age_min = parseInt(payload.age_min || 21);
    payload.age_max = parseInt(payload.age_max || 45);
    Object.keys(payload).forEach((k) => { if (payload[k] === "" || payload[k] === null) delete payload[k]; });
    try { await api.put("/users/me", payload); } catch {}
  };

  const submitQuiz = async () => {
    if (answers.some((a) => !a)) { toast.error("Answer all 8 to land your matches"); return; }
    setSaving(true);
    try {
      await persist();
      const { data } = await api.post("/users/me/quiz", { answers });
      setUser(data); await refresh();
      toast.success("You're in. Let's find your snog.");
      nav("/matches", { replace: true });
    } catch { toast.error("Quiz save failed"); }
    finally { setSaving(false); }
  };

  // Helpers ----
  const uploadPhoto = async (file) => {
    if (!file) return;
    try {
      const ext = (file.name || "img").split(".").pop()?.toLowerCase() || "jpg";
      const { data: pre } = await api.post("/users/me/photos/presign", { content_type: file.type, ext });
      await fetch(pre.upload_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      const { data: conf } = await api.post("/users/me/photos/confirm", { key: pre.key });
      setPhotos((p) => [...p, conf.url]);
    } catch { toast.error("Photo upload failed"); }
  };
  const removePhoto = async (path) => {
    await api.delete("/users/me/photos", { params: { path } });
    setPhotos((p) => p.filter((x) => x !== path));
  };

  const setProm = (i, key, val) => setProfile((p) => {
    const arr = [...(p.prompts || [])];
    while (arr.length <= i) arr.push({ q: "", a: "" });
    arr[i] = { ...arr[i], [key]: val };
    return { ...p, prompts: arr };
  });

  // Validation per step
  const canAdvance = () => {
    switch (step.key) {
      case "name": return !!profile.name?.trim();
      case "age": return profile.age && Number(profile.age) >= 18;
      case "pronouns": return !!profile.pronouns;
      case "looking_for": return !!profile.looking_for;
      case "bio": return !!profile.bio?.trim();
      case "interests": return (profile.interests || []).length >= 3;
      case "photos": return photos.length >= 1;
      default: return true;
    }
  };

  const handleNext = async () => {
    if (!canAdvance()) { toast.error("This bit's required, mate"); return; }
    // Persist on each non-hold step (best-effort)
    if (step.group !== "hold") await persist();
    next();
  };

  // Top header
  return (
    <div className="min-h-[100svh] bg-snog-ink text-white relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[420px] w-[420px] rounded-full bg-snog-pink/15 blur-[140px]"/>
      <div className="pointer-events-none absolute top-1/3 right-[-12rem] h-[360px] w-[360px] rounded-full bg-snog-cyan/10 blur-[140px]"/>

      {/* Top bar */}
      {step.group !== "hold" && (
        <div className="relative z-10 mx-auto max-w-md px-5 pt-6">
          <div className="flex items-center gap-3">
            <button onClick={back} disabled={idx===0}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/8 disabled:opacity-30">
              <ArrowLeft className="h-4 w-4"/>
            </button>
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                animate={{ width: `${(realIdx / totalReal) * 100}%` }}
                className="h-full bg-snog-pink"
              />
            </div>
            <span className="text-xs text-white/50">{realIdx}/{totalReal}</span>
          </div>
          <div className="mt-4 mb-2 text-xs uppercase tracking-[0.2em] text-snog-pink">{step.group}</div>
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-md px-5 pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.key}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
          >
            {step.group === "hold" && (
              <HoldingScreen icon={step.icon} title={step.title} subtitle={step.subtitle} accent={step.accent}/>
            )}

            {step.key === "name" && (
              <Big title="What do mates call you?" sub="Your first name does the trick.">
                <input data-testid="onb-name" value={profile.name}
                  onChange={(e)=>setProfile({...profile, name:e.target.value})}
                  className="snog-big-input" placeholder="Alex" autoFocus/>
              </Big>
            )}

            {step.key === "age" && (
              <Big title="How old are you?" sub="Just so we match you sensibly.">
                <input data-testid="onb-age" type="number" min="18" max="80" value={profile.age}
                  onChange={(e)=>setProfile({...profile, age:e.target.value})}
                  className="snog-big-input text-center" placeholder="29" autoFocus/>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <NumField label="Match age min" value={profile.age_min} onChange={(v)=>setProfile({...profile, age_min:v})}/>
                  <NumField label="Match age max" value={profile.age_max} onChange={(v)=>setProfile({...profile, age_max:v})}/>
                </div>
              </Big>
            )}

            {step.key === "pronouns" && (
              <Big title="Your pronouns" sub="Pick one (or pick 'ask me').">
                <ChipChoices value={profile.pronouns} options={PRONOUN_OPTIONS.map(p=>[p,p])}
                  onChange={(v)=>setProfile({...profile, pronouns:v})}/>
                <div className="mt-6">
                  <Label>I am</Label>
                  <ChipChoices value={profile.gender}
                    options={[["woman","Woman"],["man","Man"],["nonbinary","Non-binary"],["other","Other"]]}
                    onChange={(v)=>setProfile({...profile, gender:v})}/>
                </div>
              </Big>
            )}

            {step.key === "looking_for" && (
              <Big title="Who are you up for?" sub="Snogs and beyond.">
                <ChipChoices value={profile.looking_for}
                  options={[["woman","Women"],["man","Men"],["everyone","Everyone"]]}
                  onChange={(v)=>setProfile({...profile, looking_for:v})}/>
              </Big>
            )}

            {step.key === "job" && (
              <Big title="What do you do?" sub="Job, hustle, or 'professional snoozer'.">
                <input value={profile.job} onChange={(e)=>setProfile({...profile, job:e.target.value})}
                  className="snog-big-input" placeholder="Designer at a Hackney studio" autoFocus/>
              </Big>
            )}

            {step.key === "education" && (
              <Big title="Education?" sub="Skip if it's irrelevant.">
                <ChipChoices value={profile.education} options={EDUCATION.map((e)=>[e,e])}
                  onChange={(v)=>setProfile({...profile, education:v})}/>
              </Big>
            )}

            {step.key === "height" && (
              <Big title="Your height" sub="In centimetres. We'll all survive.">
                <input type="number" min="120" max="220" value={profile.height_cm}
                  onChange={(e)=>setProfile({...profile, height_cm:e.target.value})}
                  className="snog-big-input text-center" placeholder="178" autoFocus/>
              </Big>
            )}

            {step.key === "bio" && (
              <Big title="Your bio" sub="Two cheeky lines beat 200 characters of nothing.">
                <textarea data-testid="onb-bio" rows="4" maxLength="220"
                  value={profile.bio} onChange={(e)=>setProfile({...profile, bio:e.target.value})}
                  className="snog-big-input" autoFocus
                  placeholder="Pub quiz captain, dog enthusiast, will judge your roast potatoes."/>
              </Big>
            )}

            {step.key === "smokes" && (
              <Big title="Smoke?" sub="Be honest, no shame.">
                <ChipChoices value={profile.smokes} options={SMOKE_OPTIONS} onChange={(v)=>setProfile({...profile,smokes:v})}/>
              </Big>
            )}
            {step.key === "drinks" && (
              <Big title="Drink?" sub="A pint or three? Or never?">
                <ChipChoices value={profile.drinks} options={DRINK_OPTIONS} onChange={(v)=>setProfile({...profile,drinks:v})}/>
              </Big>
            )}
            {step.key === "workout" && (
              <Big title="Workout?" sub="Spin class warrior or sofa pro?">
                <ChipChoices value={profile.workout} options={WORKOUT_OPTIONS} onChange={(v)=>setProfile({...profile,workout:v})}/>
              </Big>
            )}
            {step.key === "kids" && (
              <Big title="Kids" sub="Now and the future.">
                <Label>Got any?</Label>
                <ChipChoices value={profile.has_kids} options={HAS_KIDS} onChange={(v)=>setProfile({...profile,has_kids:v})}/>
                <div className="mt-5"><Label>Want any?</Label>
                  <ChipChoices value={profile.wants_kids} options={WANTS_KIDS} onChange={(v)=>setProfile({...profile,wants_kids:v})}/>
                </div>
              </Big>
            )}
            {step.key === "religion" && (
              <Big title="Religion / spirituality" sub="Optional. Skip if you'd rather.">
                <ChipChoices value={profile.religion} options={RELIGIONS.map((r)=>[r,r])}
                  onChange={(v)=>setProfile({...profile, religion:v})}/>
              </Big>
            )}
            {step.key === "zodiac" && (
              <Big title="Star sign?" sub="For the gals & guys who care.">
                <ChipChoices value={profile.zodiac} options={ZODIACS.map((z)=>[z,z])}
                  onChange={(v)=>setProfile({...profile, zodiac:v})}/>
              </Big>
            )}

            {step.key === "interests" && (
              <Big title="Three things you love" sub="Min 3 · max 5">
                <div className="flex flex-wrap gap-2">
                  {INTEREST_POOL.map((i) => {
                    const sel = profile.interests.includes(i);
                    return (
                      <button type="button" key={i}
                        onClick={()=>setProfile((p)=>{
                          const has = p.interests.includes(i);
                          if (has) return { ...p, interests: p.interests.filter((x)=>x!==i) };
                          if (p.interests.length >= 5) return p;
                          return { ...p, interests: [...p.interests, i] };
                        })}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                          sel ? "bg-snog-pink border-snog-pink text-white" : "border-white/15 text-white/70 hover:border-white/40"
                        }`}>{i}</button>
                    );
                  })}
                </div>
                <div className="mt-2 text-xs text-white/50">{profile.interests.length}/5</div>
              </Big>
            )}

            {step.key === "photos" && (
              <Big title="Add 4–6 photos" sub="First one's your hero shot. You can reorder later in your profile.">
                <div className="grid grid-cols-3 gap-3">
                  {photos.map((p, i) => (
                    <div key={p} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10">
                      <img src={fileUrl(p)} alt="" className="h-full w-full object-cover"/>
                      {i===0 && <div className="absolute left-1.5 top-1.5 rounded-full bg-snog-pink/90 px-2 py-0.5 text-[9px] font-bold tracking-widest">PRIMARY</div>}
                      <button onClick={()=>removePhoto(p)} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/70">
                        <X className="h-3.5 w-3.5"/>
                      </button>
                    </div>
                  ))}
                  {photos.length < 6 && (
                    <label data-testid="onb-photo-upload" className="grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-white/20 text-white/60 hover:border-snog-pink hover:text-snog-pink">
                      <Camera className="h-6 w-6"/>
                      <input type="file" accept="image/*" className="hidden" onChange={(e)=>uploadPhoto(e.target.files?.[0])}/>
                    </label>
                  )}
                </div>
                <p className="mt-2 text-xs text-white/50">{photos.length}/6 · min 1 to continue</p>
              </Big>
            )}

            {step.key === "prompts" && (
              <Big title="Pop in some prompts" sub="Fancy a snog? Show some personality. Up to 3.">
                <div className="space-y-3">
                  {[0,1,2].map((i) => {
                    const cur = profile.prompts?.[i] || { q:"", a:"" };
                    return (
                      <div key={i} className="glass rounded-2xl p-3">
                        <select value={cur.q} onChange={(e)=>setProm(i,"q",e.target.value)}
                          className="w-full rounded-xl bg-snog-navy border border-white/10 px-3 py-2 text-sm">
                          <option value="">Pick a prompt…</option>
                          {promptList.map((p)=> <option key={p} value={p}>{p}</option>)}
                        </select>
                        <textarea rows="2" maxLength="180" value={cur.a}
                          onChange={(e)=>setProm(i,"a",e.target.value)}
                          className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm"
                          placeholder="Your cheeky answer…"/>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-white/50">Optional but recommended.</p>
              </Big>
            )}

            {step.key === "quiz" && (
              <div>
                <h1 className="font-display text-3xl font-black">Vibe Quiz</h1>
                <p className="text-sm text-white/70 mt-1">8 quick questions. Powers your matches.</p>
                <div className="mt-5 space-y-4">
                  {quizQs.map((q, qi) => (
                    <div key={q.id} className="glass rounded-2xl p-4">
                      <div className="text-xs uppercase tracking-widest text-snog-pink">Q{qi + 1}</div>
                      <div className="font-display text-lg font-bold">{q.q}</div>
                      <div className="mt-3 grid gap-2">
                        {q.options.map((o) => (
                          <button key={o.k} type="button" data-testid={`quiz-q${qi+1}-${o.k}`}
                            onClick={()=>setAnswers((a)=>{const n=[...a];n[qi]=o.k;return n;})}
                            className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left transition-all ${
                              answers[qi] === o.k ? "border-snog-pink bg-snog-pink/15" : "border-white/10 hover:border-white/30"
                            }`}>
                            <span className="text-sm">{o.t}</span>
                            {answers[qi] === o.k && <Check className="h-4 w-4 text-snog-pink"/>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button data-testid="onb-quiz-submit" disabled={saving || answers.some((a)=>!a)}
                  onClick={submitQuiz} className="btn-primary mt-5 w-full">
                  {saving ? "Sussing you out…" : "Find my snogs"}
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Action button (skip on hold + quiz) */}
        {step.group !== "hold" && step.key !== "quiz" && (
          <button data-testid="onb-step-next"
            onClick={handleNext}
            disabled={!canAdvance()}
            className="btn-primary mt-8 w-full">
            {idx === STEPS.length - 1 ? "Done" : "Next"} <ChevronRight className="ml-1 inline h-4 w-4"/>
          </button>
        )}
      </div>

      <style>{`
        .snog-big-input {
          width:100%;border-radius:18px;background:rgba(20,27,51,0.6);
          border:1px solid rgba(255,255,255,0.1);padding:18px 16px;color:#fff;outline:none;
          font-size:18px;font-family:'Outfit',sans-serif;transition:all .15s;
        }
        .snog-big-input:focus{border-color:#FF2A85;box-shadow:0 0 0 3px rgba(255,42,133,0.15)}
      `}</style>
    </div>
  );
}

function Big({ title, sub, children }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-black tracking-tight leading-tight">{title}</h1>
      {sub && <p className="mt-2 text-sm text-white/60">{sub}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}
function Label({ children }) { return <div className="mb-2 text-xs uppercase tracking-wider text-white/60">{children}</div>; }
function ChipChoices({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v,t]) => (
        <button key={v} type="button" onClick={()=>onChange(v)}
          className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-all ${
            value===v ? "bg-snog-pink border-snog-pink text-white" : "border-white/15 text-white/75 hover:border-white/40"
          }`}>{t}</button>
      ))}
    </div>
  );
}
function NumField({ label, value, onChange }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input type="number" min="18" max="80" value={value}
        onChange={(e)=>onChange(parseInt(e.target.value || 0))}
        className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"/>
    </label>
  );
}
