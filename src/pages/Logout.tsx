import { useEffect } from "react";

export default function Logout() {
  useEffect(() => {
    localStorage.clear();
    sessionStorage.clear();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Ambient gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: `
            radial-gradient(600px 300px at 10% 20%, rgba(99,102,241,0.35), transparent 60%),
            radial-gradient(500px 280px at 90% 0%, rgba(236,72,153,0.3), transparent 65%),
            radial-gradient(600px 400px at 50% 100%, rgba(139,92,246,0.3), transparent 60%)
          `,
          filter: "blur(40px) saturate(120%)",
          opacity: 0.65,
        }}
      />

      <div className="relative z-10 max-w-md w-full p-8 glass rounded-2xl border border-white/10 shadow-xl text-center">
        <h1 className="text-2xl font-bold mb-2 text-white">
          You’ve been logged out
        </h1>
        <p className="text-white/70 mb-6">
          Your session data has been cleared.
        </p>
        <a
          className="inline-block px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:opacity-90 transition"
          href="/"
        >
          Go to Home
        </a>
      </div>
    </div>
  );
}
