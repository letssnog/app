import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api, fileUrl } from "@/lib/api";
import { LogOut, Crown, Pencil, ShieldCheck, X, Star, ChevronUp, Camera, Save, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  PRONOUN_OPTIONS, SMOKE_OPTIONS, DRINK_OPTIONS, WORKOUT_OPTIONS,
  HAS_KIDS, WANTS_KIDS, RELIGIONS, ZODIACS, EDUCATION
} from "@/lib/options";

export default function Profile() {
  const { user, logout, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  if (!user) return null;
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h1 className="font-display text-3xl font-black flex-1">You</h1>
        {!editing && (
          <button onClick={()=>setEditing(true)} data-testid="edit-toggle" className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 hover:bg-white/15">
            <Pencil className="h-4 w-4"/>
          </button>
        )}
        <button onClick={logout} data-testid="logout-btn" className="text-xs text-white/60 hover:text-white">
          <LogOut className="mr-1 inline h-3.5 w-3.5"/> Log out
        </button>
      </div>

      <PhotoManager user={user} onChange={refresh}/>

      {editing
        ? <EditForm user={user} onDone={async ()=>{ await refresh(); setEditing(false); toast.success("Profile saved"); }} onCancel={()=>setEditing(false)}/>
        : <ProfileView user={user}/>}

      {/* Premium upsell */}
      <motion.div className="mt-6 relative overflow-hidden rounded-3xl border border-snog-pink/30 bg-gradient-to-br from-snog-pink/15 via-snog-navy to-snog-ink p-5 premium-card"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
        <Crown className="absolute right-4 top-4 h-6 w-6 text-snog-pink"/>
        <div className="text-xs font-semibold uppercase tracking-widest text-snog-pink">Snog Premium · coming soon</div>
        <div className="mt-1 font-display text-xl font-black">£4.99/mo · £39/yr</div>
        <p className="mt-2 text-xs text-white/70">Unlimited daily matches, extra event slots, profile boost, see who liked you. Free core stays free, forever.</p>
        <ul className="mt-3 space-y-1 text-xs text-white/80">
          <li>• 3 priority boosts per week</li>
          <li>• Advanced filters and intent badges</li>
          <li>• Early access to premium events</li>
        </ul>
        <button
          className="btn-primary mt-3 px-4 py-2 text-xs"
          onClick={() => toast.success("Premium waitlist joined. We'll ping you first.")}
        >
          Join premium waitlist
        </button>
      </motion.div>

      <div className="mt-4 rounded-3xl border border-white/10 p-4 text-xs text-white/60 premium-card">
        <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-snog-cyan"/> Always meet in public, share the safety link with a mate.</div>
      </div>
    </div>
  );
}

function ProfileView({ user }) {
  return (
    <div className="glass mt-3 rounded-3xl p-5">
      <div className="font-display text-2xl font-black">{user.name}{user.age ? `, ${user.age}` : ""}</div>
      {user.pronouns && <div className="text-xs text-white/60">{user.pronouns}</div>}
      <div className="text-xs text-white/60 mt-0.5">{user.email}</div>
      {user.is_admin && <span className="mt-1 inline-block rounded-full bg-snog-cyan/20 px-2 py-0.5 text-[10px] font-bold text-snog-cyan">ADMIN</span>}
      {user.bio && <p className="mt-3 text-sm text-white/85">{user.bio}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {user.job && <Tag>{user.job}</Tag>}
        {user.education && <Tag>{user.education}</Tag>}
        {user.height_cm && <Tag>{user.height_cm} cm</Tag>}
        {user.smokes && <Tag>Smokes: {user.smokes}</Tag>}
        {user.drinks && <Tag>Drinks: {user.drinks}</Tag>}
        {user.workout && <Tag>Workout: {user.workout}</Tag>}
        {user.wants_kids && <Tag>Kids: {user.wants_kids.replace(/_/g,' ')}</Tag>}
        {user.religion && <Tag>{user.religion}</Tag>}
        {user.zodiac && <Tag>{user.zodiac}</Tag>}
      </div>
      {!!user.interests?.length && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] uppercase tracking-widest text-white/50">Into</div>
          <div className="flex flex-wrap gap-1.5">
            {user.interests.map((i)=> <Tag key={i}>{i}</Tag>)}
          </div>
        </div>
      )}
      {user.prompts?.filter(p=>p?.q && p?.a).length > 0 && (
        <div className="mt-4 space-y-2">
          {user.prompts.filter(p=>p?.q && p?.a).map((p, i) => (
            <div key={i} className="rounded-2xl border border-white/10 p-3">
              <div className="text-[10px] uppercase tracking-widest text-snog-pink">{p.q}</div>
              <div className="font-display text-base">{p.a}</div>
            </div>
          ))}
        </div>
      )}
      <Link to="/onboarding" className="mt-4 inline-block text-xs text-snog-cyan underline-offset-4 hover:underline" data-testid="onboarding-redo">
        Redo full vibe quiz / onboarding
      </Link>
    </div>
  );
}

