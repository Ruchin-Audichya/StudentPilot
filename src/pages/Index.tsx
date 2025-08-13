// Old landing/index page retained for reference.
// If you want to restore the previous behavior, import this in App.tsx.
import { useState } from 'react';
import Onboarding from '@/components/Onboarding';
import Dashboard from '@/components/Dashboard';

interface StudentProfile {
  name: string;
  college: string;
  branch: string;
  year: string;
  skills: string[];
  interests: string[];
}

const OldIndex = () => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  const handleOnboardingComplete = (studentProfile: StudentProfile) => {
    setProfile(studentProfile);
  };

  if (!profile) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return <Dashboard profile={profile} />;
};

export default OldIndex;
