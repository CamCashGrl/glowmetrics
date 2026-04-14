"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

// useSearchParams() requires Suspense in Next.js 14 — isolated here
function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  useEffect(() => {
    if (searchParams.get("mode") === "signup") setIsSignUp(true);
  }, [searchParams]);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("beta_users")
        .select("onboarding_complete")
        .eq("user_id", user.id)
        .single();
      router.replace(profile?.onboarding_complete ? "/dashboard" : "/onboarding");
    });
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("beta_users")
          .select("onboarding_complete")
          .eq("user_id", user.id)
          .single();
        router.push(profile?.onboarding_complete ? "/dashboard" : "/onboarding");
      }
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.push("/onboarding");
      } else {
        setError("Account created! Check your email to confirm your account.");
        setIsSignUp(false);
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { setError("Enter your email first."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://www.camcashgrl.com/reset-password",
    });
    if (error) setError(error.message);
    else setError("Password reset email sent. Check your inbox.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#05070d] text-white">
      <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_0_40px_rgba(0,180,255,0.08)]">
        <h1 className="text-3xl font-semibold text-center mb-2">CamCash</h1>
        <p className="text-sm text-white/50 text-center mb-6">
          {isSignUp
            ? "Create your account and start tracking your performance."
            : "Access your dashboard — track tips, monitor performance, and see what's working instantly."}
        </p>

        <div className="flex rounded-lg overflow-hidden border border-white/10 mb-6">
          <button type="button" onClick={() => { setIsSignUp(false); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium transition ${!isSignUp ? "bg-cyan-500/20 text-cyan-400" : "text-white/40 hover:text-white/60"}`}>
            Log In
          </button>
          <button type="button" onClick={() => { setIsSignUp(true); setError(""); }}
            className={`flex-1 py-2 text-sm font-medium transition ${isSignUp ? "bg-cyan-500/20 text-cyan-400" : "text-white/40 hover:text-white/60"}`}>
            Sign Up
          </button>
        </div>

        <form onSubmit={isSignUp ? handleSignUp : handleLogin}>
          <input type="email" placeholder="Email"
            className="w-full p-3 rounded-lg bg-white/10 border border-white/10 mb-4 focus:outline-none focus:border-cyan-400"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password"
            className="w-full p-3 rounded-lg bg-white/10 border border-white/10 mb-2 focus:outline-none focus:border-cyan-400"
            value={password} onChange={(e) => setPassword(e.target.value)} required />

          {!isSignUp && (
            <div className="flex justify-end mb-4">
              <button type="button" onClick={handleForgotPassword} className="text-sm text-cyan-400 hover:text-cyan-300">
                Forgot password?
              </button>
            </div>
          )}
          {isSignUp && <div className="mb-4" />}

          {error && (
            <div className={`text-sm mb-4 text-center ${error.includes("Check your email") || error.includes("sent") ? "text-cyan-400" : "text-red-400"}`}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 transition">
            {loading ? (isSignUp ? "Creating account..." : "Logging in...") : (isSignUp ? "Start Free" : "Log In")}
          </button>
        </form>

        <p className="text-xs text-white/40 mt-4 text-center">Secure login. Your data is protected.</p>
      </div>
    </div>
  );
}

// Suspense wrapper required by Next.js 14 when using useSearchParams()
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#05070d]">
        <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid transparent", borderTopColor: "#ec4899", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    }>
      <LoginInner />
    </Suspense>
  );
}
