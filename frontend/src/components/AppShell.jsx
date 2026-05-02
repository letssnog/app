import BottomNav from "./BottomNav";
import { PageTransition } from "@/components/PremiumMotion";
import { Outlet, useLocation } from "react-router-dom";

export default function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="relative min-h-[100svh] bg-snog-ink text-white">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-snog-pink/15 blur-[140px]" />
        <div className="absolute top-1/2 right-[-12rem] h-[420px] w-[420px] rounded-full bg-snog-cyan/10 blur-[140px]" />
      </div>
      <div className="mx-auto max-w-md pb-32 pt-6 px-4">
        <PageTransition routeKey={pathname}>
          <Outlet />
        </PageTransition>
      </div>
      <BottomNav />
    </div>
  );
}
