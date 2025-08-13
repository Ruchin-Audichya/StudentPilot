import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Pages & Components
import Landing from "@/pages/Landing";
import Onboarding from "@/components/Onboarding";
import Dashboard from "@/components/Dashboard";
import Logout from "./pages/Logout";

export default function App() {
  return (
    <Router>
      <Routes>
  {/* Landing page */}
  <Route path="/" element={<Landing />} />

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
