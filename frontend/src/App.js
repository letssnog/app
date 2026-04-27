import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "sonner";

import Landing from "@/pages/Landing";
import Auth from "@/pages/Auth";
import Onboarding from "@/pages/Onboarding";
import Matches from "@/pages/Matches";
import Events from "@/pages/Events";
import EventLive from "@/pages/EventLive";
import Chats from "@/pages/Chats";
import ChatThread from "@/pages/ChatThread";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import Safety from "@/pages/Safety";
import AppShell from "@/components/AppShell";

function ProtectedShell() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="grid min-h-[100svh] place-items-center text-white/60">Loading…</div>;
  if (!user) return <Navigate to="/" replace state={{ from: loc }}/>;
  if (!user.onboarding_complete && loc.pathname !== "/onboarding") return <Navigate to="/onboarding" replace/>;
  return <AppShell/>;
}

function RoutedApp() {
  return (
    <Routes>
      <Route path="/" element={<Landing/>}/>
      <Route path="/auth" element={<Auth/>}/>
      <Route path="/safety/:token" element={<Safety/>}/>
      <Route path="/onboarding" element={<RequireAuth><Onboarding/></RequireAuth>}/>
      <Route element={<ProtectedShell/>}>
        <Route path="/matches" element={<Matches/>}/>
        <Route path="/events" element={<Events/>}/>
        <Route path="/events/:eventId/live" element={<EventLive/>}/>
        <Route path="/chats" element={<Chats/>}/>
        <Route path="/chats/:matchId" element={<ChatThread/>}/>
        <Route path="/profile" element={<Profile/>}/>
        <Route path="/admin" element={<Admin/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  );
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-[100svh] place-items-center text-white/60">Loading…</div>;
  if (!user) return <Navigate to="/" replace/>;
  return children;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-center" richColors theme="dark" toastOptions={{ style: { background: "#0E1428", color: "white", border: "1px solid rgba(255,255,255,0.08)" } }}/>
          <RoutedApp/>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
