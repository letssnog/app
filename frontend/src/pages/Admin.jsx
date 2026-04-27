import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, MessageSquare, Flag, CalendarDays, Plus,
  Ban, ShieldCheck, Search
} from "lucide-react";

const TABS = [
  { k: "stats", label: "Overview", icon: LayoutDashboard },
  { k: "users", label: "Users", icon: Users },
  { k: "messages", label: "Messages", icon: MessageSquare },
  { k: "reports", label: "Reports", icon: Flag },
  { k: "events", label: "Events", icon: CalendarDays },
];

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("stats");

  useEffect(() => {
    if (user && !user.is_admin) nav("/matches", { replace: true });
  }, [user, nav]);

  if (!user?.is_admin) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h1 className="font-display text-3xl font-black">Admin</h1>
        <Link to="/profile" className="ml-auto text-xs text-white/60 hover:text-white">Back to app</Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 scroll-hide">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.k} onClick={()=>setTab(t.k)} data-testid={`admin-tab-${t.k}`}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                tab===t.k ? "bg-snog-pink border-snog-pink text-white" : "border-white/15 text-white/70 hover:border-white/40"
              }`}>
              <Icon className="h-3.5 w-3.5"/>{t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        {tab === "stats" && <StatsTab/>}
        {tab === "users" && <UsersTab/>}
        {tab === "messages" && <MessagesTab/>}
        {tab === "reports" && <ReportsTab/>}
        {tab === "events" && <EventsTab/>}
      </div>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  useEffect(()=>{ api.get("/admin/stats").then(({data})=>setStats(data)); }, []);
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        ["Users", stats?.users], ["Matches", stats?.matches],
        ["Events", stats?.events], ["Messages", stats?.messages],
      ].map(([label, val]) => (
        <div key={label} className="glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-widest text-white/60">{label}</div>
          <div className="font-display text-3xl font-black text-snog-pink">{val ?? "–"}</div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/admin/users", { params: { q, limit: 100 } });
      setRows(data);
    } finally { setLoading(false); }
  }, [q]);
  useEffect(()=>{ load(); }, [load]);

  const ban = async (uid, banned) => {
    if (!confirm(banned ? "Unban this user?" : "Ban this user? They'll be logged out and hidden from matches.")) return;
    try {
      await api.post(`/admin/users/${uid}/${banned ? "unban" : "ban"}`);
      toast.success(banned ? "Unbanned" : "Banned");
      load();
    } catch { toast.error("Failed"); }
  };

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40"/>
        <input data-testid="admin-user-search" value={q} onChange={(e)=>setQ(e.target.value)}
          placeholder="Search by name, email, or user_id…"
          className="w-full rounded-xl bg-white/8 border border-white/10 pl-9 pr-3 py-2 text-sm"/>
      </div>
      {loading && <div className="h-10 animate-pulse rounded bg-white/5"/>}
      <div className="space-y-2">
        {rows.map((u) => (
          <div key={u.user_id} className={`glass rounded-2xl p-3 flex items-center gap-3 ${u.is_banned ? "opacity-60" : ""}`}>
            <div className="h-10 w-10 overflow-hidden rounded-xl bg-white/10 shrink-0">
              {u.photos?.[0] ? <img src={fileUrl(u.photos[0])} className="h-full w-full object-cover" alt=""/>
                : u.picture ? <img src={u.picture} className="h-full w-full object-cover" alt=""/> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="font-bold">{u.name}</div>
                {u.is_admin && <span className="rounded-full bg-snog-cyan/25 px-1.5 py-0.5 text-[9px] text-snog-cyan font-bold">ADMIN</span>}
                {u.is_banned && <span className="rounded-full bg-red-500/25 px-1.5 py-0.5 text-[9px] text-red-400 font-bold">BANNED</span>}
                {u.premium && <span className="rounded-full bg-snog-pink/25 px-1.5 py-0.5 text-[9px] text-snog-pink font-bold">PRO</span>}
              </div>
              <div className="text-xs text-white/60 truncate">{u.email} · {u.age || "–"} · {u.location || "London"}</div>
            </div>
            <button onClick={()=>ban(u.user_id, u.is_banned)} data-testid={`admin-user-ban-${u.user_id}`}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${u.is_banned ? "bg-snog-cyan/20 text-snog-cyan" : "bg-red-500/15 text-red-400"}`}>
              {u.is_banned ? <ShieldCheck className="h-3.5 w-3.5"/> : <Ban className="h-3.5 w-3.5"/>}
            </button>
          </div>
        ))}
        {!loading && !rows.length && <p className="text-center text-xs text-white/50 py-4">No users.</p>}
      </div>
    </div>
  );
}

function MessagesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(()=>{ api.get("/admin/messages", { params: { limit: 200 } }).then(({data})=>setRows(data)).finally(()=>setLoading(false)); }, []);
  return (
    <div>
      <p className="mb-2 text-xs text-white/60">Most recent messages across the app · for moderation.</p>
      <div className="space-y-1.5">
        {loading && <div className="h-10 animate-pulse rounded bg-white/5"/>}
        {rows.map((m) => (
          <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-white/40">{m.sender_name} · {new Date(m.created_at).toLocaleString("en-GB")}</div>
            <div className="line-clamp-2">{m.body}</div>
          </div>
        ))}
        {!loading && !rows.length && <p className="text-center text-xs text-white/50 py-4">No messages yet.</p>}
      </div>
    </div>
  );
}

function ReportsTab() {
  const [rows, setRows] = useState([]);
  const load = ()=> api.get("/admin/reports").then(({data})=>setRows(data));
  useEffect(()=>{ load(); }, []);
  const resolve = async (id) => { await api.post(`/admin/reports/${id}/resolve`); load(); };
  const ban = async (uid) => { await api.post(`/admin/users/${uid}/ban`); toast.success("Banned"); load(); };
  return (
    <div className="space-y-2">
      {rows.length === 0 && <p className="text-center text-xs text-white/50 py-4">No reports — peaceful, that.</p>}
      {rows.map((r) => (
        <div key={r.report_id} className={`glass rounded-2xl p-3 ${r.status==="resolved"?"opacity-60":""}`}>
          <div className="text-[10px] uppercase tracking-widest text-white/50">{new Date(r.created_at).toLocaleString("en-GB")} · {r.status}</div>
          <div className="text-sm font-semibold mt-0.5">{r.reason}</div>
          {r.detail && <p className="mt-1 text-xs text-white/70">{r.detail}</p>}
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-white/5 p-2"><div className="text-[10px] uppercase text-white/40">Reporter</div>{r.reporter?.name} · {r.reporter?.email}</div>
            <div className="rounded-lg bg-white/5 p-2"><div className="text-[10px] uppercase text-white/40">Reported</div>{r.reported?.name} · {r.reported?.email} {r.reported?.is_banned && <span className="text-red-400">(banned)</span>}</div>
          </div>
          <div className="mt-3 flex gap-2">
            {r.status !== "resolved" && (
              <button onClick={()=>resolve(r.report_id)} data-testid={`report-resolve-${r.report_id}`} className="btn-ghost flex-1 py-1.5 text-xs">Mark resolved</button>
            )}
            {!r.reported?.is_banned && (
              <button onClick={()=>ban(r.reported_user_id)} data-testid={`report-ban-${r.report_id}`} className="rounded-full bg-red-500/20 text-red-300 flex-1 py-1.5 text-xs font-semibold">Ban reported user</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventsTab() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title:"", starts_at:"", ends_at:"", capacity:40 });
  const load = ()=> api.get("/admin/events_all").then(({data})=>setEvents(data));
  useEffect(()=>{ load(); }, []);
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/events", {
        title: form.title,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        capacity: parseInt(form.capacity),
      });
      toast.success("Event created"); setForm({ title:"", starts_at:"", ends_at:"", capacity:40 }); load();
    } catch { toast.error("Failed"); }
  };
  const start = async (id) => { try { await api.post(`/events/${id}/start`); toast.success("Started"); load(); } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); } };
  return (
    <div className="space-y-4">
      <form onSubmit={create} className="glass rounded-3xl p-4 space-y-2">
        <div className="font-display text-base font-bold flex items-center gap-2"><Plus className="h-4 w-4"/> New event</div>
        <input data-testid="admin-title" placeholder="Title" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"/>
        <div className="grid grid-cols-2 gap-2">
          <input type="datetime-local" data-testid="admin-starts" value={form.starts_at} onChange={(e)=>setForm({...form,starts_at:e.target.value})} className="rounded-xl bg-white/8 border border-white/10 px-3 py-2"/>
          <input type="datetime-local" data-testid="admin-ends" value={form.ends_at} onChange={(e)=>setForm({...form,ends_at:e.target.value})} className="rounded-xl bg-white/8 border border-white/10 px-3 py-2"/>
        </div>
        <input type="number" data-testid="admin-capacity" min="2" max="200" value={form.capacity} onChange={(e)=>setForm({...form,capacity:e.target.value})} className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"/>
        <button data-testid="admin-create" className="btn-primary w-full">Create event</button>
      </form>

      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.event_id} className="rounded-2xl border border-white/10 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-sm font-bold">{e.title}</div>
                <div className="text-[10px] text-white/50">
                  {new Date(e.starts_at).toLocaleString("en-GB")} · {e.registered_user_ids?.length||0}/{e.capacity} signed up · status: {e.status}
                </div>
              </div>
              {e.status==="upcoming" && (
                <button onClick={()=>start(e.event_id)} data-testid={`admin-start-${e.event_id}`} className="btn-primary px-3 py-1.5 text-xs">Start</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
