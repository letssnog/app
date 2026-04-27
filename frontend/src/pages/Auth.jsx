import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { signIn, signUp, confirmSignUp, getIdTokenJwt } from "@/lib/cognito";
import { useAuth } from "@/context/AuthContext";

export default function Auth() {
  const nav = useNavigate();
  const { refresh } = useAuth();

  const [mode, setMode] = useState("signin"); // signin | signup | confirm
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (busy) return false;
    if (mode === "signin") return email && password;
    if (mode === "signup") return email && password;
    if (mode === "confirm") return email && code;
    return false;
  }, [busy, mode, email, password, code]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp({ email, password, name });
        toast.success("Check your email for the verification code.");
        setMode("confirm");
      } else if (mode === "confirm") {
        await confirmSignUp({ email, code });
        toast.success("Verified. Now sign in.");
        setMode("signin");
      } else {
        await signIn({ email, password });
        const jwt = await getIdTokenJwt();
        if (jwt) localStorage.setItem("idTokenJwt", jwt);
        await refresh();
        // If onboarding isn't complete, route guard will push to onboarding.
        nav("/matches", { replace: true });
      }
    } catch (err) {
      const msg = err?.message || "Auth failed";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[100svh] place-items-center bg-snog-ink text-white px-6">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-snog-pink shadow-[0_0_30px_rgba(255,42,133,0.5)]">
          <Heart className="h-7 w-7 fill-white text-white" />
        </div>

        <h1 className="text-center font-display text-3xl font-black">
          {mode === "signup" ? "Create your account" : mode === "confirm" ? "Verify your email" : "Sign in"}
        </h1>
        <p className="mt-2 text-center text-sm text-white/60">
          {mode === "confirm"
            ? "Enter the code we emailed you."
            : "No redirects. No nonsense. Just snogs."}
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-full px-4 py-2 text-sm border ${mode === "signin" ? "border-snog-pink bg-snog-pink/15" : "border-white/10 bg-white/5"}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-full px-4 py-2 text-sm border ${mode === "signup" ? "border-snog-pink bg-snog-pink/15" : "border-white/10 bg-white/5"}`}
          >
            Sign up
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm")}
            className={`rounded-full px-4 py-2 text-sm border ${mode === "confirm" ? "border-snog-cyan bg-snog-cyan/10" : "border-white/10 bg-white/5"}`}
          >
            Verify
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 glass rounded-3xl p-5 space-y-3">
          <label className="block">
            <div className="mb-1 text-xs uppercase tracking-wider text-white/60">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"
              type="email"
              autoComplete="email"
              required
            />
          </label>

          {mode !== "confirm" && (
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-white/60">Password</div>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />
              <div className="mt-1 text-[11px] text-white/45">
                Cognito password policy applies.
              </div>
            </label>
          )}

          {mode === "signup" && (
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-white/60">Name (optional)</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"
                type="text"
              />
            </label>
          )}

          {mode === "confirm" && (
            <label className="block">
              <div className="mb-1 text-xs uppercase tracking-wider text-white/60">Verification code</div>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl bg-white/8 border border-white/10 px-3 py-2"
                type="text"
                inputMode="numeric"
                required
              />
            </label>
          )}

          <button disabled={!canSubmit} className="btn-primary w-full">
            {busy ? "One sec…" : mode === "signup" ? "Create account" : mode === "confirm" ? "Verify email" : "Sign in"}
          </button>

          <button
            type="button"
            onClick={() => nav("/", { replace: true })}
            className="btn-ghost w-full"
          >
            Back
          </button>
        </form>
      </div>
    </div>
  );
}

