import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fileUrl } from "@/lib/api";
import {
  X, MapPin, Briefcase, GraduationCap, Ruler, Cigarette, Wine, Dumbbell,
  Baby, Heart, Sparkles, Quote, Wand2, Flag,
} from "lucide-react";
import ReportUserModal from "@/components/ReportUserModal";

const META = [
  ["job", Briefcase],
  ["education", GraduationCap],
  ["height_cm", Ruler],
  ["smokes", Cigarette],
  ["drinks", Wine],
  ["workout", Dumbbell],
  ["wants_kids", Baby],
  ["religion", Sparkles],
  ["zodiac", Sparkles],
];

const PRETTY = {
  smokes: { never: "Doesn't smoke", sometimes: "Smokes sometimes", regularly: "Smokes regularly", trying_to_quit: "Trying to quit" },
  drinks: { never: "Doesn't drink", sometimes: "Drinks socially", regularly: "Drinks regularly" },
  workout: { never: "Sofa pro", sometimes: "Works out sometimes", often: "Works out often", daily: "Daily gym-goer" },
  wants_kids: { yes: "Wants kids", maybe: "Maybe one day", no: "Not for them", already_have: "Already has kids" },
  has_kids: { yes: "Has kids", no: "No kids", prefer_not_to_say: "—" },
};

/** Full-screen profile detail, opened by tapping a swipe card */
export default function ProfileDetail({
  open,
  profile,
  onClose,
  onLike,
  onPass,
  onSuggestDate,
  enableProfileReport = true,
  profileReportMatchId,
}) {
  const [reportOpen, setReportOpen] = useState(false);
  if (!open || !profile) return null;
  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] overflow-y-auto bg-snog-ink"
      >
        <motion.div
          initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 26 }}
          className="mx-auto max-w-md pb-32"
        >
          {/* Hero */}
          <div className="relative">
            <div className="absolute right-4 top-4 z-10 flex gap-2">
              {enableProfileReport && profile.user_id && (
                <button
                  type="button"
                  data-testid="profile-report-open"
                  onClick={() => setReportOpen(true)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-black/60 backdrop-blur hover:text-snog-pink"
                  title="Report profile"
                >
                  <Flag className="h-4 w-4" />
                </button>
              )}
              <button
                data-testid="profile-close"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full bg-black/60 backdrop-blur"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="aspect-[3/4] w-full overflow-hidden">
              {profile.photos?.[0]
                ? <img src={fileUrl(profile.photos[0])} alt="" className="h-full w-full object-cover"/>
                : <div className="grid h-full w-full place-items-center bg-snog-navy"><Heart className="h-12 w-12 text-snog-pink/40"/></div>}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/40 to-transparent p-5 pb-6">
              <div className="font-display text-3xl font-black">{profile.name}{profile.age ? `, ${profile.age}` : ""}</div>
              {profile.pronouns && <div className="text-xs text-white/70">{profile.pronouns}</div>}
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/70">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3"/> {profile.location || "London"}</span>
                {profile.job && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3"/>{profile.job}</span>}
              </div>
            </div>
          </div>

          <div className="px-5 pt-5 space-y-5">
            {profile._ai?.why && (
              <div className="rounded-3xl border border-snog-cyan/30 bg-gradient-to-br from-snog-pink/10 via-snog-navy to-snog-cyan/10 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-snog-cyan">
                  <Wand2 className="h-3.5 w-3.5"/> Snog AI {profile._ai.vibe ? `· ${profile._ai.vibe}` : ""}
                </div>
                <p className="mt-1.5 text-sm text-white/90">{profile._ai.why}</p>
              </div>
            )}

            {profile.bio && (
              <p className="text-base text-white/85 leading-relaxed">{profile.bio}</p>
            )}

            {/* Meta chips */}
            <div className="flex flex-wrap gap-2">
              {META.map(([k, Icon]) => {
                const v = profile[k];
                if (!v) return null;
                let label = v;
                if (k === "height_cm") label = `${v} cm`;
                else if (PRETTY[k]?.[v]) label = PRETTY[k][v];
                return (
                  <span key={k} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs">
                    <Icon className="h-3.5 w-3.5 text-snog-pink"/>{label}
                  </span>
                );
              })}
            </div>

            {/* Photo gallery */}
            {profile.photos?.length > 1 && (
              <div className="grid grid-cols-2 gap-2">
                {profile.photos.slice(1).map((p) => (
                  <div key={p} className="aspect-[3/4] overflow-hidden rounded-2xl bg-white/5">
                    <img src={fileUrl(p)} alt="" className="h-full w-full object-cover"/>
                  </div>
                ))}
              </div>
            )}

            {/* Prompts */}
            {profile.prompts?.filter(p=>p?.q && p?.a).map((p, i) => (
              <div key={i} className="glass rounded-3xl p-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-snog-pink">
                  <Quote className="h-3.5 w-3.5"/> {p.q}
                </div>
                <div className="mt-2 font-display text-lg leading-snug">{p.a}</div>
              </div>
            ))}

            {!!profile.interests?.length && (
              <div>
                <div className="mb-2 text-xs uppercase tracking-widest text-white/60">Into</div>
                <div className="flex flex-wrap gap-1.5">
                  {profile.interests.map((i) => (
                    <span key={i} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs">{i}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action bar */}
          {(onLike || onPass || onSuggestDate) && (
            <div className="glass fixed inset-x-0 bottom-4 mx-auto flex max-w-md items-center gap-3 rounded-3xl border border-white/10 p-3 z-[71]">
              <button onClick={onPass} data-testid="detail-pass" className="grid h-12 w-12 place-items-center rounded-full border-2 border-white/15 hover:border-white/40">
                <X className="h-5 w-5"/>
              </button>
              <button onClick={onSuggestDate} data-testid="detail-date" className="btn-primary flex-1">
                ✨ Suggest a date
              </button>
              <button onClick={onLike} data-testid="detail-like" className="grid h-12 w-12 place-items-center rounded-full border-2 border-snog-pink bg-snog-pink/10 text-snog-pink">
                <Heart className="h-5 w-5 fill-snog-pink"/>
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
    {reportOpen && (
      <ReportUserModal
        reportedUserId={profile.user_id}
        matchId={profileReportMatchId}
        onClose={() => setReportOpen(false)}
      />
    )}
    </>
  );
}
