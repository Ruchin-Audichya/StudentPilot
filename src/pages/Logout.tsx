import { useEffect } from "react";

export default function Logout() {
  useEffect(() => {
    localStorage.clear();
    sessionStorage.clear();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full border rounded-xl p-8 shadow">
        <h1 className="text-2xl font-bold mb-2">You’ve been logged out</h1>
        <p className="text-gray-600 mb-6">
          Your session data has been cleared.
        </p>
        <a
          className="inline-block px-4 py-2 rounded bg-black text-white"
          href="/"
        >
          Go to Home
        </a>
      </div>
    </div>
  );
}
