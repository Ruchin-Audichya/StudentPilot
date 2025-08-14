import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Pages & Components
import Landing from "@/pages/Landing";
import Onboarding from "@/components/Onboarding";
import Dashboard from "@/components/Dashboard";
import Logout from "./pages/Logout";
<<<<<<< HEAD
import AuthPage from "./pages/AuthPage";
=======
import AuthPage from "@/pages/AuthPage"; // <-- Added
>>>>>>> 46569f9994336f70253926cfabea35d32c6aff47

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<Landing />} />

        {/* Auth page */}
        <Route path="/auth" element={<AuthPage />} />

        {/* Onboarding flow */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Main dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Logout page */}
        <Route path="/logout" element={<Logout />} />

        {/* Auth page */}
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
    </Router>
  );
}
