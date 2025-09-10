import React, { useMemo } from "react";
import TopNav from "@/components/TopNav";
import ChatWidget from "@/components/ChatWidget";

export default function ChatPage() {
  // Pull profile from onboarding localStorage if available
  const profile = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("onboarding") || "null") || { name: "Friend", skills: [], interests: [] }; } catch { return { name: "Friend", skills: [], interests: [] }; }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav actions={[]} />
      <main className="flex-1 px-3 sm:px-6 py-3 sm:py-6">
        <div className="max-w-4xl mx-auto">
          <ChatWidget profile={profile} resumeUploaded={false} />
        </div>
      </main>
    </div>
  );
}
