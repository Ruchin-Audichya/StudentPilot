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

const Index = () => {
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  const handleOnboardingComplete = (studentProfile: StudentProfile) => {
    setProfile(studentProfile);
  };

  if (!profile) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return <Dashboard profile={profile} />;
};

export default Index;
