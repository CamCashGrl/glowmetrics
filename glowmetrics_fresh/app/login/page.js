"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      window.location.href = "/dashboard";
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      alert("Enter your email first.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://www.camcashgrl.com/reset-password",
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Password reset email sent. Check your inbox.");
    }
  };

  return (
    <div className="min-h-screen relative bg-[#05070d] text-white overflow-hidden">

      {/* 🌊 Subtle animated background */}
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_30%_30%,rgba(0,180,255,0.15),transparent_60%),radial-gradient(circle_at_70%_70%,rgba(0,120,255,0.12),transparent_60%)] animate-pulse" />

      {/* 🔵 Main Content */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        
        <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_40px_rgba(0,180,255,0.08)]">

          {/* 🔷 Logo / Title */}
          <h1 className="text-3xl font-semibold text-center mb-2 tracking-tight">
            CamCash
          </h1>

          {/* 🔹 Branding Description */}
          <p className="text-sm text-white/50 text-center mb-6 max-w-sm mx-auto">
            Access your dashboard — track tips, monitor performance, and see what’s working instantly.
          </p>

          {/* ✉️ Email */}
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 rounded-lg bg-white/10 border border-white/10 mb-4 focus:outline-none focus:border-cyan-400 transition"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {/* 🔒 Password */}
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg bg-white/10 border border-white/10 mb-2 focus:outline-none focus:border-cyan-400 transition"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {/* ❗ Forgot Password */}
          <div className="flex justify-end mb-4">
            <button
              onClick={handleForgotPassword}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition"
            >
              Forgot password?
            </button>
          </div>

          {/* 🔘 Login Button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 transition"
          >
            {loading ? "Logging in..." : "Log In"}
          </button>

          {/* 🔐 Trust Microcopy */}
          <p className="text-xs text-white/40 mt-4 text-center">
            Secure login. Your data is protected.
          </p>
        </div>
      </div>
    </div>
  );
}
