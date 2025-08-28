import { useState } from "react";

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
      {/* Ambient gradient blobs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: `
            radial-gradient(600px 300px at 20% 20%, rgba(99,102,241,0.4), transparent 60%),
            radial-gradient(500px 280px at 80% 0%, rgba(236,72,153,0.35), transparent 65%),
            radial-gradient(600px 400px at 50% 100%, rgba(139,92,246,0.35), transparent 60%)
          `,
          filter: "blur(40px) saturate(120%)",
          opacity: 0.7,
        }}
      />

      <div className="relative z-10 max-w-md w-full p-8 glass rounded-2xl border border-white/10 shadow-xl">
        <h1 className="text-2xl font-bold mb-6 text-center text-white">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>

        <form className="space-y-4">
          {isSignUp && (
            <input
              type="text"
              placeholder="Full name"
              className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <input
            type="email"
            placeholder="Email address"
            className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full px-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold shadow-lg hover:opacity-90 transition"
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-white/70">
          {isSignUp ? "Already have an account?" : "Don’t have an account?"}{" "}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="underline text-indigo-300 hover:text-indigo-200 transition"
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </div>
    </div>
  );
}
