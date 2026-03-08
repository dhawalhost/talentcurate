import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Calendar,
    Settings as SettingsIcon,
    LogOut,
    Shield,
    Command,
    User
} from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const location = useLocation();
    const navigate = useNavigate();
    const currentUserStr = localStorage.getItem('talentcurate_user');
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Calendar, label: 'Calendar', path: '/calendar' },
        { icon: SettingsIcon, label: 'Settings', path: '/settings' },
    ];

    const handleLogout = () => {
        localStorage.removeItem('talentcurate_token');
        localStorage.removeItem('talentcurate_user');
        navigate('/login');
    };

    return (
        <div className="flex h-screen bg-background text-text-main font-sans selection:bg-black selection:text-white">
            {/* Minimalist Sidebar */}
            <aside className="w-64 bg-white border-r border-black/5 flex flex-col z-20 shadow-sm">
                <div className="p-8 flex items-center gap-4">
                    <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center transition-transform hover:scale-110 duration-500">
                        <Command className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-black">TalentCurate</h1>
                        <p className="text-[10px] text-text-dim font-black uppercase tracking-[0.3em] leading-none">Studio</p>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-8 space-y-1 ios-scroll overflow-y-auto">
                    <p className="px-5 text-[9px] font-black text-text-dim uppercase tracking-[0.3em] mb-6 opacity-40">Main Menu</p>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-4 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 group relative ${isActive
                                    ? 'bg-black text-white shadow-lg shadow-black/10'
                                    : 'text-text-muted hover:text-black hover:bg-black/5'
                                    }`}
                            >
                                <item.icon size={18} className={`${isActive ? 'text-white' : 'text-text-muted group-hover:text-black'} transition-colors duration-300`} />
                                <span className="tracking-tighter">{item.label}</span>
                            </Link>
                        );
                    })}

                    <div className="pt-8">
                        <p className="px-5 text-[9px] font-black text-text-dim uppercase tracking-[0.3em] mb-6 opacity-40">Administration</p>
                        {currentUser?.role === 'admin' && (
                            <Link
                                to="/admin"
                                className={`flex items-center gap-4 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all duration-300 group ${location.pathname === '/admin'
                                    ? 'bg-black text-white shadow-lg shadow-black/10'
                                    : 'text-text-muted hover:text-black hover:bg-black/5'
                                    }`}
                            >
                                <Shield size={18} className={location.pathname === '/admin' ? 'text-white' : ''} />
                                <span className="tracking-tighter">Admin Console</span>
                            </Link>
                        )}
                    </div>
                </nav>

                <div className="p-6 mt-auto">
                    <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-black font-black shadow-sm">
                                {currentUser?.name?.charAt(0) || 'U'}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xs font-black truncate text-black">{currentUser?.name || 'User'}</span>
                                <span className="text-[9px] text-text-dim truncate uppercase tracking-widest font-black leading-none mt-1">{currentUser?.role || 'Member'}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-center gap-2 py-2.5 text-rose font-black bg-white border border-rose/10 hover:bg-rose hover:text-white rounded-xl transition-all duration-300 text-[9px] uppercase tracking-widest"
                        >
                            <LogOut size={14} /> SIGN OUT
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative custom-scrollbar ios-scroll bg-slate-50/50">
                <div className="max-w-6xl mx-auto p-12 pb-32">
                    {children}
                </div>
            </main>
        </div>
    );
}
