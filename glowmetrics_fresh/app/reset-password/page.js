"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    } else {
      setMessage("Password updated. Redirecting...");
      setTimeout(() => router.push("/dashboard"), 1500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#05070d] text-white">
      <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_40px_rgba(0,180,255,0.08)]">

        <h1 className="text-3xl font-semibold text-center mb-4">
          Reset Password
        </h1>

        <p className="text-sm text-white/50 text-center mb-6">
          Enter your new password below.
        </p>

        <form onSubmit={handleUpdatePassword}>
          <input
            type="password"
            placeholder="New password"
            className="w-full p-3 rounded-lg bg-white/10 border border-white/10 mb-4 focus:outline-none focus:border-cyan-400"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {message && (
            <div className="text-sm text-center mb-4 text-red-400">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 transition"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
