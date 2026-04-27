import { useNavigate } from "react-router-dom";
import { Heart, MapPin, Sparkles, Users, ShieldCheck, MessageCircleHeart } from "lucide-react";

const HERO_BG = "https://images.pexels.com/photos/7429526/pexels-photo-7429526.jpeg";
const SHOTS = [
  "https://images.unsplash.com/photo-1581292065130-c7a4155e854a?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1592943666198-fbd360dbf58e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1542739962-4f05b0c46657?auto=format&fit=crop&w=600&q=80",
];

export default function Landing() {
  const nav = useNavigate();
  const startSnogging = () => {
    nav("/auth");
  };

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-snog-ink text-white">
      <img src={HERO_BG} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-snog-ink/60 via-snog-ink/85 to-snog-ink" />
      <div className="snog-grain" />

      {/* Top nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-snog-pink shadow-[0_0_24px_rgba(255,42,133,0.5)]">
            <Heart className="h-5 w-5 fill-white text-white" />
          </div>
          <span className="font-display text-xl font-black tracking-tight">Let's Snog</span>
        </div>
        <button onClick={startSnogging} data-testid="header-login-btn" className="text-sm font-semibold text-white/70 hover:text-white">
          Already on it? <span className="text-snog-pink underline-offset-4 hover:underline">Sign in</span>
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-6 pb-12 pt-6 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:pt-16">
        <div className="flex flex-col justify-center">
          <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-snog-pink/40 bg-snog-pink/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-snog-pink">
            <MapPin className="h-3.5 w-3.5" /> London · 2026 · Powered by Snog AI ✨
          </span>
          <h1 className="font-display text-4xl font-black leading-[1.02] tracking-tighter sm:text-5xl lg:text-6xl">
            Smart matches.<br/>
            Real stages.<br/>
            <span className="text-snog-pink">Actual dates</span> in London.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/70">
            The cheeky dating app that ditches endless swiping. <span className="font-accent text-2xl text-snog-pink">10–15</span> intelligent matches a day, free forever. Plus speed-dating nights and a feedback gate that kills ghosting.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button data-testid="start-snogging-btn" onClick={startSnogging} className="btn-primary text-base">
              Start Snogging — it's free
            </button>
            <span className="font-accent text-2xl text-snog-cyan">no paywalls, ever →</span>
          </div>
          <div className="mt-10 flex items-center gap-6 text-xs text-white/60">
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-snog-cyan"/> Photo verified</span>
            <span className="flex items-center gap-2"><Users className="h-4 w-4 text-snog-cyan"/> 2 events / week</span>
            <span className="flex items-center gap-2"><MessageCircleHeart className="h-4 w-4 text-snog-cyan"/> Real chat, real dates</span>
          </div>
        </div>

        {/* Stacked cards visual: solid backings, top card prominent, others peek */}
        <div className="relative mx-auto h-[480px] w-[320px] sm:h-[540px] sm:w-[360px]">
          {SHOTS.map((src, i) => {
            const isTop = i === 0;
            const offset = i; // 0 (top), 1, 2
            return (
              <div
                key={src}
                className="swipe-card absolute inset-0 overflow-hidden rounded-[28px] bg-snog-navy"
                style={{
                  transform: `translateY(${offset * 18}px) scale(${1 - offset * 0.05}) rotate(${offset * 2}deg)`,
                  zIndex: 30 - offset,
                  opacity: isTop ? 1 : 0.55,
                  filter: isTop ? "none" : "blur(1.5px)",
                }}
              >
                <img src={src} className="h-full w-full object-cover" alt=""/>
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent"/>
                {isTop && (
                  <>
                    <div className="absolute right-4 top-4 rounded-full bg-snog-pink/95 px-3 py-1 text-xs font-bold tracking-widest">SNOG · 92%</div>
                    <div className="absolute bottom-0 p-5">
                      <div className="font-display text-2xl font-black">Maddy, 27</div>
                      <div className="text-sm text-white/85">Shoreditch · Vibe match</div>
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-snog-cyan/15 px-2.5 py-1 text-[11px] text-snog-cyan font-semibold">
                        ✨ Snog AI: "You'd love her vinyl collection"
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Snog AI feature row */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pt-8">
        <div className="glass overflow-hidden rounded-3xl p-6 sm:p-8 lg:flex lg:items-center lg:gap-10">
          <div className="lg:flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-snog-pink/20 to-snog-cyan/20 border border-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-snog-cyan">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-gradient-to-br from-snog-pink to-snog-cyan text-[11px] font-black">AI</span>
              Snog AI · your built-in wingman
            </div>
            <h2 className="mt-3 font-display text-3xl font-black tracking-tight sm:text-4xl">
              Match smarter. <span className="text-snog-pink">Open with charm.</span>
            </h2>
            <p className="mt-2 max-w-xl text-white/70 text-sm sm:text-base">
              Snog AI reads everyone's prompts and vibes to surface the strongest matches, then writes you three witty, on-brand icebreakers so you never type "hey" again.
            </p>
          </div>
          <div className="mt-5 grid gap-2 lg:mt-0 lg:flex-1">
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm">
              <span className="font-accent text-xl text-snog-cyan mr-2">✨</span>
              "Reckon you'd love their answer to <em>two truths and a lie</em> — kick off with which one's the lie."
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm">
              <span className="font-accent text-xl text-snog-cyan mr-2">✨</span>
              "Borough Market mooch & vinyl talk — you two could spiral into a 3-hour Sunday."
            </div>
          </div>
        </div>
      </section>

      {/* Stages */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-16">
        <h2 className="mb-3 font-display text-3xl font-black tracking-tight sm:text-4xl">
          Four real stages. <span className="text-snog-pink">No more dead chats.</span>
        </h2>
        <p className="max-w-2xl text-white/70">A grown-up flow that takes you from match to actual pub door – and asks both of you how it went.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: "01", t: "Daily smart matches", d: "Quiz-powered. 10–15 picks you'll actually fancy. Resets at midnight." },
            { i: "02", t: "Speed-dating nights", d: "Tue & Thu, 7–9pm. Three live 5-minute rounds with mutual-match magic." },
            { i: "03", t: "Plan a real date", d: "Pick a London venue. Share with a mate via the safety link, just in case." },
            { i: "04", t: "Post-date feedback", d: "24h after, both rate it. Both yes? Chat opens. Either no? Closes graciously." },
          ].map((s) => (
            <div key={s.i} className="glass relative overflow-hidden rounded-3xl p-6">
              <div className="font-display text-5xl font-black text-snog-pink/80">{s.i}</div>
              <div className="mt-2 font-display text-xl font-bold">{s.t}</div>
              <div className="mt-2 text-sm text-white/70">{s.d}</div>
              <Sparkles className="absolute right-4 top-4 h-5 w-5 text-snog-cyan/60" />
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-24 text-center">
        <h2 className="font-display text-3xl font-black sm:text-4xl">
          Tired of ghosting? <span className="font-accent text-4xl text-snog-pink">Same.</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/70">
          Built in London for Londoners. Free core experience, forever. Premium is £4.99 if you fancy a boost — but you really don't need it.
        </p>
        <button data-testid="cta-bottom-btn" onClick={startSnogging} className="btn-primary mt-8 text-base">
          Sign in with Google · Start Snogging
        </button>
      </section>
    </div>
  );
}
