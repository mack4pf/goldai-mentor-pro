"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, User, Mail, Lock, Key, ShieldCheck, AlertCircle, Zap } from "lucide-react";
import axios from "axios";
import Link from "next/link";

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        accessCode: ""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();

    const BRIDGE_API_URL = process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'https://goldai-bridge-is7d.onrender.com/api/v1';

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const response = await axios.post(`${BRIDGE_API_URL}/users/register`, formData);

            if (response.data.success) {
                // Registration successful, redirect to login or dashboard
                // The backend returns a custom token which can be used to sign in
                // But for now, let's redirect to login to be safe or just show success
                router.push("/login?registered=true");
            }
        } catch (err) {
            setError(err.response?.data?.error || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-black to-black">
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
                    <h2 className="text-3xl font-extrabold mb-2 text-center">Create Account</h2>
                    <p className="text-white/40 text-center mb-8 text-sm">Join the elite trading cloud network</p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm animate-shake">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="flex flex-col gap-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="trader_joe"
                                    className="w-full pl-12 pr-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-white/10"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                <input
                                    type="email"
                                    placeholder="joe@example.com"
                                    className="w-full pl-12 pr-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-white/10"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] ml-1">Secure Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-5 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-amber-500/50 transition-all placeholder:text-white/10"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-amber-500/40 uppercase tracking-[0.2em] ml-1">Access Code</label>
                            <div className="relative border-2 border-amber-500/10 rounded-2xl">
                                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-500/50" />
                                <input
                                    type="text"
                                    placeholder="GOLD-XXXX-XXXX"
                                    className="w-full pl-12 pr-5 py-4 bg-amber-500/5 border-none rounded-2xl focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all text-amber-500 font-mono tracking-widest placeholder:text-amber-500/20"
                                    value={formData.accessCode}
                                    onChange={(e) => setFormData({ ...formData, accessCode: e.target.value.toUpperCase() })}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 py-4 bg-gradient-to-r from-amber-500 to-amber-700 text-black font-extrabold rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 shadow-xl shadow-amber-500/10"
                        >
                            {loading ? "Creating Account..." : "Join GoldAI Network"}
                            <ArrowRight className="w-5 h-5" />
                        </button>
                    </form>

                    <p className="mt-8 text-center text-white/30 text-sm">
                        Already have an account?{" "}
                        <Link href="/login" className="text-amber-500 font-bold hover:underline underline-offset-4">
                            Login Here
                        </Link>
                    </p>
                </div>
            </div>

            <div className="mt-12 flex items-center gap-6 text-white/20 text-[10px] font-bold uppercase tracking-widest">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> SECURE END-TO-END
                </div>
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" /> INSTANT ACTIVATION
                </div>
            </div>
        </div>
    );
}
