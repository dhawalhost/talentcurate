import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CalendarPlus,
    Calendar,
    X,
    Clock,
    User,
    Mail,
    ChevronDown,
    LayoutDashboard,
    Zap
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';
import MetricOverview from '../components/Dashboard/MetricOverview';
import SessionCard from '../components/Dashboard/SessionCard';
import LibraryManager from '../components/Dashboard/LibraryManager';
import EvaluationRadarModal from '../components/EvaluationRadarModal';
import { createSession } from '../lib/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export default function Dashboard() {
    // Tab State
    const [activeTab, setActiveTab] = useState<'sessions' | 'library'>('sessions');
    const [sessionFilterTab, setSessionFilterTab] = useState<'upcoming' | 'completed'>('upcoming');

    // Data State
    const [allSessions, setAllSessions] = useState<any[]>([]);
    const [questions, setQuestions] = useState<any[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [allInterviewers, setAllInterviewers] = useState<any[]>([]);

    // Loading State
    const [isLoading, setIsLoading] = useState(true);

    // Modal State
    const [isScheduling, setIsScheduling] = useState(false);
    const [selectedRadarSession, setSelectedRadarSession] = useState<any>(null);

    // Schedule Form State
    const [title, setTitle] = useState('');
    const [candidateEmail, setCandidateEmail] = useState('');
    const [candidateName, setCandidateName] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [scheduledFor, setScheduledFor] = useState('');
    const [durationMinutes, setDurationMinutes] = useState(60);
    const [interviewType, setInterviewType] = useState('technical');
    const [selectedInterviewers, setSelectedInterviewers] = useState<string[]>([]);

    const fetchSessions = useCallback(async () => {
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API}/sessions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllSessions(data || []);
            }
        } catch (err) {
            console.error("Failed to load sessions", err);
        }
    }, []);

    const fetchQuestions = useCallback(async () => {
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API}/questions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setQuestions(data || []);
            }
        } catch (err) {
            console.error("Failed to load questions", err);
        }
    }, []);

    const fetchTemplates = useCallback(async () => {
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API}/templates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data || []);
            }
        } catch (err) {
            console.error("Failed to load templates", err);
        }
    }, []);

    const fetchInterviewers = useCallback(async () => {
        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${API}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setAllInterviewers((data || []).filter((u: any) => u.role !== 'candidate'));
            }
        } catch (err) {
            console.error('Failed to load interviewers:', err);
        }
    }, []);

    useEffect(() => {
        const loadAll = async () => {
            setIsLoading(true);
            await Promise.all([
                fetchSessions(),
                fetchQuestions(),
                fetchTemplates(),
                fetchInterviewers()
            ]);
            setIsLoading(false);
        };
        loadAll();
    }, [fetchSessions, fetchQuestions, fetchTemplates, fetchInterviewers]);

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await createSession(title, 'int_1', candidateEmail, candidateName, 'python3', selectedTemplate || undefined, {
                interviewer_ids: selectedInterviewers,
                scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : '',
                duration_minutes: durationMinutes,
                interview_type: interviewType,
            });
            setIsScheduling(false);
            fetchSessions();
            // Reset form
            setTitle(''); setCandidateEmail(''); setCandidateName(''); setSelectedTemplate('');
            setScheduledFor(''); setDurationMinutes(60); setInterviewType('technical'); setSelectedInterviewers([]);
        } catch (err) {
            alert('Failed to schedule session');
        }
    };

    const upcomingSessions = allSessions.filter(s => s.status !== 'completed');
    const completedSessions = allSessions.filter(s => s.status === 'completed');

    if (isLoading) {
        return (
            <div className="h-screen bg-white text-black flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-400">Loading Environment</p>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-12">
                {/* Dashboard Header */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div className="space-y-4">
                        <LayoutDashboard size={14} /> Overview
                        <h1 className="text-5xl font-black font-space tracking-tighter text-black">Dashboard</h1>
                        <p className="text-slate-500 font-medium max-w-xl text-sm leading-relaxed">System operational. Manage your interview pipeline, session templates, and technical evaluations from a unified interface.</p>
                    </div>
                </header>

                {/* Metrics Section */}
                <MetricOverview
                    totalInterviews={allSessions.length}
                    scheduled={upcomingSessions.length}
                    completed={completedSessions.length}
                    hireRate={Math.round((completedSessions.filter(s => s.hire_recommendation === 'HIRE' || s.hire_recommendation === 'STRONG_HIRE').length / (completedSessions.length || 1)) * 100)}
                />

                {/* Navigation Tabs */}
                <div className="flex gap-2 p-1 bg-slate-100/50 border border-slate-200 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('sessions')}
                        className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'sessions'
                            ? 'bg-black text-white shadow-xl shadow-black/10'
                            : 'text-slate-400 hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Interviews
                    </button>
                    <button
                        onClick={() => setActiveTab('library')}
                        className={`px-8 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all ${activeTab === 'library'
                            ? 'bg-black text-white shadow-xl shadow-black/10'
                            : 'text-slate-400 hover:text-black hover:bg-white/50'
                            }`}
                    >
                        Library
                    </button>
                </div>

                {/* View Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'sessions' ? (
                        <motion.div
                            key="sessions-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-10"
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                                <div className="flex gap-10">
                                    <button
                                        onClick={() => setSessionFilterTab('upcoming')}
                                        className={`pb-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${sessionFilterTab === 'upcoming' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        Upcoming
                                        {sessionFilterTab === 'upcoming' && <motion.div layoutId="sess-tab" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-black" />}
                                    </button>
                                    <button
                                        onClick={() => setSessionFilterTab('completed')}
                                        className={`pb-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${sessionFilterTab === 'completed' ? 'text-black' : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        Completed
                                        {sessionFilterTab === 'completed' && <motion.div layoutId="sess-tab" className="absolute -bottom-0.5 left-0 right-0 h-0.5 bg-black" />}
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsScheduling(true)}
                                    className="px-6 py-3 bg-black text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-xl hover:scale-105 transition-all shadow-2xl shadow-black/20 flex items-center gap-2"
                                >
                                    <CalendarPlus size={16} /> Schedule Interview
                                </button>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {(sessionFilterTab === 'upcoming' ? upcomingSessions : completedSessions).map(sess => (
                                    <SessionCard
                                        key={sess.id}
                                        session={sess}
                                        onStatusUpdate={fetchSessions}
                                        onViewRadar={setSelectedRadarSession}
                                    />
                                ))}
                                {(sessionFilterTab === 'upcoming' ? upcomingSessions : completedSessions).length === 0 && (
                                    <div className="col-span-full py-32 bg-white border border-slate-100 rounded-[32px] flex flex-col items-center justify-center text-center shadow-sm">
                                        <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center mb-8">
                                            <Calendar size={32} className="text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-black font-space tracking-tight mb-2">No Interviews</h3>
                                        <p className="text-slate-400 font-medium max-w-xs text-xs uppercase tracking-widest">No {sessionFilterTab} events scheduled.</p>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="library-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <LibraryManager
                                questions={questions}
                                templates={templates}
                                onEditQuestion={(q) => { }}
                                onDeleteQuestion={(id) => { }}
                                onCreateQuestion={() => { }}
                                onEditTemplate={(t) => { }}
                                onDeleteTemplate={(id) => { }}
                                onCreateTemplate={() => { }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Evaluation Radar Modal */}
                <AnimatePresence>
                    {selectedRadarSession && (
                        <EvaluationRadarModal
                            session={selectedRadarSession}
                            onClose={() => setSelectedRadarSession(null)}
                        />
                    )}
                </AnimatePresence>

                {/* Scheduling Modal */}
                <AnimatePresence>
                    {isScheduling && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsScheduling(false)}
                                className="absolute inset-0 bg-white/90 backdrop-blur-xl"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                className="relative w-full max-w-xl bg-white rounded-[32px] border border-slate-200 p-12 overflow-hidden shadow-2xl"
                            >
                                <div className="flex items-center justify-between mb-10">
                                    <div>
                                        <h2 className="text-3xl font-black font-space tracking-tighter text-black">Schedule Interview</h2>
                                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">Set up a new evaluation</p>
                                    </div>
                                    <button onClick={() => setIsScheduling(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-black rounded-full transition-colors"><X size={20} /></button>
                                </div>

                                <form onSubmit={handleSchedule} className="space-y-8">
                                    <div className="space-y-6">
                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 ml-4">Interview Details</label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="relative group">
                                                    <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="Interview Title (e.g. Senior Frontend Role)" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:border-black/20 text-xs font-black uppercase tracking-widest placeholder:text-slate-300" />
                                                </div>
                                                <div className="relative group">
                                                    <select value={interviewType} onChange={e => setInterviewType(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 appearance-none focus:outline-none focus:border-black/20 text-xs font-black uppercase tracking-widest text-slate-600">
                                                        <option value="technical">Technical Track</option>
                                                        <option value="system_design">System Design</option>
                                                        <option value="behavioral">Culture/Behavioral</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 ml-4">Candidate Identity</label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <input required value={candidateName} onChange={e => setCandidateName(e.target.value)} placeholder="Name" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:border-black/20 text-xs font-black uppercase tracking-widest placeholder:text-slate-300" />
                                                <input required type="email" value={candidateEmail} onChange={e => setCandidateEmail(e.target.value)} placeholder="Email" className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:border-black/20 text-xs font-black uppercase tracking-widest placeholder:text-slate-300" />
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 ml-4">Scheduling Parameters</label>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <input required type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:border-black/20 text-xs font-black uppercase tracking-widest text-slate-600" />
                                                <select value={selectedTemplate} onChange={e => setSelectedTemplate(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 focus:outline-none focus:border-black/20 text-xs font-black uppercase tracking-widest text-slate-600">
                                                    <option value="">No Template</option>
                                                    {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <button type="submit" className="w-full bg-black text-white font-black py-4 rounded-2xl shadow-2xl shadow-black/20 hover:scale-[1.02] transition-all uppercase tracking-[0.3em] text-[10px] mt-4 flex items-center justify-center gap-3">
                                        <Zap size={16} /> Schedule Session
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
