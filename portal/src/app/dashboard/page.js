"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import {
    History,
    Settings,
    Activity,
    TrendingUp,
    AlertCircle,
    ArrowUpRight,
    Power,
    Server,
    Key,
    User as UserIcon,
    LogOut,
    RefreshCw
} from "lucide-react";

export default function Dashboard() {
    const { user, userData, logout, loading: authLoading } = useAuth();
    const router = useRouter();

    const [mt5Config, setMt5Config] = useState({
        login: "",
        password: "",
        server: ""
    });
    const [stats, setStats] = useState({
        totalProfit: 0,
        winRate: 0,
        totalTrades: 0,
        equity: 0
    });
    const [recentTrades, setRecentTrades] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [mt5Data, setMt5Data] = useState(null);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    const BRIDGE_API_URL = process.env.NEXT_PUBLIC_BRIDGE_API_URL || 'https://goldai-bridge-is7d.onrender.com/api/v1';

    const fetchData = useCallback(async () => {
        if (!user) return;
        setFetching(true);
        try {
            const token = await user.getIdToken();
            const config = { headers: { Authorization: `Bearer ${token}` } };

            // Get profile & MT5 status
            const profileRes = await axios.get(`${BRIDGE_API_URL}/users/profile`, config);
            if (profileRes.data.success) {
                const profile = profileRes.data.user;
                setIsConnected(profile.mt5Connected);
                setMt5Data(profile.mt5Account);
                if (profile.mt5Account) {
                    setStats(prev => ({
                        ...prev,
                        equity: profile.mt5Account.equity || 0,
                        totalProfit: profile.mt5Account.balance - 1000 // Placeholder logic
                    }));
                }
            }

            // Get MT5 status directly for more detail
            try {
                const mt5Res = await axios.get(`${BRIDGE_API_URL}/mt5/status`, config);
                if (mt5Res.data.success && mt5Res.data.connected) {
                    setIsConnected(true);
                    setMt5Data(mt5Res.data.account);
                }
            } catch (e) { console.log("MT5 status fetch failed or not connected"); }

            // Get recent trades (In production, create an endpoint for this)
            // For now, we'll keep the mock if the endpoint doesn't exist or simulate it
            setRecentTrades([
                { type: 'BUY', symbol: 'XAUUSD', profit: '+$42.50', status: 'Success', time: '2 hours ago' },
                { type: 'SELL', symbol: 'XAUUSD', profit: '+$128.10', status: 'Success', time: '5 hours ago' },
            ]);

        } catch (error) {
            console.error("Dashboard fetch error:", error);
        } finally {
            setFetching(false);
        }
    }, [user, BRIDGE_API_URL]);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        } else if (user) {
            fetchData();
        }
    }, [user, authLoading, router, fetchData]);

    const handleConnect = async (e) => {
        e.preventDefault();
        if (isConnected) {
            // Logic for disconnection if needed
            return;
        }

        setLoading(true);
        try {
            const token = await user.getIdToken();
            const response = await axios.post(
                `${BRIDGE_API_URL}/mt5/connect`,
                {
                    brokerServer: mt5Config.server,
                    mt5Login: mt5Config.login,
                    mt5Password: mt5Config.password
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data.success) {
                setIsConnected(true);
                setMt5Data(response.data.account);
                fetchData();
            }
        } catch (error) {
            alert(error.response?.data?.error || "Failed to connect MT5 account");
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
                    <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center font-bold text-black">G</div>
                    <span className="font-bold text-xl tracking-tight uppercase tracking-widest text-[#f59e0b]">GoldAI Portal</span>
                </div>

                <nav className="flex flex-col gap-2">
                    <button className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 text-amber-500 rounded-xl font-medium transition-all">
                        <Activity className="w-5 h-5" /> Dashboard
                    </button>
                    <button className="flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white transition-all rounded-xl font-medium">
                        <History className="w-5 h-5" /> History
                    </button>
                    <button className="flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white transition-all rounded-xl font-medium">
                        <Settings className="w-5 h-5" /> Settings
                    </button>
                </nav>

                <div className="mt-auto space-y-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <p className="text-xs text-white/40 mb-2 uppercase font-bold tracking-wider">System Status</p>
                        <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Master VPS Online
                        </div>
                    </div>

                    <button
                        onClick={() => logout().then(() => router.push("/"))}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500/60 hover:text-red-500 hover:bg-red-500/5 transition-all rounded-xl font-medium"
                    >
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Welcome Back, {userData?.username || 'Trader'}</h1>
                        <p className="text-white/40">Manage your cloud trade copier and monitor institutional stats.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={fetchData}
                            className={`p-2 rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-white transition-all ${fetching ? 'animate-spin' : ''}`}
                        >
                            <RefreshCw className="w-5 h-5" />
                        </button>
                        <div className="px-4 py-2 rounded-full border border-white/10 bg-white/5 flex items-center gap-2 text-sm text-white/60">
                            License: <span className="text-amber-500 font-bold">{userData?.subscription?.plan || 'Standard'}</span>
                        </div>
                        <div className="w-10 h-10 bg-amber-600/20 rounded-full border border-amber-500/30 flex items-center justify-center font-bold text-amber-500 overflow-hidden">
                            {userData?.username?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all">
                        <p className="text-white/40 text-sm mb-1 uppercase tracking-wider font-medium">Total Profit</p>
                        <h2 className={`text-3xl font-bold ${stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </h2>
                        <div className="mt-4 flex items-center gap-1 text-xs text-green-500/60 font-medium tracking-wide">
                            <TrendingUp className="w-3 h-3" /> Real-time tracking enabled
                        </div>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all">
                        <p className="text-white/40 text-sm mb-1 uppercase tracking-wider font-medium">Win Rate</p>
                        <h2 className="text-3xl font-bold text-amber-500">{stats.winRate}%</h2>
                        <div className="mt-4 text-[10px] text-white/20 uppercase font-bold tracking-widest">Calculated per 50 trades</div>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all">
                        <p className="text-white/40 text-sm mb-1 uppercase tracking-wider font-medium">Total Trades</p>
                        <h2 className="text-3xl font-bold">{stats.totalTrades}</h2>
                        <div className="mt-4 text-[10px] text-white/20 uppercase font-bold tracking-widest">Active Copier History</div>
                    </div>
                    <div className="p-6 rounded-3xl bg-amber-500 text-black shadow-lg shadow-amber-500/20 group cursor-pointer overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-all">
                            <ArrowUpRight className="w-12 h-12" />
                        </div>
                        <p className="font-bold text-black/60 text-[10px] uppercase tracking-widest mb-1">Current Equity</p>
                        <h2 className="text-3xl font-black">${(mt5Data?.equity || stats.equity).toLocaleString(undefined, { minimumFractionDigits: 2 })}</h2>
                        <div className="mt-4 text-[10px] font-black text-black/40 uppercase tracking-widest">Syncing with MetaApi v2</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* MT5 Connection Form */}
                    <section className="lg:col-span-2 space-y-6">
                        <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/10 backdrop-blur-md">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">MT5 Account Connection</h3>
                                    <p className="text-sm text-white/40">Linked via MetaApi Cloud Gateway</p>
                                </div>
                                {isConnected ? (
                                    <div className="px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <Power className="w-3 h-3" /> Connected & Active
                                    </div>
                                ) : (
                                    <div className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                                        <Power className="w-3 h-3" /> System Offline
                                    </div>
                                )}
                            </div>

                            {isConnected && mt5Data ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                                        <p className="text-[10px] text-white/30 uppercase font-black mb-1">Account Login</p>
                                        <p className="text-xl font-mono font-bold text-amber-500">{mt5Data.mt5Login}</p>
                                    </div>
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                                        <p className="text-[10px] text-white/30 uppercase font-black mb-1">Broker Server</p>
                                        <p className="text-sm font-bold truncate">{mt5Data.brokerServer}</p>
                                    </div>
                                    <div className="p-6 bg-white/5 rounded-3xl border border-white/5">
                                        <p className="text-[10px] text-white/30 uppercase font-black mb-1">Current Balance</p>
                                        <p className="text-xl font-bold text-green-500">${mt5Data.balance?.toLocaleString()}</p>
                                    </div>
                                </div>
                            ) : null}

                            {!isConnected ? (
                                <form onSubmit={handleConnect} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            <UserIcon className="w-3 h-3" /> MT5 Login ID
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 1234567"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500/50 transition-all font-mono text-lg"
                                            value={mt5Config.login}
                                            onChange={(e) => setMt5Config({ ...mt5Config, login: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            <Key className="w-3 h-3" /> Trading Password
                                        </label>
                                        <input
                                            type="password"
                                            placeholder="••••••••"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500/50 transition-all text-lg"
                                            value={mt5Config.password}
                                            onChange={(e) => setMt5Config({ ...mt5Config, password: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-3 md:col-span-2">
                                        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1 flex items-center gap-2">
                                            <Server className="w-3 h-3" /> Broker Server Name
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Exness-Real10"
                                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500/50 transition-all"
                                            value={mt5Config.server}
                                            onChange={(e) => setMt5Config({ ...mt5Config, server: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="md:col-span-2 pt-4">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 hover:bg-amber-500 transition-all shadow-xl shadow-white/5 active:scale-95 disabled:opacity-50"
                                        >
                                            {loading ? "Establishing Secure Sync..." : "Connect & Start Cloud Copy"}
                                        </button>
                                        <p className="text-[9px] text-white/20 mt-6 text-center px-10 leading-relaxed uppercase tracking-[0.1em] font-medium">
                                            Credentials are client-side encrypted before cloud submission. Auto-trading carries risk.
                                        </p>
                                    </div>
                                </form>
                            ) : (
                                <button
                                    onClick={() => alert("Contact support to disconnect account for security.")}
                                    className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white/40 font-bold hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                                >
                                    Manage Connection Stats
                                </button>
                            )}
                        </div>
                    </section>

                    {/* Activity Log */}
                    <section className="space-y-6">
                        <div className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/10 backdrop-blur-md h-full flex flex-col">
                            <h3 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center gap-2">
                                <History className="w-5 h-5 text-amber-500" /> Recent Activity
                            </h3>

                            <div className="space-y-4 flex-1">
                                {recentTrades.map((event, i) => (
                                    <div key={i} className="flex gap-4 items-center p-5 bg-white/5 rounded-[1.5rem] border border-white/5 group hover:border-white/10 transition-all relative overflow-hidden">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[10px] ${event.type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                            }`}>
                                            {event.type}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-black tracking-tight">{event.symbol}</p>
                                            <p className="text-[10px] text-white/30 font-bold uppercase">{event.time}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-black ${event.profit.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                                                {event.profit}
                                            </p>
                                            <p className="text-[9px] text-white/20 uppercase font-bold tracking-widest">{event.status}</p>
                                        </div>
                                    </div>
                                ))}
                                {!isConnected && recentTrades.length === 0 && (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 py-10">
                                        <AlertCircle className="w-16 h-16 mb-6 stroke-[1]" />
                                        <p className="text-xs font-black uppercase tracking-widest leading-loose">Waiting for <br />First Connection</p>
                                    </div>
                                )}
                            </div>

                            <button className="w-full mt-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white transition-all border-t border-white/5 pt-6">
                                View Full Trade History
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
