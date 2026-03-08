import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Calendar,
    Clock,
    User,
    Users,
    CheckCircle2,
    Sparkles,
    BookOpen,
    Share2,
    ChevronRight,
    FileText,
    Target,
    Zap,
    Eye,
    Info,
    X,
    MessageSquare,
    Gamepad2
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface Template {
    id: string;
    title: string;
    description: string;
    question_ids: string[];
    owner_id?: string;
    owner_name?: string;
    is_shared: boolean;
}

interface Question {
    id: string;
    title: string;
    description: string;
    default_language: string;
}

interface PrepDetails {
    session_id: string;
    title: string;
    candidate_name: string;
    scheduled_for: string | null;
    duration_minutes: number;
    interview_type: string;
    suggested_template_id: string | null;
    current_template_id: string;
    prep_status: string;
    interviewers: Array<{
        user_id: string;
        name: string;
        email: string;
        role: string;
        prep_status: string;
        template_id?: string;
    }>;
}

const TYPE_CONFIG: Record<string, { label: string; dot: string; border: string; icon: any }> = {
    technical: { label: 'TECHNICAL', dot: 'bg-black', border: 'border-black', icon: Target },
    behavioral: { label: 'BEHAVIORAL', dot: 'bg-slate-400', border: 'border-slate-200', icon: MessageSquare },
    system_design: { label: 'ARCHITECTURE', dot: 'bg-slate-600', border: 'border-slate-300', icon: Zap },
    hr_screen: { label: 'SCREENING', dot: 'bg-slate-300', border: 'border-slate-100', icon: User },
};