function Tag({ children }) {
  return <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs">{children}</span>;
}

function PhotoManager({ user, onChange }) {
  const [photos, setPhotos] = useState(user.photos || []);
  useEffect(()=>setPhotos(user.photos || []), [user]);
  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/users/me/photos", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPhotos((p)=>[...p, data.path]); onChange?.();
    } catch { toast.error("Upload failed"); }
  };
  const remove = async (path) => {
    await api.delete("/users/me/photos", { params: { path } });
    const next = photos.filter((x)=>x!==path); setPhotos(next); onChange?.();
  };
  const promote = async (path) => {
    const next = [path, ...photos.filter((x)=>x!==path)];
    setPhotos(next);
    try { await api.post("/users/me/photos/reorder", { paths: next }); toast.success("New primary set"); onChange?.(); }
    catch { toast.error("Couldn't reorder"); }
  };
  const move = async (idx, dir) => {
    const next = [...photos];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    setPhotos(next);
    try { await api.post("/users/me/photos/reorder", { paths: next }); onChange?.(); } catch {}
  };

  return (
    <div className="rounded-3xl bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-white/60">Your photos</div>
        <div className="text-[10px] text-white/40">{photos.length}/6 · first one is primary</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={p} className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-white/10">
            <img src={fileUrl(p)} alt="" className="h-full w-full object-cover"/>
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-snog-pink/90 px-2 py-0.5 text-[9px] font-bold tracking-widest">PRIMARY</span>}
            <div className="absolute inset-0 flex flex-col justify-between bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex justify-end gap-1 p-1">
                <button onClick={()=>remove(p)} data-testid={`photo-remove-${i}`} className="grid h-7 w-7 place-items-center rounded-full bg-black/70"><X className="h-3.5 w-3.5"/></button>
              </div>
              <div className="flex items-center justify-between gap-1 p-1">
                {i > 0 ? (
                  <button onClick={()=>promote(p)} data-testid={`photo-promote-${i}`} className="rounded-full bg-snog-pink px-2 py-1 text-[10px] font-bold flex items-center gap-1">
                    <Star className="h-3 w-3 fill-white"/> Make primary
                  </button>
                ) : <span/>}
                <div className="flex gap-1">
                  <button onClick={()=>move(i, -1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/15"><ChevronUp className="h-3.5 w-3.5"/></button>
                  <button onClick={()=>move(i, 1)} className="grid h-7 w-7 place-items-center rounded-full bg-white/15 rotate-180"><ChevronUp className="h-3.5 w-3.5"/></button>
                </div>
              </div>
            </div>
            {/* mobile-friendly always-visible controls */}
            <div className="absolute inset-0 sm:hidden flex flex-col">
              <div className="ml-auto flex gap-1 p-1.5">
                <button onClick={()=>remove(p)} data-testid={`mphoto-remove-${i}`} className="grid h-7 w-7 place-items-center rounded-full bg-black/70 backdrop-blur"><X className="h-3.5 w-3.5"/></button>
              </div>
              <div className="mt-auto flex justify-between p-1.5">
                {i > 0 ? (
                  <button onClick={()=>promote(p)} data-testid={`mphoto-promote-${i}`} className="rounded-full bg-snog-pink/90 px-2 py-1 text-[10px] font-bold backdrop-blur">★ Primary</button>
                ) : <span/>}
                <div className="flex gap-1">
                  <button onClick={()=>move(i,-1)} className="grid h-7 w-7 place-items-center rounded-full bg-black/70 backdrop-blur"><ChevronUp className="h-3.5 w-3.5"/></button>
                  <button onClick={()=>move(i,1)} className="grid h-7 w-7 place-items-center rounded-full bg-black/70 backdrop-blur rotate-180"><ChevronUp className="h-3.5 w-3.5"/></button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {photos.length < 6 && (
          <label data-testid="profile-photo-add" className="grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-white/20 text-white/60 hover:border-snog-pink hover:text-snog-pink">
            <Plus className="h-6 w-6"/>
            <span className="mt-1 text-[10px]">Add photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={(e)=>upload(e.target.files?.[0])}/>
          </label>
        )}
      </div>
    </div>
  );
}

function EditForm({ user, onDone, onCancel }) {
  const [form, setForm] = useState({
    name: user.name || "", age: user.age || "", pronouns: user.pronouns || "",
    looking_for: user.looking_for || "everyone", bio: user.bio || "",
    height_cm: user.height_cm || "", job: user.job || "", education: user.education || "",
    smokes: user.smokes || "", drinks: user.drinks || "", workout: user.workout || "",
    has_kids: user.has_kids || "", wants_kids: user.wants_kids || "",
    religion: user.religion || "", zodiac: user.zodiac || "",
    age_min: user.age_min, age_max: user.age_max,
    interests: user.interests || [], prompts: user.prompts || [],
  });
  const [promptList, setPromptList] = useState([]);
  useEffect(() => { api.get("/profile_prompts").then(({data})=>setPromptList(data)); }, []);

  const setProm = (i, key, val) => setForm((p) => {
    const arr = [...(p.prompts || [])];
    while (arr.length <= i) arr.push({ q: "", a: "" });
    arr[i] = { ...arr[i], [key]: val };
    return { ...p, prompts: arr };
  });

  const save = async () => {
    const payload = { ...form };
    if (payload.age) payload.age = parseInt(payload.age);
    if (payload.height_cm) payload.height_cm = parseInt(payload.height_cm);
    payload.age_min = parseInt(payload.age_min);
    payload.age_max = parseInt(payload.age_max);
    Object.keys(payload).forEach((k)=>{ if (payload[k]==="" || payload[k]===null) delete payload[k]; });
    try { await api.put("/users/me", payload); onDone(); } catch { toast.error("Save failed"); }
  };

  return (
    <div className="glass mt-3 rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">Edit profile</h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs text-white/60">Cancel</button>
          <button onClick={save} data-testid="profile-save" className="btn-primary px-4 py-2 text-xs"><Save className="mr-1 inline h-3 w-3"/>Save</button>
        </div>
      </div>

      <Field label="Name"><Input value={form.name} onChange={(v)=>setForm({...form, name:v})}/></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Age"><Input type="number" value={form.age} onChange={(v)=>setForm({...form, age:v})}/></Field>
        <Field label="Height (cm)"><Input type="number" value={form.height_cm} onChange={(v)=>setForm({...form, height_cm:v})}/></Field>
      </div>
      <Field label="Pronouns"><Chips value={form.pronouns} options={PRONOUN_OPTIONS.map(p=>[p,p])} onChange={(v)=>setForm({...form, pronouns:v})}/></Field>
      <Field label="Looking for"><Chips value={form.looking_for} options={[["woman","Women"],["man","Men"],["everyone","Everyone"]]} onChange={(v)=>setForm({...form, looking_for:v})}/></Field>
      <Field label="Job"><Input value={form.job} onChange={(v)=>setForm({...form, job:v})}/></Field>
      <Field label="Education"><Chips value={form.education} options={EDUCATION.map(e=>[e,e])} onChange={(v)=>setForm({...form, education:v})}/></Field>
      <Field label="Bio"><textarea rows="3" maxLength="220" value={form.bio} onChange={(e)=>setForm({...form, bio:e.target.value})} className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2 text-sm"/></Field>

      <Field label="Smoke"><Chips value={form.smokes} options={SMOKE_OPTIONS} onChange={(v)=>setForm({...form, smokes:v})}/></Field>
      <Field label="Drink"><Chips value={form.drinks} options={DRINK_OPTIONS} onChange={(v)=>setForm({...form, drinks:v})}/></Field>
      <Field label="Workout"><Chips value={form.workout} options={WORKOUT_OPTIONS} onChange={(v)=>setForm({...form, workout:v})}/></Field>
      <Field label="Got kids?"><Chips value={form.has_kids} options={HAS_KIDS} onChange={(v)=>setForm({...form, has_kids:v})}/></Field>
      <Field label="Want kids?"><Chips value={form.wants_kids} options={WANTS_KIDS} onChange={(v)=>setForm({...form, wants_kids:v})}/></Field>
      <Field label="Religion"><Chips value={form.religion} options={RELIGIONS.map(r=>[r,r])} onChange={(v)=>setForm({...form, religion:v})}/></Field>
      <Field label="Zodiac"><Chips value={form.zodiac} options={ZODIACS.map(z=>[z,z])} onChange={(v)=>setForm({...form, zodiac:v})}/></Field>

      <Field label="Prompts">
        <div className="space-y-2">
          {[0,1,2].map((i) => {
            const cur = form.prompts?.[i] || { q:"", a:"" };
            return (
              <div key={i} className="rounded-2xl border border-white/10 p-3">
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
      </Field>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-white/60">{label}</div>{children}</label>;
}
function Input({ type="text", value, onChange }) {
  return <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2 text-sm"/>;
}
function Chips({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(([v,t]) => (
        <button key={v} type="button" onClick={()=>onChange(v)}
          className={`rounded-full border px-3 py-1.5 text-xs transition-all ${
            value===v ? "bg-snog-pink border-snog-pink text-white" : "border-white/15 text-white/70 hover:border-white/40"
          }`}>{t}</button>
      ))}
    </div>
  );
}
