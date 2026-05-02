import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  LayoutDashboard, Users, MessageSquare, ShieldAlert, CalendarDays, Plus,
  Ban, ShieldCheck, Search, Heart, ExternalLink, UserX, Lock,
} from "lucide-react";

const TABS = [
  { k: "stats", label: "Overview", icon: LayoutDashboard },
  { k: "users", label: "Users", icon: Users },
  { k: "messages", label: "Messages", icon: MessageSquare },
  { k: "trust", label: "Trust & safety", icon: ShieldAlert },
  { k: "events", label: "Events", icon: CalendarDays },
];

export default function Admin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState("stats");
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );

  useEffect(() => {
    if (user && !user.is_admin) nav("/matches", { replace: true });
  }, [user, nav]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const onChange = () => setWide(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!user?.is_admin) return null;

  const tabLabel = TABS.find((t) => t.k === tab)?.label ?? "Admin";

  const tabButtons = (variant) =>
    TABS.map((t) => {
      const Icon = t.icon;
      const on = tab === t.k;
      if (variant === "sidebar") {
        return (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            data-testid={`admin-tab-${t.k}`}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
              on
                ? "border border-snog-pink/35 bg-snog-pink/15 text-white shadow-[0_0_20px_-8px_rgba(255,42,133,0.5)]"
                : "border border-transparent text-white/65 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2.25} />
            {t.label}
          </button>
        );
      }
      return (
        <button
          key={t.k}
          type="button"
          onClick={() => setTab(t.k)}
          data-testid={`admin-tab-${t.k}`}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
            on ? "border-snog-pink bg-snog-pink text-white" : "border-white/15 text-white/70 hover:border-white/40"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {t.label}
        </button>
      );
    });

  return (
    <div className="relative flex min-h-[100svh] flex-col bg-snog-ink text-white lg:flex-row">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-snog-pink/12 blur-[140px]" />
        <div className="absolute bottom-0 right-[-8rem] h-[420px] w-[420px] rounded-full bg-snog-cyan/10 blur-[120px]" />
      </div>

      {wide ? (
        <aside
          className="relative z-20 flex w-[240px] shrink-0 flex-col border-r border-white/10 bg-snog-navy/75 py-6 pl-5 pr-4 backdrop-blur-xl"
          data-testid="admin-sidebar"
        >
          <div className="mb-1 flex items-center gap-2 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-snog-pink/90 shadow-[0_0_20px_rgba(255,42,133,0.35)]">
              <Heart className="h-4 w-4 fill-white text-white" />
            </div>
            <div>
              <div className="font-display text-sm font-black leading-tight">Let's Snog</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/45">Admin portal</div>
            </div>
          </div>
          <p className="mb-5 mt-4 px-2 text-[11px] leading-snug text-white/50">
            Moderation, events, and health checks. Optimised for larger screens.
          </p>
          <nav className="flex flex-1 flex-col gap-0.5">{tabButtons("sidebar")}</nav>
          <div className="mt-6 space-y-2 border-t border-white/10 pt-5">
            <Link
              to="/matches"
              className="flex items-center justify-center gap-2 rounded-xl border border-white/15 py-2.5 text-center text-xs font-semibold text-white/80 transition-colors hover:border-snog-cyan/40 hover:text-snog-cyan"
            >
              Back to app <ExternalLink className="h-3 w-3 opacity-70" />
            </Link>
            <Link to="/profile" className="block text-center text-[11px] text-white/40 hover:text-white/65">
              Your profile
            </Link>
          </div>
        </aside>
      ) : (
        <div className="relative z-10 border-b border-white/10 bg-snog-ink/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="font-display text-xl font-black tracking-tight">Admin</h1>
            <Link to="/matches" className="text-xs font-semibold text-snog-cyan">
              App →
            </Link>
          </div>
          <div className="flex gap-1 overflow-x-auto px-3 pb-3 scroll-hide">{tabButtons("mobile")}</div>
        </div>
      )}

      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-6 lg:px-10 lg:py-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-6 hidden items-end justify-between gap-4 lg:flex">
            <div>
              <h2 className="font-display text-2xl font-black tracking-tight">{tabLabel}</h2>
              <p className="mt-1 text-sm text-white/55">Signed in as {user.email}</p>
            </div>
          </div>

          {tab === "stats" && <StatsTab />}
          {tab === "users" && <UsersTab />}
          {tab === "messages" && <MessagesTab />}
          {tab === "trust" && <TrustSafetyTab />}
          {tab === "events" && <EventsTab />}
        </div>
      </main>
    </div>
  );
}

function StatsTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data));
  }, []);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        ["Users", stats?.users],
        ["Matches", stats?.matches],
        ["Events", stats?.events],
        ["Messages", stats?.messages],
      ].map(([label, val]) => (
        <div key={label} className="glass rounded-2xl p-4 lg:p-5">
          <div className="text-xs uppercase tracking-widest text-white/60">{label}</div>
          <div className="font-display text-3xl font-black text-snog-pink lg:text-4xl">{val ?? "–"}</div>
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
    } finally {
      setLoading(false);
    }
  }, [q]);
  useEffect(() => {
    load();
  }, [load]);

  const ban = async (uid, banned) => {
    if (!confirm(banned ? "Unban this user?" : "Ban this user? They'll be logged out and hidden from matches.")) return;
    try {
      await api.post(`/admin/users/${uid}/${banned ? "unban" : "ban"}`);
      toast.success(banned ? "Unbanned" : "Banned");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  const unrestrict = async (uid) => {
    try {
      await api.post(`/admin/users/${uid}/unrestrict`);
      toast.success("Restriction lifted");
      load();
    } catch {
      toast.error("Failed");
    }
  };

  return (
    <div>
      <div className="relative mb-4 max-w-xl">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
        <input
          data-testid="admin-user-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, or user_id…"
          className="w-full rounded-xl border border-white/10 bg-white/8 py-2 pl-9 pr-3 text-sm"
        />
      </div>
      {loading && <div className="h-10 animate-pulse rounded bg-white/5" />}
      <div className="space-y-2 lg:space-y-3">
        {rows.map((u) => (
          <div
            key={u.user_id}
            className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 lg:p-4 ${u.is_banned ? "opacity-60" : ""}`}
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/10 lg:h-12 lg:w-12">
              {u.photos?.[0] ? (
                <img src={fileUrl(u.photos[0])} className="h-full w-full object-cover" alt="" />
              ) : u.picture ? (
                <img src={u.picture} className="h-full w-full object-cover" alt="" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="font-bold">{u.name}</div>
                {u.is_admin && (
                  <span className="rounded-full bg-snog-cyan/25 px-1.5 py-0.5 text-[9px] font-bold text-snog-cyan">ADMIN</span>
                )}
                {u.is_banned && (
                  <span className="rounded-full bg-red-500/25 px-1.5 py-0.5 text-[9px] font-bold text-red-400">BANNED</span>
                )}
                {u.is_restricted && (
                  <span className="rounded-full bg-amber-500/25 px-1.5 py-0.5 text-[9px] font-bold text-amber-200">RESTRICTED</span>
                )}
                {u.premium && (
                  <span className="rounded-full bg-snog-pink/25 px-1.5 py-0.5 text-[9px] font-bold text-snog-pink">PRO</span>
                )}
              </div>
              <div className="truncate text-xs text-white/60">
                {u.email} · {u.age || "–"} · {u.location || "London"}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {u.is_restricted && (
                <button
                  type="button"
                  onClick={() => unrestrict(u.user_id)}
                  data-testid={`admin-user-unrestrict-${u.user_id}`}
                  className="rounded-full border border-amber-500/40 px-3 py-1.5 text-[10px] font-semibold text-amber-100"
                >
                  Lift restrict
                </button>
              )}
              <button
                type="button"
                onClick={() => ban(u.user_id, u.is_banned)}
                data-testid={`admin-user-ban-${u.user_id}`}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold lg:px-4 lg:py-2 ${
                  u.is_banned ? "bg-snog-cyan/20 text-snog-cyan" : "bg-red-500/15 text-red-400"
                }`}
              >
                {u.is_banned ? <ShieldCheck className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ))}
        {!loading && !rows.length && <p className="py-8 text-center text-xs text-white/50">No users.</p>}
      </div>
    </div>
  );
}

function MessagesTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/admin/messages", { params: { limit: 200 } })
      .then(({ data }) => setRows(data))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div>
      <p className="mb-3 text-sm text-white/60">Most recent messages across the app · for moderation.</p>
      <div className="grid gap-2 lg:grid-cols-2">
        {loading && <div className="h-10 animate-pulse rounded bg-white/5 lg:col-span-2" />}
        {rows.map((m) => (
          <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              {m.sender_name} · {new Date(m.created_at).toLocaleString("en-GB")}
            </div>
            <div className="line-clamp-3">{m.body}</div>
          </div>
        ))}
        {!loading && !rows.length && (
          <p className="py-8 text-center text-xs text-white/50 lg:col-span-2">No messages yet.</p>
        )}
      </div>
    </div>
  );
}

