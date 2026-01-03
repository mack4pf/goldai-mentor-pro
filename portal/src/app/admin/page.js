"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import {
    Users as UsersIcon,
    Key,
    Plus,
    Monitor,
    Download,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    Copy,
    LogOut,
    RefreshCw,
    TrendingUp,
    Radio,
    Zap,
    ZapOff
} from "lucide-react";

const ADMIN_EMAIL = "mackiyeritufu@gmail.com";

export default function AdminDashboard() {
    const { user, logout, loading: authLoading } = useAuth();
    const router = useRouter();

    const [codes, setCodes] = useState([]);
    const [stats, setStats] = useState({
        users: { total: 0, active: 0, suspended: 0 },
        mt5: { totalConnections: 0 },
        trades: { today: 0, successfulToday: 0, failedToday: 0 },
        accessCodes: { total: 0, unused: 0, used: 0 }
    });
    const [config, setConfig] = useState({ broadcastEnabled: true });
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const BRIDGE_API_URL = process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'https://goldai-bridge-is7d.onrender.com/api/v1';

    const fetchData = useCallback(async () => {
        if (!user) return;
        setFetching(true);
        try {
            const token = await user.getIdToken();
            const config = { headers: { Authorization: `Bearer ${token}` } };

            // 1. Fetch Stats
            const statsRes = await axios.get(`${BRIDGE_API_URL}/admin/stats`, config);
            if (statsRes.data.success) {
                setStats(statsRes.data.stats);
            }

            // 2. Fetch Access Codes
            const codesRes = await axios.get(`${BRIDGE_API_URL}/admin/access-codes`, config);
            if (codesRes.data.success) {
                setCodes(codesRes.data.codes);
            }

            // 3. Fetch System Config
            const configRes = await axios.get(`${BRIDGE_API_URL}/admin/config`, config);
            if (configRes.data.success) {
                setConfig(configRes.data.config);
            }
        } catch (error) {
            console.error("Admin fetch error:", error);
            if (error.response?.status === 403) {
                alert("Unauthorized: Admin access required");
                router.push("/dashboard");
            }
        } finally {
            setFetching(false);
        }
    }, [user, BRIDGE_API_URL, router]);

    useEffect(() => {
        if (!authLoading) {
            if (!user) {
                router.push("/login");
            } else if (user.email !== ADMIN_EMAIL) {
                router.push("/dashboard");
            } else {
                fetchData();
            }
        }
    }, [user, authLoading, router, fetchData]);

    const generateCode = async () => {
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await axios.post(
                `${BRIDGE_API_URL}/admin/access-codes/generate`,
                { count: 1, expiryDays: 30 },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                fetchData(); // Refresh list
            }
        } catch (error) {
            alert("Failed to generate code");
        } finally {
            setLoading(false);
        }
    };

    const toggleBroadcast = async () => {
        const newState = !config.broadcastEnabled;
        setLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await axios.post(
                `${BRIDGE_API_URL}/admin/config`,
                { broadcastEnabled: newState },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setConfig({ ...config, broadcastEnabled: newState });
            }
        } catch (error) {
            alert("Failed to update broadcast status");
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || (!user && !authLoading)) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-black/20 flex flex-col p-6 max-md:hidden">
                <div className="flex items-center gap-2 mb-10">
                    <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center font-bold text-black border-2 border-black/20">A</div>
                    <span className="font-bold text-xl tracking-tight uppercase tracking-widest text-[#f59e0b]">Admin Core</span>
                </div>

                <nav className="flex flex-col gap-2">
                    <button className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 text-amber-500 rounded-xl font-medium transition-all text-left">
                        <Key className="w-5 h-5" /> Access Codes
                    </button>
                    <button className="flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white transition-all rounded-xl font-medium text-left">
                        <UsersIcon className="w-5 h-5" /> All Users
                    </button>
                    <button className="flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white transition-all rounded-xl font-medium text-left">
                        <Monitor className="w-5 h-5" /> Master VPS
                    </button>
                </nav>

                <div className="mt-auto flex flex-col gap-2">
                    <button
                        onClick={() => logout().then(() => router.push("/"))}
                        className="flex items-center gap-3 px-4 py-3 text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all rounded-xl font-medium text-left"
                    >
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight mb-1">Administrative Control</h1>
                        <p className="text-white/40">Manage licenses, connection codes, and copier health.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={fetchData}
                            className={`p-3 rounded-2xl border border-white/10 bg-white/5 text-white/40 hover:text-white transition-all ${fetching ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                            onClick={generateCode}
                            disabled={loading}
                            className="px-6 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl flex items-center gap-2 hover:bg-amber-500 transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                        >
                            <Plus className="w-5 h-5" /> {loading ? "Generating..." : "New Access Code"}
                        </button>
                    </div>
                </header>

                {/* Global Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/10">
                        <p className="text-white/40 text-[10px] mb-2 uppercase font-black tracking-[0.2em]">Total Users</p>
                        <h2 className="text-3xl font-black">{stats.users.total}</h2>
                        <p className="text-[10px] text-green-500 font-bold mt-2">{stats.users.active} Active Accounts</p>
                    </div>
                    <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/10">
                        <p className="text-white/40 text-[10px] mb-2 uppercase font-black tracking-[0.2em]">Active Copies</p>
                        <h2 className="text-3xl font-black text-amber-500">{stats.mt5.totalConnections} <span className="text-xs text-white/20">/ 100</span></h2>
                        <p className="text-[10px] text-white/20 font-bold mt-2">Server Capacity: 84%</p>
                    </div>
                    <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/10">
                        <p className="text-white/40 text-[10px] mb-2 uppercase font-black tracking-[0.2em]">Trades Today</p>
                        <h2 className="text-3xl font-black text-white">{stats.trades.today}</h2>
                        <p className="text-[10px] text-green-500 font-bold mt-2">{stats.trades.successfulToday} Success Hits</p>
                    </div>
                    <div className="p-8 rounded-[2rem] bg-white/10 border border-amber-500/30 shadow-lg shadow-amber-500/5">
                        <p className="text-amber-500 text-[10px] mb-2 uppercase font-black tracking-[0.2em]">Available Codes</p>
                        <div className="flex items-center justify-between">
                            <h2 className="text-3xl font-black">{stats.accessCodes.unused}</h2>
                            <TrendingUp className="w-6 h-6 text-amber-500/20" />
                        </div>
                        <p className="text-[10px] text-white/40 font-bold mt-2">{stats.accessCodes.used} Codes Consumed</p>
                    </div>
                </div>

                {/* System Control Panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                    <div className="p-8 rounded-[2rem] bg-amber-500/5 border border-amber-500/20 backdrop-blur-sm flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${config.broadcastEnabled ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                {config.broadcastEnabled ? <Zap className="w-7 h-7" /> : <ZapOff className="w-7 h-7" />}
                            </div>
                            <div>
                                <h3 className="font-black uppercase tracking-tight text-lg leading-tight">Signal Broadcast</h3>
                                <p className="text-white/40 text-xs font-medium mt-1">
                                    {config.broadcastEnabled
                                        ? "Currently pushing hourly AI signals to all active users."
                                        : "Signal generation is paused. No API requests are being made."}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={toggleBroadcast}
                            disabled={loading}
                            className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all border ${config.broadcastEnabled
                                ? 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500 hover:text-white'
                                : 'bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500 hover:text-white'}`}
                        >
                            {loading ? "..." : (config.broadcastEnabled ? "Shut Down" : "Initialize")}
                        </button>
                    </div>

                    <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/10 backdrop-blur-sm flex items-center justify-between opacity-50">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl bg-white/5 text-white/40 flex items-center justify-center">
                                <Radio className="w-7 h-7" />
                            </div>
                            <div>
                                <h3 className="font-black uppercase tracking-tight text-lg leading-tight">Bridge Health</h3>
                                <p className="text-white/40 text-xs font-medium mt-1">API latency: 42ms | Latency: 1.2s</p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40">
                            Nominal
                        </div>
                    </div>
                </div>

                {/* Access Codes Table */}
                <section className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                        <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-3">
                            <Filter className="w-4 h-4 text-amber-500" /> License Registry
                        </h3>
                        <div className="flex gap-3">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="Search registry..."
                                    className="bg-black/40 border border-white/10 rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:border-amber-500/30 transition-all font-medium"
                                />
                            </div>
                            <button className="p-3 border border-white/10 rounded-2xl hover:bg-white/5 transition-all text-white/40 hover:text-white">
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 text-white/20 text-[10px] font-black uppercase tracking-[0.2em]">
                                    <th className="px-10 py-6">Unique Access Token</th>
                                    <th className="px-10 py-6">Plan Tier</th>
                                    <th className="px-10 py-6">Consumer Identity</th>
                                    <th className="px-10 py-6">Lifecycle Status</th>
                                    <th className="px-10 py-6 text-right">Registry Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {codes.map((code, i) => (
                                    <tr key={code.id || i} className="hover:bg-white/[0.02] transition-all group">
                                        <td className="px-10 py-6">
                                            <code className="text-amber-500 font-bold font-mono px-3 py-1.5 bg-amber-500/5 rounded-xl border border-amber-500/10 text-xs">
                                                {code.code}
                                            </code>
                                        </td>
                                        <td className="px-10 py-6">
                                            <span className="text-xs font-black uppercase tracking-wider text-white/60">
                                                {code.plan || 'Standard 30D'}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{code.usedBy || '-'}</span>
                                                {code.usedAt && <span className="text-[9px] text-white/20 uppercase font-bold">Claimed {new Date(code.usedAt).toLocaleDateString()}</span>}
                                            </div>
                                        </td>
                                        <td className="px-10 py-6">
                                            <span className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] border ${code.status === 'used'
                                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                : code.status === 'unused'
                                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                    : 'bg-white/5 text-white/20 border-white/10'
                                                }`}>
                                                {code.status === 'used' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {code.status}
                                            </span>
                                        </td>
                                        <td className="px-10 py-6 text-right">
                                            <button className="p-2.5 text-white/10 hover:text-amber-500 transition-all opacity-0 group-hover:opacity-100 bg-white/5 rounded-xl">
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {codes.length === 0 && !fetching && (
                            <div className="py-20 text-center opacity-30 flex flex-col items-center">
                                <Key className="w-12 h-12 mb-4 stroke-[1]" />
                                <p className="text-xs font-black uppercase tracking-[0.2em]">No Access Tokens Registered</p>
                            </div>
                        )}
                    </div>
                </section>
            </main>
        </div>
    );
}
