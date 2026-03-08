import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield,
    Search,
    Mail,
    User as UserIcon,
    X,
    Trash2,
    ShieldAlert,
    UserPlus,
    Lock,
    ChevronRight,
    MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '../components/DashboardLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface User {
    id: string;
    email: string;
    name: string;
    role: string;
    created_at: string;
}

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const [showAddModal, setShowAddModal] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [newName, setNewName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState('interviewer');

    const currentUser = useMemo(() => {
        const str = localStorage.getItem('talentcurate_user');
        return str ? JSON.parse(str) : null;
    }, []);

    const fetchUsers = useCallback(async (isInitial = false) => {
        if (isInitial) setIsLoading(true);
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API_BASE}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data || []);
            }
        } catch (e) {
            console.error("Failed to fetch users", e);
        } finally {
            if (isInitial) setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!currentUser || currentUser.role !== 'admin') {
            navigate('/dashboard');
            return;
        }
        fetchUsers(true);
    }, [navigate, currentUser, fetchUsers]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API_BASE}/users`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: newEmail,
                    name: newName,
                    role: newRole,
                    password: newPassword
                })
            });
            if (res.ok) {
                setShowAddModal(false);
                setNewEmail(''); setNewName(''); setNewPassword(''); setNewRole('interviewer');
                fetchUsers();
            } else {
                alert("Failed to create user (email might exist).");
            }
        } catch (e) {
            console.error("Failed to create user", e);
        }
    };

    const handleUpdateRole = async (id: string, newRoleValue: string) => {
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API_BASE}/users/${id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: newRoleValue })
            });
            if (res.ok) fetchUsers();
        } catch (e) {
            console.error(e);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!confirm('Are you sure you want to revoke access?')) return;
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API_BASE}/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) fetchUsers();
        } catch (e) {
            console.error(e);
        }
    };

    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!currentUser || currentUser.role !== 'admin') return null;

    return (
        <DashboardLayout>
            <div className="max-w-[1600px] mx-auto space-y-16">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-rose-500 font-black text-[10px] uppercase tracking-[0.4em]">
                            <ShieldAlert size={16} /> SYSTEM ADMINISTRATION
                        </div>
                        <h1 className="text-6xl font-black font-space tracking-tighter text-black">Team Management</h1>
                        <p className="text-slate-500 font-medium max-w-2xl text-sm leading-relaxed">Centralized team and access management hub. Manage organizational roles, permissions, and onboard new interviewers.</p>
                    </div>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-8 py-4 bg-black text-white font-black text-[10px] uppercase tracking-widest rounded-[20px] hover:scale-105 transition-all shadow-2xl shadow-black/20 flex items-center gap-3"
                    >
                        <UserPlus size={18} /> Add Team Member
                    </button>
                </header>

                <div className="bg-white rounded-[48px] border border-slate-100 overflow-hidden shadow-2xl shadow-slate-200/50">
                    <div className="p-10 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-slate-50/30">
                        <div className="relative w-full max-w-xl group">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" size={20} />
                            <input
                                type="text"
                                placeholder="SEARCH TEAM MEMBERS BY NAME OR EMAIL..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full h-14 bg-white border border-slate-100 rounded-[20px] pl-16 pr-6 focus:outline-none focus:border-black text-[11px] font-black uppercase tracking-widest placeholder:text-slate-300 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /> ADMIN</div>
                                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-black" /> INTERVIEWER</div>
                                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-300" /> RECRUITER</div>
                            </div>
                        </div>
                    </div>

                    <div className="p-10">
                        {isLoading ? (
                            <div className="h-96 flex items-center justify-center bg-white">
                                <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                                {filteredUsers.map(user => (
                                    <motion.div
                                        key={user.id}
                                        layout
                                        className="p-8 rounded-[40px] bg-white border border-slate-100 hover:border-black transition-all group/card shadow-sm hover:shadow-2xl relative overflow-hidden"
                                    >
                                        <div className="flex items-start justify-between mb-8 relative z-10">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-black font-black text-xl shadow-inner group-hover/card:bg-black group-hover/card:text-white transition-all">
                                                {user.name.charAt(0)}
                                            </div>
                                            <span className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-full border ${user.role === 'admin' ? 'bg-rose-500 text-white border-rose-500' :
                                                user.role === 'hr' ? 'bg-slate-100 text-slate-400 border-slate-200' :
                                                    'bg-black text-white border-black'
                                                }`}>
                                                {user.role}
                                            </span>
                                        </div>

                                        <div className="space-y-2 mb-10 relative z-10">
                                            <h3 className="font-black text-xl tracking-tighter truncate text-black uppercase">{user.name}</h3>
                                            <div className="flex items-center gap-3 text-slate-400">
                                                <Mail size={14} className="text-black" />
                                                <p className="text-[10px] font-black truncate uppercase tracking-widest">{user.email}</p>
                                            </div>
                                        </div>

                                        <div className="pt-8 border-t border-slate-50 flex gap-3 relative z-10">
                                            <div className="relative flex-1">
                                                <select
                                                    value={user.role}
                                                    onChange={e => handleUpdateRole(user.id, e.target.value)}
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase tracking-widest outline-none cursor-pointer hover:bg-white hover:border-black transition-all disabled:opacity-30 appearance-none text-center"
                                                    disabled={user.email === 'dhawalhost@gmail.com'}
                                                >
                                                    <option value="interviewer">INTERVIEWER</option>
                                                    <option value="hr">RECRUITER</option>
                                                    <option value="admin">ADMIN</option>
                                                </select>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                disabled={user.email === 'admin@talentcurate.com'}
                                                className="p-3 bg-slate-50 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-30 border border-transparent hover:border-rose-100"
                                                title="Revoke Access"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Invite Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-xl bg-white rounded-[48px] border border-black p-12 overflow-hidden shadow-2xl"
                        >
                            <div className="flex items-center justify-between mb-12">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-slate-400 font-black text-[9px] uppercase tracking-[0.4em]">
                                        <UserPlus size={16} /> TEAM ONBOARDING
                                    </div>
                                    <h2 className="text-4xl font-black font-space tracking-tighter text-black">Add Member</h2>
                                </div>
                                <button onClick={() => setShowAddModal(false)} className="p-4 hover:bg-slate-50 rounded-full transition-all text-black border border-transparent hover:border-slate-200"><X size={28} /></button>
                            </div>

                            <form onSubmit={handleCreateUser} className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-6">Full Name</label>
                                    <div className="relative group">
                                        <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" size={20} />
                                        <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="ENTER FULL NAME (E.G. JOHN DOE)..." className="w-full h-14 bg-white border border-slate-100 rounded-[20px] pl-16 pr-6 focus:outline-none focus:border-black text-[11px] font-black uppercase tracking-widest transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-6">Email Address</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" size={20} />
                                        <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="USER@ORGANIZATION.COM" className="w-full h-14 bg-white border border-slate-100 rounded-[20px] pl-16 pr-6 focus:outline-none focus:border-black text-[11px] font-black uppercase tracking-widest transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-6">Login Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" size={20} />
                                        <input required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••••••" className="w-full h-14 bg-white border border-slate-100 rounded-[20px] pl-16 pr-6 focus:outline-none focus:border-black text-[11px] font-black uppercase tracking-widest transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 ml-6">Access Role</label>
                                    <div className="relative">
                                        <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] px-8 focus:outline-none focus:border-black text-[11px] font-black uppercase tracking-widest appearance-none transition-all">
                                            <option value="interviewer">INTERVIEWER (EVALUATION ONLY)</option>
                                            <option value="hr">RECRUITER (MANAGEMENT INTERFACE)</option>
                                            <option value="admin">SYSTEM ADMIN (FULL ACCESS)</option>
                                        </select>
                                    </div>
                                </div>

                                <button type="submit" className="w-full h-16 bg-black text-white font-black rounded-[24px] shadow-2xl shadow-black/20 hover:scale-[1.02] transition-all uppercase tracking-[0.3em] text-[11px] mt-12 flex items-center justify-center gap-3">
                                    Add Team Member <ChevronRight size={18} />
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