function TrustSafetyTab() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const load = useCallback(() => {
    const params = { status: statusFilter };
    if (filter === "profile" || filter === "message") params.kind = filter;
    return api.get("/admin/trust/queue", { params }).then(({ data }) => setRows(data));
  }, [filter, statusFilter]);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (reportId, action) => {
    const labels = {
      dismiss: "close this with no action against the member",
      ban: "ban this member (log out, hide from app)",
      restrict: "restrict them from sending messages and from daily matches",
      delete_profile: "delete their profile data and ban the account",
    };
    if (!confirm(`Confirm: ${labels[action]}?`)) return;
    try {
      await api.post(`/admin/trust/reports/${reportId}/action`, { action });
      toast.success("Updated");
      load();
    } catch {
      toast.error("Action failed");
    }
  };

  return (
    <div>
      <p className="mb-4 max-w-2xl text-sm text-white/60">
        Review flagged profiles and messages from the app. Choose an outcome for each open item.{" "}
        <strong className="text-white/80">No action</strong> closes the report without penalising anyone.{" "}
        <strong className="text-white/80">Restrict</strong> blocks new messages and discovery.{" "}
        <strong className="text-white/80">Delete profile</strong> wipes their public profile and bans the account.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-white/45">Type</span>
        {[
          ["all", "All"],
          ["profile", "Flagged profiles"],
          ["message", "Flagged messages"],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === k ? "border-snog-pink bg-snog-pink/20 text-white" : "border-white/15 text-white/65"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-2 text-[11px] uppercase tracking-wider text-white/45">Status</span>
        {[
          ["open", "Open"],
          ["resolved", "Resolved"],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setStatusFilter(k)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              statusFilter === k ? "border-snog-cyan bg-snog-cyan/15 text-snog-cyan" : "border-white/15 text-white/65"
            }`}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={() => load()} className="ml-auto text-xs font-semibold text-snog-cyan">
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {rows.length === 0 && (
          <p className="py-10 text-center text-sm text-white/50 lg:col-span-2">Nothing in this queue.</p>
        )}
        {rows.map((r) => {
          const isMessage = r.report_kind === "message";
          const open = r.status === "open";
          return (
            <div
              key={r.report_id}
              className={`rounded-2xl border border-white/10 bg-white/[0.04] p-4 ${!open ? "opacity-70" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isMessage ? "bg-snog-cyan/20 text-snog-cyan" : "bg-snog-pink/20 text-snog-pink"
                  }`}
                >
                  {isMessage ? "Message" : "Profile"}
                </span>
                <span className="text-[10px] uppercase tracking-widest text-white/45">
                  {new Date(r.created_at).toLocaleString("en-GB")} · {r.status}
                </span>
                {r.resolution && (
                  <span className="text-[10px] text-white/50">→ {r.resolution}</span>
                )}
              </div>
              <div className="mt-2 font-display text-base font-bold">{r.reason}</div>
              {r.detail ? <p className="mt-1 text-xs text-white/70">{r.detail}</p> : null}
              {isMessage && r.message_preview && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/90">
                  <div className="text-[10px] uppercase tracking-wider text-white/40">Reported message</div>
                  <p className="mt-1 whitespace-pre-wrap">{r.message_preview}</p>
                </div>
              )}
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] uppercase text-white/40">Reporter</div>
                  {r.reporter?.name} · {r.reporter?.email}
                </div>
                <div className="rounded-lg bg-white/5 p-2">
                  <div className="text-[10px] uppercase text-white/40">Reported member</div>
                  {r.reported?.name} · {r.reported?.email}
                  {r.reported?.is_banned && <span className="text-red-400"> · banned</span>}
                  {r.reported?.is_restricted && <span className="text-amber-200"> · restricted</span>}
                </div>
              </div>
              {open && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    onClick={() => act(r.report_id, "dismiss")}
                    data-testid={`trust-dismiss-${r.report_id}`}
                    className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/5"
                  >
                    No action
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.report_id, "restrict")}
                    data-testid={`trust-restrict-${r.report_id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100"
                  >
                    <Lock className="h-3.5 w-3.5" /> Restrict
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.report_id, "ban")}
                    data-testid={`trust-ban-${r.report_id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-200"
                  >
                    <Ban className="h-3.5 w-3.5" /> Ban
                  </button>
                  <button
                    type="button"
                    onClick={() => act(r.report_id, "delete_profile")}
                    data-testid={`trust-delete-profile-${r.report_id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-red-600/35 px-3 py-2 text-xs font-semibold text-white"
                  >
                    <UserX className="h-3.5 w-3.5" /> Delete profile
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EventsTab() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: "", starts_at: "", ends_at: "", capacity: 40 });
  const load = () => api.get("/admin/events_all").then(({ data }) => setEvents(data));
  useEffect(() => {
    load();
  }, []);
  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/events", {
        title: form.title,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        capacity: parseInt(form.capacity, 10),
      });
      toast.success("Event created");
      setForm({ title: "", starts_at: "", ends_at: "", capacity: 40 });
      load();
    } catch {
      toast.error("Failed");
    }
  };
  const start = async (id) => {
    try {
      await api.post(`/events/${id}/start`);
      toast.success("Started");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed");
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <form onSubmit={create} className="glass space-y-3 rounded-3xl p-5">
        <div className="flex items-center gap-2 font-display text-base font-bold">
          <Plus className="h-4 w-4" /> New event
        </div>
        <input
          data-testid="admin-title"
          placeholder="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            type="datetime-local"
            data-testid="admin-starts"
            value={form.starts_at}
            onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            className="rounded-xl border border-white/10 bg-white/8 px-3 py-2"
          />
          <input
            type="datetime-local"
            data-testid="admin-ends"
            value={form.ends_at}
            onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            className="rounded-xl border border-white/10 bg-white/8 px-3 py-2"
          />
        </div>
        <input
          type="number"
          data-testid="admin-capacity"
          min="2"
          max="200"
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          className="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2"
        />
        <button data-testid="admin-create" className="btn-primary w-full">
          Create event
        </button>
      </form>

      <div className="space-y-2 lg:max-h-[calc(100svh-8rem)] lg:overflow-y-auto lg:pr-1">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45 lg:sticky lg:top-0 lg:bg-snog-ink/95 lg:py-2">
          All events
        </div>
        {events.map((ev) => (
          <div key={ev.event_id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-sm font-bold">{ev.title}</div>
                <div className="mt-1 text-[10px] text-white/50">
                  {new Date(ev.starts_at).toLocaleString("en-GB")} · {ev.registered_user_ids?.length || 0}/{ev.capacity}{" "}
                  signed up · {ev.status}
                </div>
              </div>
              {ev.status === "upcoming" && (
                <button
                  onClick={() => start(ev.event_id)}
                  data-testid={`admin-start-${ev.event_id}`}
                  className="btn-primary shrink-0 px-3 py-1.5 text-xs"
                >
                  Start
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
