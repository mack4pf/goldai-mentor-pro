"use client";

import { useState } from "react";
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
    User as UserIcon
} from "lucide-react";

export default function Dashboard() {
    const [mt5Config, setMt5Config] = useState({
        login: "",
        password: "",
        server: ""
    });
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleConnect = (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate MetaApi connection
        setTimeout(() => {
            setIsConnected(true);
            setLoading(false);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex">
            {/* Sidebar */}
            <aside className="w-64 border-r border-white/5 bg-black/20 flex flex-col p-6 max-md:hidden">
                <div className="flex items-center gap-2 mb-10">
                    <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center font-bold text-black">G</div>
                    <span className="font-bold text-xl tracking-tight uppercase">GoldAI Portal</span>
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

                <div className="mt-auto p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-xs text-white/40 mb-2 uppercase font-bold tracking-wider">System Status</p>
                    <div className="flex items-center gap-2 text-green-500 text-sm font-medium">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Master VPS Online
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Welcome Back, Trader</h1>
                        <p className="text-white/40">Manage your cloud trade copier and monitors stats.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="px-4 py-2 rounded-full border border-white/10 bg-white/5 flex items-center gap-2 text-sm text-white/60">
                            License: <span className="text-amber-500 font-bold">Premium Lifetime</span>
                        </div>
                        <div className="w-10 h-10 bg-amber-600/20 rounded-full border border-amber-500/30 overflow-hidden" />
                    </div>
                </header>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all">
                        <p className="text-white/40 text-sm mb-1">Total Profit</p>
                        <h2 className="text-3xl font-bold text-green-500">+$2,450.00</h2>
                        <div className="mt-4 flex items-center gap-1 text-xs text-green-500/60 font-medium">
                            <TrendingUp className="w-3 h-3" /> +12% this month
                        </div>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all">
                        <p className="text-white/40 text-sm mb-1">Win Rate</p>
                        <h2 className="text-3xl font-bold text-amber-500">74%</h2>
                        <div className="mt-4 text-xs text-white/20">Institutional Average: 68%</div>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-all">
                        <p className="text-white/40 text-sm mb-1">Total Trades</p>
                        <h2 className="text-3xl font-bold">142</h2>
                        <div className="mt-4 text-xs text-white/20">Active since Oct 2024</div>
                    </div>
                    <div className="p-6 rounded-3xl bg-amber-500 text-black shadow-lg shadow-amber-500/20 group cursor-pointer overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:scale-125 transition-all">
                            <ArrowUpRight className="w-12 h-12" />
                        </div>
                        <p className="font-bold text-black/60 text-sm mb-1">Current Equity</p>
                        <h2 className="text-3xl font-extrabold">$14,580.42</h2>
                        <div className="mt-4 text-xs font-bold text-black/40">Real-time sync enabled</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* MT5 Connection Form */}
                    <section className="lg:col-span-2 space-y-6">
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-xl font-bold">MT5 Account Connection</h3>
                                    <p className="text-sm text-white/40">Linked to MetaApi Cloud Gateway</p>
                                </div>
                                {isConnected ? (
                                    <div className="px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/20 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                        <Power className="w-3 h-3" /> Connected
                                    </div>
                                ) : (
                                    <div className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                        <Power className="w-3 h-3" /> Offline
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleConnect} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                        <UserIcon className="w-3 h-3" /> MT5 Login
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 1234567"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500/50 transition-all font-mono"
                                        value={mt5Config.login}
                                        onChange={(e) => setMt5Config({ ...mt5Config, login: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                        <Key className="w-3 h-3" /> Password
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 focus:outline-none focus:border-amber-500/50 transition-all"
                                        value={mt5Config.password}
                                        onChange={(e) => setMt5Config({ ...mt5Config, password: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                                        <Server className="w-3 h-3" /> Broker Server
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
                                        className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${isConnected
                                                ? 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                                                : 'bg-white text-black hover:bg-white/90'
                                            }`}
                                    >
                                        {loading ? "Syncing..." : isConnected ? "Disconnect Account" : "Connect & Start Copying"}
                                    </button>
                                    <p className="text-[10px] text-white/20 mt-4 text-center px-10 leading-relaxed uppercase tracking-tighter">
                                        By connecting, you agree to institutional-grade risk management. Your credentials are encrypted via MetaApi Cloud.
                                    </p>
                                </div>
                            </form>
                        </div>
                    </section>

                    {/* Activity Log */}
                    <section className="space-y-6">
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/10 h-full flex flex-col">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <History className="w-5 h-5 text-amber-500" /> Recent Events
                            </h3>

                            <div className="space-y-6 flex-1">
                                {[
                                    { type: 'BUY', symbol: 'XAUUSD', profit: '+$42.50', status: 'Success' },
                                    { type: 'SELL', symbol: 'XAUUSD', profit: '+$128.10', status: 'Success' },
                                    { type: 'BUY', symbol: 'XAUUSD', profit: '-$15.20', status: 'Loss' },
                                ].map((event, i) => (
                                    <div key={i} className="flex gap-4 items-start p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${event.type === 'BUY' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                            }`}>
                                            {event.type}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-bold">{event.symbol}</p>
                                            <p className="text-xs text-white/40">2 hours ago</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${event.profit.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>
                                                {event.profit}
                                            </p>
                                            <p className="text-[10px] text-white/20 uppercase font-bold">{event.status}</p>
                                        </div>
                                    </div>
                                ))}
                                {!isConnected && (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                                        <AlertCircle className="w-12 h-12 mb-4" />
                                        <p className="text-sm font-medium">Connect account to <br />view live trades</p>
                                    </div>
                                )}
                            </div>

                            <button className="w-full mt-6 py-3 text-sm font-bold text-white/40 hover:text-white transition-all underline decoration-white/10 underline-offset-4">
                                View Full History
                            </button>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
