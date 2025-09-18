import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Pages & Components
import Landing from "@/pages/Landing";
import MockInterview from '@/pages/MockInterview'; 
import ResumeGenius from '@/pages/ResumeGenius';
import Chat from '@/pages/Chat';
import OppRadar from '@/pages/OppRadar';
import GovSnapshot from '@/pages/GovSnapshot';
import Onboarding from "@/components/Onboarding";
import Dashboard from "@/components/Dashboard";
import Logout from "./pages/Logout";
import AuthPage from "@/pages/AuthPage"; // <-- Added
import MobileTabBar from "@/components/MobileTabBar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function App() {
  const isMobile = useIsMobile();
  return (
    <Router>
  <Routes>
        {/* Landing page */}
        <Route path="/" element={<>
          <Landing />
          {isMobile && <MobileTabBar />}
        </>} />

        <Route path="/mock-interview" element={<>
          <MockInterview />
          {isMobile && <MobileTabBar />}
        </>} />

        {/* Resume Genius - ATS Resume Optimizer */}
        <Route path="/resume-genius" element={<>
          <ResumeGenius />
          {isMobile && <MobileTabBar />}
        </>} />

  {/* OppRadar page */}
  <Route path="/oppradar" element={<OppRadar />} />

        {/* Chat page */}
        <Route path="/chat" element={<>
          <Chat />
          {isMobile && <MobileTabBar />}
        </>} />

        {/* Government Snapshot */}
        <Route path="/gov-snapshot" element={<GovSnapshot />} />

        {/* Auth page */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Onboarding flow */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main dashboard */}
        <Route path="/dashboard" element={<>
          <Dashboard />
          {isMobile && <MobileTabBar />}
        </>} />

        {/* Logout page */}
        <Route path="/logout" element={<Logout />} />

      </Routes>
    </Router>
  );
}
