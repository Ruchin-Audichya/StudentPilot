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
    <div className="bg-black text-white min-h-screen flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold mb-6">{isSignUp ? "Create an Account" : "Welcome Back"}</h1>
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setIsSignUp(false)}
          className={`px-4 py-2 rounded-full ${!isSignUp ? "bg-white text-black" : "border border-white"}`}
        >
          Sign In
        </button>
        <button
          onClick={() => setIsSignUp(true)}
          className={`px-4 py-2 rounded-full ${isSignUp ? "bg-white text-black" : "border border-white"}`}
        >
          Sign Up
        </button>
      </div>
      <form onSubmit={handleAuth} className="flex flex-col gap-4 w-80">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="px-4 py-2 rounded text-black"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="px-4 py-2 rounded text-black"
          required
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="bg-white text-black px-4 py-2 rounded-full font-semibold">
          {isSignUp ? "Sign Up" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
