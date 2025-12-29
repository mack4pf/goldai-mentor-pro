"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Zap, BarChart3, Lock } from "lucide-react";

export default function LandingPage() {
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleActivate = (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate activation or redirect to login
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center">
      {/* Hero Section */}
      <nav className="w-full max-w-7xl px-6 py-8 flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-700 rounded-lg flex items-center justify-center font-bold text-black text-xl">
            G
          </div>
          <span className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
            GoldAI Pro
          </span>
        </div>
        <button className="px-6 py-2 bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all font-medium">
          Login
        </button>
      </nav>

      <main className="flex-1 w-full max-w-4xl px-6 flex flex-col items-center justify-center text-center py-20">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-sm font-medium mb-8 animate-pulse">
          Cloud Trade Copier is Now Live
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
          Automate Your Trading <br />
          <span className="text-amber-500">From the Cloud</span>
        </h1>

        <p className="text-lg md:text-xl text-white/50 mb-12 max-w-2xl">
          Connect your MT5 account and mirror professional institutional-grade trades instantly. No software to install. 100% automated.
        </p>

        {/* Activation Card */}
        <div className="w-full max-w-md p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-all rounded-3xl" />

          <div className="flex flex-col gap-6 relative">
            <div className="flex items-center justify-center w-16 h-16 bg-amber-500/10 rounded-2xl mx-auto mb-2">
              <Lock className="w-8 h-8 text-amber-500" />
            </div>

            <h2 className="text-2xl font-bold mb-2 text-white">Activate Your License</h2>

            <form onSubmit={handleActivate} className="flex flex-col gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter Access Code"
                  className="w-full px-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-amber-500/50 transition-all text-center text-lg font-mono tracking-widest placeholder:text-white/20"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-700 text-black font-bold rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? "Activating..." : "Get Started Now"}
                <ArrowRight className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
            <Zap className="w-10 h-10 text-amber-500 mb-4" />
            <h3 className="text-lg font-bold mb-2">Instant Copy</h3>
            <p className="text-white/40 text-sm">Low-latency trade execution directly between servers.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
            <ShieldCheck className="w-10 h-10 text-amber-500 mb-4" />
            <h3 className="text-lg font-bold mb-2">Auto-Secure</h3>
            <p className="text-white/40 text-sm">Built-in risk management and profit-trailing features.</p>
          </div>
          <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-left">
            <BarChart3 className="w-10 h-10 text-amber-500 mb-4" />
            <h3 className="text-lg font-bold mb-2">Daily Stats</h3>
            <p className="text-white/40 text-sm">Monitor your equity and daily performance in real-time.</p>
          </div>
        </div>
      </main>

      <footer className="w-full py-10 mt-20 border-t border-white/5 text-center text-white/20 text-sm">
        © 2024 GoldAI Mentor Pro. Professional Institutional Trading.
      </footer>
    </div>
  );
}
