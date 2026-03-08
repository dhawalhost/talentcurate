import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Save,
    Video,
    Mic,
    StopCircle,
    Box,
    CheckCircle,
    XCircle,
    ChevronRight
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export default function Settings() {
    const [settings, setSettings] = useState({
        auto_record: true,
        default_cam_on: true,
        default_mic_on: true,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const token = localStorage.getItem('talentcurate_token');
                if (!token) return;
                const res = await fetch(`${API}/user/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSettings(prev => ({
                        ...prev,
                        ...data
                    }));
                }
            } catch (err) {
                console.error("Failed to load settings", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setSaveStatus(null);
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API}/user/settings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (res.ok) {
                setSaveStatus('success');
                setTimeout(() => setSaveStatus(null), 3000);
            } else {
                setSaveStatus('error');
            }
        } catch (err) {
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleSetting = (key: keyof typeof settings) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (isLoading) {
        return (
            <div className="h-screen bg-white text-black flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl">
                <header className="mb-16">
                    <div className="flex items-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] mb-4">
                        <Box size={14} /> Preference Layer
                    </div>
                    <h1 className="text-5xl font-black font-space tracking-tighter mb-4 text-black">User Settings</h1>
                    <p className="text-slate-500 font-medium max-w-2xl text-sm leading-relaxed">Configure your default interviewing environment. These core parameters are applied to all new evaluation sessions across the platform.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-10">
                        {/* Status Messages */}
                        <AnimatePresence>
                            {saveStatus === 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="p-6 bg-emerald-50 text-emerald border border-emerald-100 rounded-[24px] font-black text-[10px] uppercase tracking-widest flex items-center gap-4"
                                >
                                    <CheckCircle size={20} /> Preferences Synced Successfully
                                </motion.div>
                            )}
                            {saveStatus === 'error' && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="p-6 bg-rose-50 text-rose border border-rose-100 rounded-[24px] font-black text-[10px] uppercase tracking-widest flex items-center gap-4"
                                >
                                    <XCircle size={20} /> Synchronization Error Detected
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <section className="space-y-6">
                            <h3 className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4 opacity-70">Hardware Hooks</h3>

                            <SettingToggle
                                icon={Video}
                                title="Automatic Camera"
                                description="Enable visual stream on session initialization"
                                active={settings.default_cam_on}
                                onToggle={() => toggleSetting('default_cam_on')}
                            />

                            <SettingToggle
                                icon={Mic}
                                title="Default Microphone"
                                description="Enable audio capture on session initialization"
                                active={settings.default_mic_on}
                                onToggle={() => toggleSetting('default_mic_on')}
                            />
                        </section>

                        <section className="space-y-6 pt-6">
                            <h3 className="px-5 text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-4 opacity-70">Data Persistence</h3>

                            <SettingToggle
                                icon={StopCircle}
                                title="Archive Management"
                                description="Automated server-side recording archival"
                                active={settings.auto_record}
                                onToggle={() => toggleSetting('auto_record')}
                            />
                        </section>
                    </div>

                    <div className="lg:col-span-4">
                        <section className="p-10 rounded-[40px] bg-slate-50 border border-slate-100 sticky top-12 shadow-sm">
                            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white mb-8 shadow-xl shadow-black/10">
                                <Save size={24} />
                            </div>
                            <h3 className="text-2xl font-black font-space tracking-tighter mb-4">Persist State</h3>
                            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-10 leading-relaxed">Saving these changes will reconfigure your global environment profile across all linked devices.</p>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-black hover:scale-[1.02] text-white rounded-[24px] font-black shadow-2xl shadow-black/20 transition-all disabled:opacity-50 uppercase tracking-[0.2em] text-[10px]"
                            >
                                {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>COMMIT CHANGES</span>}
                                {!isSaving && <ChevronRight size={16} />}
                            </button>
                        </section>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function SettingToggle({ icon: Icon, title, description, active, onToggle }: any) {
    return (
        <div className="group p-8 rounded-[32px] bg-white border border-slate-100 hover:border-black transition-all flex items-center justify-between shadow-sm hover:shadow-xl">
            <div className="flex gap-8 items-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 ${active ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-slate-50 text-slate-400 border-slate-100'
                    }`}>
                    <Icon size={24} />
                </div>
                <div>
                    <h3 className="font-black text-lg tracking-tight text-black uppercase leading-none mb-2">{title}</h3>
                    <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{description}</p>
                </div>
            </div>
            <button
                onClick={onToggle}
                className={`relative w-14 h-8 rounded-full transition-all duration-300 ${active ? 'bg-black' : 'bg-slate-100'}`}
            >
                <motion.div
                    className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
                    animate={{ x: active ? 24 : 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
            </button>
        </div>
    );
}
