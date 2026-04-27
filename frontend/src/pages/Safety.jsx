import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, fileUrl } from "@/lib/api";
import { ShieldCheck, MapPin, CalendarDays } from "lucide-react";

export default function Safety() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get(`/safety/${token}`).then(({data})=>setData(data)).catch(()=>setErr(true));
  }, [token]);

  if (err) return <div className="grid min-h-[100svh] place-items-center text-center px-6"><p className="text-white/70">This safety link is invalid or has expired.</p></div>;
  if (!data) return null;

  const dt = new Date(data.planned_at);

  return (
    <div className="min-h-[100svh] bg-snog-ink text-white">
      <div className="mx-auto max-w-md px-5 py-10">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-snog-cyan">
          <ShieldCheck className="h-4 w-4"/> Let's Snog · Safety share
        </div>
        <h1 className="font-display text-3xl font-black">
          {data.you?.name} is going on a date
        </h1>
        <p className="mt-1 text-sm text-white/70">If they don't check in, give them a ring.</p>

        <div className="glass mt-5 rounded-3xl p-5">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white/10">
              {data.date_with?.photo && <img src={fileUrl(data.date_with.photo)} className="h-full w-full object-cover" alt=""/>}
            </div>
            <div>
              <div className="text-xs text-white/60">With</div>
              <div className="font-display text-lg font-bold">{data.date_with?.first_name || "Mystery date"}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-snog-pink"/>
              {dt.toLocaleString("en-GB", { weekday:"short", day:"numeric", month:"short", hour:"2-digit", minute:"2-digit", timeZone:"Europe/London" })}</div>
            <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-snog-pink mt-0.5"/>
              <div><div className="font-bold">{data.venue_name}</div><div className="text-white/60">{data.venue_address}</div></div>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-white/40">Sent with love by Let's Snog · letssnog.co.uk</p>
      </div>
    </div>
  );
}
