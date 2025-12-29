"use client";

import { useState } from "react";
import {
    Users,
    Key,
    Plus,
    Monitor,
    Download,
    Search,
    Filter,
    CheckCircle2,
    XCircle,
    Copy
} from "lucide-react";

export default function AdminDashboard() {
    const [codes, setCodes] = useState([
        { code: "GOLD-XL-4589", plan: "Lifetime", status: "Active", user: "John Doe" },
        { code: "GOLD-30-7712", plan: "30 Days", status: "Unused", user: "-" },
        { code: "GOLD-90-2210", plan: "90 Days", status: "Expired", user: "Sarah Smith" },
    ]);

    const generateCode = () => {
        const newCode = {
            code: `GOLD-NEW-${Math.floor(1000 + Math.random() * 9000)}`,
            plan: "Lifetime",
            status: "Unused",
            user: "-"
        };
        setCodes([newCode, ...codes]);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex">
            {/* Sidebar - Same as Dashboard but with Admin Nav */}
            <aside className="w-64 border-r border-white/5 bg-black/20 flex flex-col p-6 max-md:hidden">
                <div className="flex items-center gap-2 mb-10">
                    <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center font-bold text-black border-2 border-black/20">A</div>
                    <span className="font-bold text-xl tracking-tight uppercase">Admin Core</span>
                </div>

                <nav className="flex flex-col gap-2">
                    <button className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 text-amber-500 rounded-xl font-medium transition-all text-left">
                        <Key className="w-5 h-5" /> Access Codes
                    </button>
                    <button className="flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white transition-all rounded-xl font-medium text-left">
                        <Users className="w-5 h-5" /> All Users
                    </button>
                    <button className="flex items-center gap-3 px-4 py-3 text-white/40 hover:text-white transition-all rounded-xl font-medium text-left">
                        <Monitor className="w-5 h-5" /> Master VPS
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto">
                <header className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-bold mb-1">Administrative Control</h1>
                        <p className="text-white/40">Manage licenses, connection codes, and copier health.</p>
                    </div>
                    <button
                        onClick={generateCode}
                        className="px-6 py-3 bg-white text-black font-bold rounded-2xl flex items-center gap-2 hover:bg-amber-500 transition-all shadow-lg shadow-white/5"
                    >
                        <Plus className="w-5 h-5" /> Generate New Code
                    </button>
                </header>

                {/* Global Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                        <p className="text-white/40 text-sm mb-1 uppercase font-bold tracking-wider">Total Revenue</p>
                        <h2 className="text-3xl font-bold">$12,450</h2>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                        <p className="text-white/40 text-sm mb-1 uppercase font-bold tracking-wider">Active Copies</p>
                        <h2 className="text-3xl font-bold text-amber-500">84 <span className="text-xs text-white/20">/ 100</span></h2>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
                        <p className="text-white/40 text-sm mb-1 uppercase font-bold tracking-wider">Success Rate</p>
                        <h2 className="text-3xl font-bold text-green-500">99.8%</h2>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/10 border border-amber-500/30">
                        <p className="text-white/40 text-sm mb-1 uppercase font-bold tracking-wider">Master Ping</p>
                        <div className="flex items-center gap-2 text-xl font-bold">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
                            14ms
                        </div>
                    </div>
                </div>

                {/* Access Codes Table */}
                <section className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                        <h3 className="font-bold flex items-center gap-2">
                            <Filter className="w-4 h-4" /> License Management
                        </h3>
                        <div className="flex gap-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                                <input
                                    type="text"
                                    placeholder="Search codes..."
                                    className="bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-amber-500/30 transition-all"
                                />
                            </div>
                            <button className="p-2 border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-widest">
                                    <th className="px-8 py-5">Access Code</th>
                                    <th className="px-8 py-5">Plan Detail</th>
                                    <th className="px-8 py-5">Assigned User</th>
                                    <th className="px-8 py-5">Status</th>
                                    <th className="px-8 py-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {codes.map((code, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-all group">
                                        <td className="px-8 py-5">
                                            <code className="text-amber-500 font-bold font-mono px-2 py-1 bg-amber-500/10 rounded border border-amber-500/20">{code.code}</code>
                                        </td>
                                        <td className="px-8 py-5 font-medium">{code.plan}</td>
                                        <td className="px-8 py-5 text-white/60">{code.user}</td>
                                        <td className="px-8 py-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${code.status === 'Active'
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                    : code.status === 'Unused'
                                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                        : 'bg-white/5 text-white/20 border-white/10'
                                                }`}>
                                                {code.status === 'Active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {code.status}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button className="p-2 text-white/20 hover:text-white transition-all opacity-0 group-hover:opacity-100">
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </div>
    );
}
