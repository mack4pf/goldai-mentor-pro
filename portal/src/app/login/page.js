"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Mail, Lock, ShieldCheck, Zap, AlertCircle, CheckCircle2 } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams.get("registered")) {
            setSuccess("Registration successful! You can now login.");
        }
    }, [searchParams]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Redirect to dashboard (AuthContext will handle data fetching)
            router.push("/dashboard");
        } catch (err) {
            let errorMsg = "Login failed. Please check your credentials.";
            if (err.code === "auth/user-not-found") errorMsg = "No account found with this email.";
            if (err.code === "auth/wrong-password") errorMsg = "Incorrect password.";
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-amber-900/20 via-black to-black">
            {/* Logo */}
            <Link href="/" className="mb-12 flex items-center gap-2 group">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-700 rounded-xl flex items-center justify-center font-bold text-black text-2xl shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-all">
                    G
                </div>
                <span className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-200 to-amber-500">
                    GoldAI Pro
                </span>
            </Link>

            <div className="w-full max-w-md p-10 rounded-[2.5rem] bg-white/[0.03] border border-white/10 backdrop-blur-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent rounded-[2.5rem]" />

                <div className="relative">
                    <h2 className="text-3xl font-extrabold mb-2 text-center">Welcome Back</h2>
                    <p className="text-white/40 text-center mb-8 text-sm">Secure access to your trading portal</p>

                    {success && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center gap-3 text-green-500 text-sm">
                            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                            {success}
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm animate-shake">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="flex flex-col gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                <input
                                    type="email"
                                    placeholder="joe@example.com"
                                    className="w-full pl-12 pr-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-white/10"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Password</label>
                                <button type="button" className="text-[10px] font-bold text-amber-500/60 hover:text-amber-500 transition-all uppercase tracking-widest">Forgot?</button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-white/10"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-4 bg-gradient-to-r from-amber-500 to-amber-700 text-black font-extrabold rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-amber-500/10"
                        >
                            {loading ? "Authenticating..." : "Login to Portal"}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <p className="mt-8 text-center text-white/30 text-sm">
                        Don't have an account?{" "}
                        <Link href="/register" className="text-amber-500 font-bold hover:underline underline-offset-4">
                            Register Now
                        </Link>
                    </p>
                </div>
            </div>

            <div className="mt-12 flex items-center gap-6 text-white/20 text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> SECURE SESSION
                </div>
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" /> CLOUD POWERED
                </div>
            </div>
        </div>
    );
}
