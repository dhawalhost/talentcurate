import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Loader2, Sparkles, ChevronRight, Lock, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export default function Login() {
    const [email, setEmail] = useState('admin@talentcurate.com');
    const [password, setPassword] = useState('password');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [step, setStep] = useState<1 | 2>(1);
    const navigate = useNavigate();

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/auth/sso/check?email=${encodeURIComponent(email)}`);
            if (!res.ok) throw new Error('Failed to verify email');

            const data = await res.json();
            if (data.sso_enabled) {
                window.location.href = `${API_BASE}/auth/sso/login?email=${encodeURIComponent(email)}`;
            } else {
                setStep(2);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
                throw new Error('Invalid email or password');
            }

            const data = await res.json();
            localStorage.setItem('talentcurate_token', data.token);
            localStorage.setItem('talentcurate_user', JSON.stringify(data.user));
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#fcfcfc] p-8 relative overflow-hidden">
            {/* Minimalist Background Pattern */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md w-full bg-white border border-black rounded-[48px] p-12 relative z-10 shadow-2xl shadow-black/5"
            >
                <div className="flex justify-center mb-12">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center shadow-2xl shadow-black/20"
                    >
                        <Code2 size={40} className="text-white" />
                    </motion.div>
                </div>

                <div className="text-center mb-12 space-y-3">
                    <h1 className="text-4xl font-black font-space tracking-tighter text-black uppercase">
                        TalentCurate
                    </h1>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">Curate the best talent with intelligent interviews</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 bg-rose-50 border border-rose-100 text-rose-500 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center"
                    >
                        {error}
                    </motion.div>
                )}

                {step === 1 ? (
                    <form onSubmit={handleEmailSubmit} className="space-y-6">
                        <div className="space-y-3">
                            <label className="block text-[9px] font-black text-slate-400 ml-6 uppercase tracking-[0.3em]">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" size={20} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] pl-16 pr-6 focus:bg-white focus:outline-none focus:border-black text-[11px] font-black uppercase tracking-widest transition-all"
                                    required
                                    placeholder="ENTER EMAIL..."
                                />
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-16 mt-10 bg-black hover:bg-black/90 disabled:bg-slate-200 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-black/20"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    CONTINUE <ChevronRight size={18} />
                                </>
                            )}
                        </motion.button>
                    </form>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="flex items-center justify-between mb-8 bg-slate-50 p-4 rounded-[20px] border border-slate-100">
                            <span className="text-[10px] font-black text-black uppercase tracking-widest truncate max-w-[180px]">{email}</span>
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="text-[9px] font-black text-slate-400 hover:text-black transition-colors uppercase tracking-widest"
                            >
                                CHANGE
                            </button>
                        </div>
                        <div className="space-y-3">
                            <label className="block text-[9px] font-black text-slate-400 ml-6 uppercase tracking-[0.3em]">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" size={20} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-[20px] pl-16 pr-6 focus:bg-white focus:outline-none focus:border-black text-[11px] font-black uppercase tracking-widest transition-all"
                                    required
                                    autoFocus
                                    placeholder="••••••••••••"
                                />
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-16 mt-10 bg-black hover:bg-black/90 disabled:bg-slate-200 text-white rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-black/20"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <Sparkles size={18} /> LOG IN
                                </>
                            )}
                        </motion.button>
                    </form>
                )}
            </motion.div>

            <p className="mt-12 text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] relative z-10">© 2026 TalentCurate</p>
        </div>
    );
}
