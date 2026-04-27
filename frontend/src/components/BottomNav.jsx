import { Heart, CalendarDays, MessageCircleHeart, User } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/matches", icon: Heart, label: "Snog", testid: "nav-matches-tab" },
  { to: "/events", icon: CalendarDays, label: "Events", testid: "nav-events-tab" },
  { to: "/chats", icon: MessageCircleHeart, label: "Chats", testid: "nav-chats-tab" },
  { to: "/profile", icon: User, label: "You", testid: "nav-profile-tab" },
];

export default function BottomNav() {
  return (
    <nav
      className="glass fixed inset-x-0 bottom-14 z-[60] mx-auto flex h-[68px] max-w-md justify-around items-center rounded-3xl border border-white/10 px-2 sm:bottom-4"
      data-testid="bottom-nav"
    >
      {items.map(({ to, icon: Icon, label, testid }) => (
        <NavLink
          key={to}
          to={to}
          data-testid={testid}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] tracking-wide font-semibold transition-colors ${
              isActive ? "text-snog-pink" : "text-white/60 hover:text-white"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-5 w-5" strokeWidth={2.5} />
              <span>{label}</span>
              {isActive && <span className="absolute -top-0.5 h-1 w-8 rounded-full bg-snog-pink shadow-[0_0_12px_rgba(255,42,133,0.7)]" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
