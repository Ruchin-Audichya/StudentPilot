import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Pages & Components
import Landing from "@/pages/Landing";
import MockInterview from '@/pages/MockInterview'; 
import ResumeGenius from '@/pages/ResumeGenius';
import Onboarding from "@/components/Onboarding";
import Dashboard from "@/components/Dashboard";
import Logout from "./pages/Logout";
import AuthPage from "@/pages/AuthPage"; // <-- Added

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<Landing />} />

        <Route path="/mock-interview" element={<MockInterview />} />

        {/* Resume Genius - ATS Resume Optimizer */}
        <Route path="/resume-genius" element={<ResumeGenius />} />

        {/* Auth page */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Onboarding flow */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Logout page */}
        <Route path="/logout" element={<Logout />} />

      </Routes>
    </Router>
  );
}
