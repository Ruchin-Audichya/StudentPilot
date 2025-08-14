import { useState } from "react";

import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

import { useNavigate } from "react-router-dom";

import Cookies from "js-cookie";

import { auth } from "@/lib/firebase"; // ✅ use your firebase.ts export
export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      Cookies.set("user", userCredential.user.uid, { expires: 7 });
      navigate("/onboarding");
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="bg-black text-white min-h-screen flex items-center justify-center">
      {/* Card container */}
      <div className="bg-[#0d0d0d] border border-gray-800 rounded-xl shadow-lg w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          {isSignUp ? "Create an Account" : "Welcome Back"}
        </h1>

        {/* Tab buttons */}
        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => setIsSignUp(false)}
            className={`px-6 py-2 rounded-t-lg font-semibold ${
              !isSignUp ? "bg-white text-black" : "bg-gray-900 text-white"
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsSignUp(true)}
            className={`px-6 py-2 rounded-t-lg font-semibold ${
              isSignUp ? "bg-white text-black" : "bg-gray-900 text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 bg-transparent border border-gray-600 rounded-lg focus:outline-none focus:border-white"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 bg-transparent border border-gray-600 rounded-lg focus:outline-none focus:border-white"
            required
          />

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full mt-2 bg-white text-black py-2 rounded-lg font-semibold hover:bg-gray-200 transition"
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        {/* Footer text */}
        <p className="text-xs text-gray-500 text-center mt-4">
          Firebase authentication handled internally.
        </p>
      </div>
    </div>
  );
}
