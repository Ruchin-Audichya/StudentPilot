import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Pages & Components
import Landing from "@/pages/Landing";
import MockInterview from '@/pages/MockInterview'; 
import ResumeGenius from '@/pages/ResumeGenius';
import Chat from '@/pages/Chat';
import OppRadar from '@/pages/OppRadar';
import Onboarding from "@/components/Onboarding";
import Dashboard from "@/components/Dashboard";
import Logout from "./pages/Logout";
import AuthPage from "@/pages/AuthPage"; // <-- Added
import MobileTabBar from "@/components/MobileTabBar";
import { useIsMobile } from "@/hooks/use-mobile";
import CampusFeed from "@/pages/campus/Feed.tsx";
import AdminConsole from "@/pages/campus/AdminConsole.tsx";
import PlacementPostings from "@/pages/placement/Postings";
import AdminPostings from "@/pages/placement/AdminPostings";
import NotificationCenter from "@/components/NotificationCenter";
import CampusHub from "@/pages/campus/Hub";
import GovSnapshot from "@/pages/campus/GovSnapshot";

export default function App() {
  const isMobile = useIsMobile();
  return (
    <Router>
      <NotificationCenter />
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

        {/* Auth page */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Onboarding flow */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main dashboard */}
        <Route path="/dashboard" element={<>
          <Dashboard />
          {isMobile && <MobileTabBar />}
        </>} />

        {/* Campus Communication MVP */}
        <Route path="/campus" element={<>
          <CampusHub />
          {isMobile && <MobileTabBar />}
        </>} />
        <Route path="/campus/gov" element={<>
          <GovSnapshot />
          {isMobile && <MobileTabBar />}
        </>} />
        <Route path="/feed" element={<>
          <CampusFeed />
          {isMobile && <MobileTabBar />}
        </>} />
        <Route path="/admin/console" element={<>
          <AdminConsole />
          {isMobile && <MobileTabBar />}
        </>} />

        {/* Placement Lite */}
        <Route path="/placement" element={<>
          <PlacementPostings />
          {isMobile && <MobileTabBar />}
        </>} />
        <Route path="/admin/placements" element={<>
          <AdminPostings />
          {isMobile && <MobileTabBar />}
        </>} />

        {/* Logout page */}
        <Route path="/logout" element={<Logout />} />

      </Routes>
    </Router>
  );
}
