import React from 'react';
import { motion } from 'framer-motion';
import {
    Copy,
    ExternalLink,
    Sparkles,
    XCircle,
    User,
    Clock,
    CheckCircle2
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Session {
    id: string;
    title: string;
    candidate_name: string;
    candidate: string;
    status: string;
    created_at: string;
    recording_url?: string;
    ai_summary?: string;
    hire_recommendation?: string;
    score_algorithms?: number;
    score_code_quality?: number;
    score_communication?: number;
    score_system_design?: number;
}

interface SessionCardProps {
    session: Session;
    onStatusUpdate?: () => void;
    onViewSummary?: (summary: string, title: string) => void;
    onViewRadar?: (session: Session) => void;
}

export default function SessionCard({ session, onStatusUpdate, onViewSummary, onViewRadar }: SessionCardProps) {
    const isCompleted = session.status === 'completed';
    const isScheduled = session.status === 'scheduled';

    const copyLink = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(`${window.location.origin}/interview/${session.id}`);
    };

    const handleCardClick = () => {
        if (isCompleted && onViewRadar) {
            onViewRadar(session);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleCardClick}
            className={`group relative p-10 rounded-[32px] bg-white border border-slate-100 transition-all shadow-sm hover:shadow-xl ${isCompleted && onViewRadar ? 'cursor-pointer hover:border-black' : ''}`}
        >
            <div className="flex flex-col lg:flex-row gap-10 relative z-10">
                {/* Visual Status Indicator */}
                <div className="flex flex-col items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border transition-all ${isCompleted
                        ? 'bg-emerald-50 border-emerald-100 text-emerald'
                        : 'bg-black text-white border-black'
                        }`}>
                        {isCompleted ? <CheckCircle2 size={32} /> : <Clock size={32} />}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`text-[9px] font-black uppercase tracking-[0.3em] px-3 py-1 rounded-full border ${isCompleted
                                    ? 'bg-emerald-50 text-emerald border-emerald-100'
                                    : 'bg-black text-white border-black'
                                    }`}>
                                    {session.status}
                                </span>
                                {session.hire_recommendation && (
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-[0.2em] border uppercase ${session.hire_recommendation.includes('NO_HIRE')
                                        ? 'bg-rose-50 text-rose border-rose-100'
                                        : 'bg-emerald-50 text-emerald border-emerald-100'
                                        }`}>
                                        {session.hire_recommendation.replace('_', ' ')}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-3xl font-black font-space tracking-tighter text-black transition-colors">
                                {session.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-6 mt-4">
                                <span className="flex items-center gap-2 text-slate-500 font-black text-xs uppercase tracking-widest">
                                    <User size={16} className="text-black" />
                                    {session.candidate_name || 'Anonymous Candidate'}
                                </span>
                                <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">
                                    ID: {session.id.slice(0, 8)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {session.ai_summary && onViewSummary && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onViewSummary(session.ai_summary || '', session.title);
                            }}
                            className="mt-8 px-8 py-3 bg-white hover:bg-black hover:text-white text-black font-black text-[10px] uppercase tracking-[0.2em] rounded-xl border border-black transition-all flex items-center gap-3 group/btn"
                        >
                            <Sparkles size={16} className="group-hover/btn:scale-110 transition-transform" />
                            Intelligence Data
                        </button>
                    )}
                </div>

                {/* Actions Section */}
                <div className="flex flex-col gap-3 min-w-[180px] justify-center pt-6 lg:pt-0">
                    {!isCompleted && (
                        <button
                            onClick={copyLink}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-50 text-black font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                        >
                            <Copy size={16} /> Copy Access
                        </button>
                    )}

                    {session.recording_url && (
                        <a
                            href={session.recording_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-slate-50 text-black font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
                        >
                            <ExternalLink size={16} /> Playback
                        </a>
                    )}

                    {!isCompleted && (
                        <Link
                            to={`/interview/${session.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-[0.2em] hover:scale-[1.02] transition-all shadow-xl shadow-black/10"
                        >
                            Start Interview <ExternalLink size={16} />
                        </Link>
                    )}

                    {isScheduled && onStatusUpdate && (
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm('Cancel interview setup?')) {
                                    try {
                                        const token = localStorage.getItem('talentcurate_token');
                                        await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/sessions/${session.id}`, {
                                            method: 'DELETE',
                                            headers: { 'Authorization': `Bearer ${token}` }
                                        });
                                        onStatusUpdate();
                                    } catch (err) { alert('Cancellation failed'); }
                                }
                            }}
                            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white text-rose font-black text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-all border border-rose-100"
                        >
                            <XCircle size={16} /> Cancel
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