export default function PrepPage() {
    const { session_id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem('talentcurate_token');

    const [prepDetails, setPrepDetails] = useState<PrepDetails | null>(null);
    const [myTemplates, setMyTemplates] = useState<Template[]>([]);
    const [sharedTemplates, setSharedTemplates] = useState<Template[]>([]);
    const [allQuestions, setAllQuestions] = useState<Question[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [userId, setUserId] = useState<string>('');

    useEffect(() => {
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                setUserId(payload.user_id || payload.sub || '');
            } catch { }
        }
    }, [token]);

    useEffect(() => {
        if (!session_id || !userId) return;
        fetch(`${API}/calendar/prep/${session_id}?user_id=${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => {
                setPrepDetails(data);
                if (data.current_template_id) {
                    setSelectedTemplateId(data.current_template_id);
                } else if (data.suggested_template_id) {
                    setSelectedTemplateId(data.suggested_template_id);
                }
                if (data.prep_status === 'ready') setConfirmed(true);
            })
            .catch(console.error);
    }, [session_id, userId, token]);

    useEffect(() => {
        if (!userId) return;
        fetch(`${API}/templates?owner_id=${userId}&include_shared=false`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => setMyTemplates(data || []))
            .catch(console.error);

        fetch(`${API}/templates?owner_id=${userId}&include_shared=true`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => {
                setSharedTemplates((data || []).filter((t: Template) =>
                    t.is_shared || !t.owner_id || t.owner_id !== userId
                ));
            })
            .catch(console.error);
    }, [userId, token]);

    useEffect(() => {
        fetch(`${API}/questions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(r => r.json())
            .then(data => setAllQuestions(data || []))
            .catch(console.error);
    }, [token]);

    const templateQuestions = useMemo(() => {
        if (!previewTemplate) return [];
        return previewTemplate.question_ids
            .map(qid => allQuestions.find(q => q.id === qid))
            .filter(Boolean) as Question[];
    }, [previewTemplate, allQuestions]);

    const handleConfirmPrep = async () => {
        setIsConfirming(true);
        try {
            await fetch(`${API}/calendar/prep/${session_id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: userId,
                    template_id: selectedTemplateId,
                })
            });
            setConfirmed(true);
        } catch (err) {
            alert('Failed to confirm prep');
        } finally {
            setIsConfirming(false);
        }
    };

    if (!prepDetails) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    const config = TYPE_CONFIG[prepDetails.interview_type] || TYPE_CONFIG.technical;

    return (
        <DashboardLayout>
            <div className="max-w-[1600px] mx-auto space-y-16">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">
                            <BookOpen size={16} /> Interview Prep Plan
                        </div>
                        <h1 className="text-6xl font-black font-space tracking-tighter text-black">Interview Setup</h1>
                        <p className="text-slate-500 font-medium max-w-2xl text-sm leading-relaxed">Design your interview structure. Select relevant question templates and coordinate with your interview panel before starting the session.</p>
                    </div>

                    {confirmed && (
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-black text-white px-8 py-4 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-3 shadow-xl shadow-black/20"
                        >
                            <CheckCircle2 size={18} /> SETUP COMPLETE
                        </motion.div>
                    )}
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-12">
                        {/* Session Analysis Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[48px] border border-slate-100 p-12 overflow-hidden relative shadow-2xl shadow-slate-200/50"
                        >
                            <div className="absolute top-0 right-0 p-12 opacity-5"><config.icon size={160} className="text-black" /></div>

                            <div className="flex flex-wrap items-start justify-between gap-8 relative z-10 mb-12">
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${config.border} text-black`}>
                                            {config.label} TRACK
                                        </span>
                                    </div>
                                    <h2 className="text-5xl font-black font-space tracking-tighter mb-6 text-black">{prepDetails.title}</h2>
                                    <div className="flex flex-wrap items-center gap-10 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                                        <div className="flex items-center gap-2"><User size={16} className="text-black" /> {prepDetails.candidate_name || 'ANONYMOUS'}</div>
                                        {prepDetails.scheduled_for && <div className="flex items-center gap-2"><Calendar size={16} className="text-black" /> {new Date(prepDetails.scheduled_for).toLocaleDateString()}</div>}
                                        <div className="flex items-center gap-2"><Clock size={16} className="text-black" /> {prepDetails.duration_minutes}M SLOT</div>
                                    </div>
                                </div>

                                <div className="flex -space-x-5">
                                    {prepDetails.interviewers.map((iv, i) => (
                                        <div key={iv.user_id} className={`w-14 h-14 rounded-2xl border-4 border-white flex items-center justify-center text-[11px] font-black uppercase shadow-2xl transition-all hover:scale-110 hover:z-20 cursor-help ${iv.prep_status === 'ready' ? 'bg-black text-white' : 'bg-slate-50 text-slate-300'
                                            }`} title={`${iv.name} - ${iv.prep_status.toUpperCase()}`}>
                                            {iv.name.charAt(0)}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {prepDetails.suggested_template_id && (
                                <div className="p-6 bg-slate-50 border border-slate-100 rounded-[24px] flex items-center gap-5 relative z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-white shadow-xl shadow-black/10"><Sparkles size={20} /></div>
                                    <p className="text-[10px] font-black text-black uppercase tracking-[0.2em]">AI Intelligence detected optimal template for this track.</p>
                                </div>
                            )}
                        </motion.div>

                        {/* Template Marketplace */}
                        <div className="space-y-8">
                            <div className="flex items-center justify-between px-6">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                    <Gamepad2 size={16} /> Interview Templates
                                </h3>
                                <div className="text-[10px] font-black text-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">{myTemplates.length + sharedTemplates.length} AVAILABLE</div>
                            </div>

                            <div className="grid gap-6">
                                {myTemplates.map(t => (
                                    <TemplateItem
                                        key={t.id}
                                        template={t}
                                        isSelected={selectedTemplateId === t.id}
                                        isSuggested={prepDetails?.suggested_template_id === t.id}
                                        onSelect={() => setSelectedTemplateId(t.id)}
                                        onPreview={() => setPreviewTemplate(t)}
                                        isShared={false}
                                    />
                                ))}
                                {sharedTemplates.map(t => (
                                    <TemplateItem
                                        key={t.id}
                                        template={t}
                                        isSelected={selectedTemplateId === t.id}
                                        isSuggested={prepDetails?.suggested_template_id === t.id}
                                        onSelect={() => setSelectedTemplateId(t.id)}
                                        onPreview={() => setPreviewTemplate(t)}
                                        isShared={true}
                                    />
                                ))}
                                <button
                                    onClick={() => { setSelectedTemplateId(''); setPreviewTemplate(null); }}
                                    className={`w-full p-8 rounded-[40px] border-2 transition-all flex items-center justify-between group ${!selectedTemplateId
                                        ? 'bg-black border-black shadow-2xl shadow-black/20'
                                        : 'bg-white border-slate-100 hover:border-black shadow-sm'
                                        }`}
                                >
                                    <div className="text-left flex items-center gap-8">
                                        <div className={`w-16 h-16 rounded-[20px] border flex items-center justify-center transition-all ${!selectedTemplateId ? 'bg-white text-black border-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-300 group-hover:bg-black group-hover:text-white group-hover:border-black'
                                            }`}>
                                            <X size={28} />
                                        </div>
                                        <div>
                                            <h4 className={`font-black text-xl tracking-tight uppercase ${!selectedTemplateId ? 'text-white' : 'text-black'}`}>Standard Interview</h4>
                                            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${!selectedTemplateId ? 'text-white/50' : 'text-slate-400'}`}>No Template · Add questions manually during the interview</p>
                                        </div>
                                    </div>
                                    {!selectedTemplateId && <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-2xl"><CheckCircle2 size={20} /></div>}
                                </button>
                            </div>
                        </div>

                        {/* Confirmation Command */}
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-10">
                            <button
                                onClick={handleConfirmPrep}
                                disabled={isConfirming || confirmed}
                                className={`w-full h-20 rounded-[32px] font-black text-[11px] uppercase tracking-[0.4em] transition-all flex items-center justify-center gap-5 ${confirmed
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200'
                                    : 'bg-black hover:scale-[1.02] text-white shadow-2xl shadow-black/30'
                                    } disabled:opacity-50`}
                            >
                                {confirmed ? 'PLANNING COMPLETE' : isConfirming ? 'SAVING PLAN...' : 'FINALIZE INTERVIEW PLAN'}
                                {!confirmed && !isConfirming && <ChevronRight size={20} />}
                            </button>
                        </motion.div>
                    </div>

                    {/* Question Logic Sidebar */}
                    <div className="lg:col-span-4">
                        <div className="sticky top-12 space-y-8">
                            <div className="px-6">
                                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] flex items-center gap-3">
                                    <FileText size={16} /> DATA PREVIEW
                                </h3>
                            </div>

                            <motion.div
                                className="bg-white rounded-[40px] border border-slate-100 p-10 min-h-[600px] shadow-2xl shadow-slate-200/50 relative overflow-hidden"
                                layout
                            >
                                <AnimatePresence mode="wait">
                                    {previewTemplate ? (
                                        <motion.div
                                            key={previewTemplate.id}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.98 }}
                                            className="space-y-10"
                                        >
                                            <div className="pb-8 border-b border-slate-50">
                                                <h4 className="text-2xl font-black font-space tracking-tighter mb-4 uppercase text-black">{previewTemplate.title}</h4>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">{previewTemplate.description || 'Core evaluation framework and architectural hooks.'}</p>
                                            </div>

                                            <div className="space-y-6">
                                                {templateQuestions.map((q, i) => (
                                                    <div key={q.id} className="p-6 bg-slate-50/50 border border-slate-100 rounded-[28px] group/q hover:border-black hover:bg-white transition-all">
                                                        <div className="flex items-center gap-3 text-[9px] font-black text-black uppercase tracking-[0.3em] mb-3 opacity-30 group-hover/q:opacity-100 transition-opacity">
                                                            MODULE {i + 1}
                                                        </div>
                                                        <div className="text-sm font-black tracking-tight mb-2 text-black">{q.title}</div>
                                                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest line-clamp-2 leading-relaxed">{q.description}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center py-32 opacity-20 px-12">
                                            <div className="w-20 h-20 rounded-[24px] bg-slate-50 border border-slate-100 flex items-center justify-center mb-8">
                                                <Sparkles size={48} className="text-black" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] leading-loose">SELECT A TEMPLATE TO PREVIEW THE INTERVIEW STRUCTURE.</p>
                                        </div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function TemplateItem({ template, isSelected, isSuggested, onSelect, onPreview, isShared }: any) {
    return (
        <button
            onClick={onSelect}
            className={`w-full text-left p-8 rounded-[40px] border-2 transition-all flex items-center justify-between group/item ${isSelected
                ? 'bg-black border-black shadow-2xl shadow-black/20'
                : 'bg-white border-slate-100 hover:border-black shadow-sm'
                }`}
        >
            <div className="flex items-center gap-8 flex-1 min-w-0">
                <div className={`w-16 h-16 rounded-[20px] border flex items-center justify-center transition-all ${isSelected ? 'bg-white text-black border-white shadow-xl' : 'bg-slate-50 border-slate-100 text-slate-300 group-hover:bg-black group-hover:text-white group-hover:border-black'
                    }`}>
                    {isShared ? <Share2 size={28} /> : <BookOpen size={28} />}
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-4 mb-2">
                        <h4 className={`font-black text-xl tracking-tighter truncate uppercase leading-none ${isSelected ? 'text-white' : 'text-black'}`}>{template.title}</h4>
                        {isSuggested && <span className="text-[8px] font-black bg-white/10 text-white border border-white/20 px-3 py-1 rounded-full uppercase tracking-widest whitespace-nowrap">RECOMMENDED</span>}
                    </div>
                    <p className={`text-[10px] font-black uppercase tracking-[0.2em] truncate ${isSelected ? 'text-white/50' : 'text-slate-400'}`}>{template.question_ids?.length || 0} QUESTIONS · {isShared ? 'SHARED' : 'PRIVATE'}</p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <button
                    onClick={(e) => { e.stopPropagation(); onPreview(); }}
                    className={`p-4 rounded-[18px] transition-all border ${isSelected ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-black hover:border-black hover:bg-white'}`}
                >
                    <Eye size={20} />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-white text-black shadow-2xl' : 'bg-slate-50 text-transparent border border-slate-100'
                    }`}>
                    <CheckCircle2 size={20} />
                </div>
            </div>
        </button>
    );
}
