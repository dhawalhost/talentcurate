import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Calendar,
    Settings as SettingsIcon,
    LogOut,
    Shield,
    Command,
    User,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('talentcurate_sidebar_collapsed') === 'true';
    });

    useEffect(() => {
        localStorage.setItem('talentcurate_sidebar_collapsed', isCollapsed.toString());
    }, [isCollapsed]);
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
        <div className="flex h-screen bg-white text-text-main font-sans selection:bg-black selection:text-white overflow-hidden">
            {/* Minimalist Premium Sidebar */}
            <aside
                className={`${isCollapsed ? 'w-24' : 'w-24 md:w-72'} bg-white/70 backdrop-blur-3xl border-r border-black/5 flex flex-col z-30 transition-all duration-500 group/sidebar overflow-hidden relative`}
            >

                <div
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`p-8 flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'} cursor-pointer group/logo transition-all duration-500`}
                >
                    <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center transition-all group-hover/logo:rotate-12 group-hover/logo:scale-110 duration-500 shadow-xl shadow-black/20 shrink-0">
                        <Command className="text-white" size={24} />
                    </div>
                    {!isCollapsed && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="hidden md:block overflow-hidden transition-all duration-500"
                        >
                            <h1 className="text-xl font-bold tracking-tight text-black flex items-center gap-1">
                                Talent<span className="text-zinc-400">Curate</span>
                            </h1>
                            <p className="text-[9px] text-text-dim font-black uppercase tracking-[0.4em] leading-none mt-1">Intelligence</p>
                        </motion.div>
                    )}
                </div>

                <nav className="flex-1 px-4 py-8 space-y-2 ios-scroll overflow-y-auto overflow-x-hidden">
                    <p className={`px-5 text-[9px] font-bold text-text-dim uppercase tracking-[0.4em] mb-4 opacity-40 ${isCollapsed ? 'hidden' : 'hidden md:block'}`}>Menu</p>
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-5'} py-4 rounded-2xl font-medium transition-all duration-300 group relative ${isActive
                                    ? 'bg-black text-white shadow-2xl shadow-black/20'
                                    : 'text-text-muted hover:text-black hover:bg-black/5'
                                    }`}
                            >
                                <item.icon size={20} className={`${isActive ? 'text-white' : 'text-text-muted group-hover:text-black'} transition-all duration-300 group-hover:scale-110 shrink-0`} />
                                {!isCollapsed && (
                                    <span className="hidden md:block transition-all duration-500 font-bold text-xs uppercase tracking-widest">{item.label}</span>
                                )}
                                {isActive && (
                                    <motion.div
                                        layoutId="active-bar"
                                        className={`absolute right-0 w-1 h-6 bg-white rounded-l-full ${isCollapsed ? 'hidden' : ''}`}
                                    />
                                )}
                            </Link>
                        );
                    })}

                    <div className="pt-8 space-y-2">
                        <p className={`px-5 text-[9px] font-bold text-text-dim uppercase tracking-[0.4em] mb-4 opacity-40 ${isCollapsed ? 'hidden' : 'hidden md:block'}`}>System</p>
                        {currentUser?.role === 'admin' && (
                            <Link
                                to="/admin"
                                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-5'} py-4 rounded-2xl font-medium transition-all duration-300 group relative ${location.pathname === '/admin'
                                    ? 'bg-emerald-600 text-white shadow-2xl shadow-emerald-500/20'
                                    : 'text-text-muted hover:text-emerald-600 hover:bg-emerald-50 transition-colors'
                                    }`}
                            >
                                <Shield size={20} className={`${location.pathname === '/admin' ? 'text-white' : 'text-text-muted group-hover:text-emerald-600'} shrink-0`} />
                                {!isCollapsed && (
                                    <span className="hidden md:block font-bold text-xs uppercase tracking-widest">Admin Console</span>
                                )}
                            </Link>
                        )}
                    </div>
                </nav>

                <div className="p-4 mt-auto">
                    <div className={`p-4 rounded-[2rem] bg-zinc-50 border border-black/5 flex flex-col items-center ${isCollapsed ? 'gap-4' : 'space-y-4'}`}>
                        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} w-full overflow-hidden`}>
                            <div className="w-10 h-10 rounded-2xl bg-white border border-black/5 flex items-center justify-center text-black font-bold shadow-sm shrink-0">
                                {currentUser?.name?.charAt(0) || 'U'}
                            </div>
                            {!isCollapsed && (
                                <div className="hidden md:flex flex-col min-w-0">
                                    <span className="text-xs font-bold truncate text-black">{currentUser?.name || 'User'}</span>
                                    <span className="text-[9px] text-text-dim truncate uppercase tracking-widest font-black leading-none mt-1">{currentUser?.role || 'Member'}</span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleLogout}
                            className={`w-full flex items-center justify-center ${isCollapsed ? 'p-3' : 'gap-2 py-3'} text-white font-bold bg-black rounded-2xl hover:bg-zinc-800 transition-all duration-300 text-[9px] uppercase tracking-widest shadow-xl shadow-black/10 active:scale-95`}
                        >
                            <LogOut size={14} className="shrink-0" />
                            {!isCollapsed && <span className="hidden md:inline">Sign Out</span>}
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 overflow-y-auto relative custom-scrollbar ios-scroll bg-white">
                <div className="max-w-7xl mx-auto p-6 md:p-12 pb-32">
                    {children}
                </div>
            </main>
        </div>
    );
}
