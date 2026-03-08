import React from 'react';
import { motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer
} from 'recharts';

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

interface EvaluationRadarModalProps {
    session: Session;
    onClose: () => void;
}

export default function EvaluationRadarModal({ session, onClose }: EvaluationRadarModalProps) {
    const radarData = [
        { subject: 'ALGO', A: session.score_algorithms || 0, fullMark: 5 },
        { subject: 'CODE', A: session.score_code_quality || 0, fullMark: 5 },
        { subject: 'COMM', A: session.score_communication || 0, fullMark: 5 },
        { subject: 'SYSD', A: session.score_system_design || 0, fullMark: 5 },
    ];

    const avgScore = (radarData.reduce((sum, item) => sum + item.A, 0) / radarData.length).toFixed(1);
    const recommendation = session.hire_recommendation || 'PENDING';
    const isNoHire = recommendation.includes('NO_HIRE');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-white/90 backdrop-blur-xl"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl bg-white rounded-[32px] border border-slate-100 p-6 sm:p-8 lg:p-10 shadow-2xl max-h-[92vh] overflow-y-auto"
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 p-3 bg-slate-50 text-slate-400 hover:text-black rounded-full transition-colors hover:bg-slate-100"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="mb-8 sm:mb-10 pr-12 sm:pr-14">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-[0.2em] border uppercase ${isNoHire
                            ? 'bg-rose-50 text-rose border-rose-100'
                            : 'bg-emerald-50 text-emerald border-emerald-100'
                            }`}>
                            {recommendation.replace(/_/g, ' ')}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] uppercase tracking-widest">
                            ID: {session.id.slice(0, 8)}
                        </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black font-space tracking-tighter text-black mb-2 break-words leading-tight">
                        {session.title}
                    </h2>
                    <p className="text-slate-500 font-black text-[11px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] break-words">
                        {session.candidate_name || 'Anonymous Candidate'}
                    </p>
                </div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-10">
                    {/* Radar Chart */}
                    <div className="flex flex-col items-center justify-center p-5 sm:p-6 lg:p-8 rounded-[24px] bg-slate-50 border border-slate-100">
                        <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 sm:mb-8 w-full">Evaluation Radar</h3>
                        <div className="w-full h-[240px] sm:h-[280px] lg:h-[320px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis
                                        dataKey="subject"
                                        tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900, letterSpacing: '0.1em' }}
                                    />
                                    <PolarRadiusAxis domain={[0, 5]} tick={false} axisLine={false} />
                                    <Radar
                                        name="Score"
                                        dataKey="A"
                                        stroke="#000000"
                                        strokeWidth={3}
                                        fill="#000000"
                                        fillOpacity={0.1}
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Details Panel */}
                    <div className="flex flex-col gap-6 sm:gap-8">
                        {/* Score Details */}
                        <div className="space-y-6">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Performance Scores</p>
                                <div className="space-y-3">
                                    {radarData.map((item) => (
                                        <div key={item.subject} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-xs font-black uppercase tracking-widest text-slate-600">
                                                {item.subject === 'ALGO' && 'Algorithms'}
                                                {item.subject === 'CODE' && 'Code Quality'}
                                                {item.subject === 'COMM' && 'Communication'}
                                                {item.subject === 'SYSD' && 'System Design'}
                                            </span>
                                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                                <div className="flex-1 sm:flex-none sm:w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                                                    <motion.div
                                                        initial={{ width: 0 }}
                                                        animate={{ width: `${(item.A / item.fullMark) * 100}%` }}
                                                        transition={{ duration: 0.6, ease: 'easeOut' }}
                                                        className="h-full bg-black rounded-full"
                                                    />
                                                </div>
                                                <span className="font-black text-xs min-w-[44px] text-right">
                                                    {item.A.toFixed(1)}/5
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Average Score */}
                            <div className="p-5 sm:p-6 bg-black text-white rounded-[24px] border border-black/20">
                                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/60 mb-2">Average Score</p>
                                <h4 className="text-4xl sm:text-5xl font-black font-space tracking-tighter">{avgScore}</h4>
                                <p className="text-xs font-bold uppercase tracking-widest text-white/60 mt-2">Out of 5.0</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="pt-6 border-t border-slate-100">
                            {session.recording_url && (
                                <a
                                    href={session.recording_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-black text-white font-black text-[10px] uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-black/10"
                                >
                                    <ExternalLink size={16} /> Watch Recording
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                {/* Session Info */}
                <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-100">
                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Session Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Status</p>
                            <p className="font-black text-sm text-black capitalize">{session.status}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Session ID</p>
                            <p className="font-mono text-xs font-black text-black">{session.id.slice(0, 8)}</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Completed</p>
                            <p className="font-black text-sm text-black">
                                {new Date(session.created_at).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Recommendation</p>
                            <p className={`font-black text-sm capitalize ${session.hire_recommendation?.includes('HIRE') ? 'text-emerald' : 'text-rose'}`}>
                                {session.hire_recommendation?.replace(/_/g, ' ') || 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
