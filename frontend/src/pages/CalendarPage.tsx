import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    Users,
    Video,
    ExternalLink,
    BookOpen,
    Sparkles,
    CalendarDays,
    Info,
    X,
    LayoutGrid,
    LayoutList,
    User,
    ChevronDown
} from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

interface CalendarEvent {
    session_id: string;
    title: string;
    candidate_email: string;
    candidate_name: string;
    status: string;
    scheduled_for: string | null;
    duration_minutes: number;
    interview_type: string;
    interviewers: { user_id: string; name: string; email: string; role: string }[];
    created_at: string;
}

type ViewMode = 'month' | 'week' | 'day';

const TYPE_CONFIG: Record<string, { label: string; dot: string; border: string }> = {
    technical: { label: 'TECHNICAL', dot: 'bg-black', border: 'border-black' },
    behavioral: { label: 'BEHAVIORAL', dot: 'bg-slate-400', border: 'border-slate-200' },
    system_design: { label: 'ARCHITECTURE', dot: 'bg-slate-600', border: 'border-slate-300' },
    hr_screen: { label: 'SCREENING', dot: 'bg-slate-300', border: 'border-slate-100' },
};

const STATUS_CONFIG: Record<string, string> = {
    scheduled: 'bg-black text-white border-black',
    live: 'bg-emerald-50 text-emerald border-emerald-100 animate-pulse',
    completed: 'bg-slate-50 text-slate-400 border-slate-100',
    canceled: 'bg-rose-50 text-rose border-rose-100',
};

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

export default function CalendarPage() {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [loading, setLoading] = useState(true);

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('talentcurate_token');
            const start = new Date(currentDate);
            const end = new Date(currentDate);

            if (viewMode === 'month') {
                start.setDate(1);
                start.setDate(start.getDate() - start.getDay());
                end.setMonth(end.getMonth() + 1, 0);
                end.setDate(end.getDate() + (6 - end.getDay()));
            } else if (viewMode === 'week') {
                start.setDate(start.getDate() - start.getDay());
                end.setDate(start.getDate() + 6);
            }

            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0] + 'T23:59:59Z';

            const res = await fetch(`${apiBase}/calendar/events?start=${startStr}&end=${endStr}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setEvents(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch calendar events:', err);
        }
        setLoading(false);
    };

    useEffect(() => { fetchEvents(); }, [currentDate, viewMode]);

    const navigate = (direction: number) => {
        const d = new Date(currentDate);
        if (viewMode === 'month') d.setMonth(d.getMonth() + direction);
        else if (viewMode === 'week') d.setDate(d.getDate() + 7 * direction);
        else d.setDate(d.getDate() + direction);
        setCurrentDate(d);
    };

    const goToToday = () => setCurrentDate(new Date());

    const getEventDate = (ev: CalendarEvent): Date => {
        return new Date(ev.scheduled_for || ev.created_at);
    };

    const getEventTime = (ev: CalendarEvent): string => {
        const d = getEventDate(ev);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const eventsOnDate = (date: Date): CalendarEvent[] => {
        return events.filter(ev => {
            const d = getEventDate(ev);
            return d.getFullYear() === date.getFullYear() &&
                d.getMonth() === date.getMonth() &&
                d.getDate() === date.getDate();
        });
    };

    const monthGrid = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = firstDay.getDay();
        const totalDays = lastDay.getDate();

        const days: Date[] = [];
        for (let i = startOffset; i > 0; i--) days.push(new Date(year, month, 1 - i));
        for (let i = 1; i <= totalDays; i++) days.push(new Date(year, month, i));
        while (days.length % 7 !== 0) days.push(new Date(year, month + 1, days.length - startOffset - totalDays + 1));
        return days;
    }, [currentDate]);

    const weekDays = useMemo(() => {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
        });
    }, [currentDate]);

    const hours = Array.from({ length: 14 }, (_, i) => i + 7);

    const headerTitle = () => {
        if (viewMode === 'month') return `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
        if (viewMode === 'week') {
            const start = weekDays[0];
            const end = weekDays[6];
            return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`;
        }
        return currentDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).toUpperCase();
    };

    const isToday = (d: Date) => {
        const t = new Date();
        return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
    };

    return (
        <DashboardLayout>
            <div className="max-w-[1600px] mx-auto space-y-16">
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">
                            <CalendarIcon size={16} /> Interview Coordination
                        </div>
                        <h1 className="text-6xl font-black font-space tracking-tighter text-black">The Calendar</h1>
                        <p className="text-slate-500 font-medium max-w-2xl text-sm leading-relaxed">Centralized interview pipeline. Coordinate evaluation windows, team capacity, and interview schedules.</p>
                    </div>

                    <div className="flex items-center gap-2 p-1 bg-slate-100 border border-slate-200 rounded-2xl w-fit">
                        {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-8 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === mode
                                    ? 'bg-black text-white shadow-xl shadow-black/10'
                                    : 'text-slate-400 hover:text-black hover:bg-white'
                                    }`}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </header>

                <div className="bg-white rounded-[48px] border border-slate-100 overflow-hidden shadow-2xl shadow-slate-200/50">
                    {/* Calendar Control Bar */}
                    <div className="p-10 border-b border-slate-50 flex flex-col xl:flex-row xl:items-center justify-between gap-8 bg-slate-50/30">
                        <div className="flex flex-wrap items-center gap-8">
                            <button onClick={goToToday} className="px-8 py-4 bg-black text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-black/10">Today</button>
                            <div className="flex items-center gap-6">
                                <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 hover:border-black rounded-full transition-all"><ChevronLeft size={24} /></button>
                                <h2 className="text-2xl font-black font-space tracking-tighter min-w-[300px] text-center text-black">{headerTitle()}</h2>
                                <button onClick={() => navigate(1)} className="p-3 bg-white border border-slate-100 hover:border-black rounded-full transition-all"><ChevronRight size={24} /></button>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                                <div key={type} className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-100">
                                    <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">{config.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {loading ? (
                        <div className="h-[700px] flex items-center justify-center bg-white">
                            <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <div className="bg-white">
                            {viewMode === 'month' && (
                                <div className="grid grid-cols-7 border-collapse">
                                    {DAYS.map(day => (
                                        <div key={day} className="px-6 py-5 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] border-r border-b border-slate-50 last:border-r-0">
                                            {day}
                                        </div>
                                    ))}
                                    {monthGrid.map((date, i) => {
                                        const dayEvents = eventsOnDate(date);
                                        const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                                        return (
                                            <div
                                                key={i}
                                                className={`min-h-[160px] p-4 border-r border-b border-slate-50 hover:bg-slate-50/50 transition-all group relative last:border-r-0 cursor-pointer ${!isCurrentMonth ? 'opacity-20' : ''}`}
                                                onClick={() => { setCurrentDate(date); setViewMode('day'); }}
                                            >
                                                <div className="flex justify-between items-start mb-4">
                                                    <span className={`flex items-center justify-center w-10 min-w-[40px] h-10 text-sm font-black rounded-full transition-all ${isToday(date) ? 'bg-black text-white shadow-xl shadow-black/20' : 'text-slate-400'}`}>
                                                        {date.getDate()}
                                                    </span>
                                                    {dayEvents.length > 0 && <div className="w-2 h-2 rounded-full bg-black shadow-lg" />}
                                                </div>
                                                <div className="space-y-1.5 pb-2">
                                                    {dayEvents.slice(0, 3).map(ev => (
                                                        <div
                                                            key={ev.session_id}
                                                            onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                                                            className={`px-3 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest truncate cursor-pointer border border-transparent hover:border-black hover:bg-white transition-all ${TYPE_CONFIG[ev.interview_type]?.border} ${TYPE_CONFIG[ev.interview_type]?.dot.replace('bg-', 'text-')}`}
                                                        >
                                                            {ev.title}
                                                        </div>
                                                    ))}
                                                    {dayEvents.length > 3 && (
                                                        <div className="text-[8px] font-black text-slate-300 uppercase tracking-widest px-3 mt-1">+{dayEvents.length - 3} MORE</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {viewMode === 'week' && (
                                <div className="overflow-y-auto max-h-[800px] border-collapse relative">
                                    <div className="grid grid-cols-[120px_repeat(7,1fr)] border-b border-slate-100 sticky top-0 bg-white/90 backdrop-blur-xl z-10">
                                        <div className="p-6 border-r border-slate-50" />
                                        {weekDays.map((day, i) => (
                                            <div key={i} className={`p-6 text-center border-r border-slate-50 last:border-r-0 transition-all ${isToday(day) ? 'bg-slate-50/50' : ''}`}>
                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{DAYS[day.getDay()]}</div>
                                                <div className={`text-4xl font-black mt-2 tracking-tighter ${isToday(day) ? 'text-black' : 'text-slate-300'}`}>{day.getDate()}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {hours.map(hour => (
                                        <div key={hour} className="grid grid-cols-[120px_repeat(7,1fr)] min-h-[100px] border-b border-slate-50 last:border-b-0 group">
                                            <div className="p-6 text-[9px] font-black text-slate-300 text-right pr-10 pt-4 border-r border-slate-50 bg-slate-50/30">
                                                {hour.toString().padStart(2, '0')}:00
                                            </div>
                                            {weekDays.map((day, di) => {
                                                const dayEvs = eventsOnDate(day).filter(ev => getEventDate(ev).getHours() === hour);
                                                return (
                                                    <div key={di} className="border-r border-slate-50 last:border-r-0 p-2 space-y-2 group-hover:bg-slate-50/20 transition-all">
                                                        {dayEvs.map(ev => (
                                                            <div
                                                                key={ev.session_id}
                                                                onClick={() => setSelectedEvent(ev)}
                                                                className="p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest border border-slate-100 bg-white shadow-sm cursor-pointer transition-all hover:border-black hover:shadow-xl hover:-translate-y-1"
                                                            >
                                                                <div className="truncate mb-2 text-black">{ev.title}</div>
                                                                <div className="flex items-center gap-2 text-slate-400">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${TYPE_CONFIG[ev.interview_type]?.dot}`} />
                                                                    <span className="truncate">{ev.candidate_name || 'ANONYMOUS'}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {viewMode === 'day' && (
                                <div className="overflow-y-auto max-h-[800px]">
                                    {hours.map(hour => {
                                        const hourEvents = eventsOnDate(currentDate).filter(ev => getEventDate(ev).getHours() === hour);
                                        return (
                                            <div key={hour} className="flex border-b border-slate-50 min-h-[120px] group last:border-b-0">
                                                <div className="w-32 shrink-0 p-8 text-[11px] font-black text-slate-300 text-right border-r border-slate-50 bg-slate-50/30">
                                                    {hour.toString().padStart(2, '0')}:00
                                                </div>
                                                <div className="flex-1 p-6 space-y-4 group-hover:bg-slate-50/30 transition-all">
                                                    {hourEvents.map(ev => (
                                                        <div
                                                            key={ev.session_id}
                                                            onClick={() => setSelectedEvent(ev)}
                                                            className="p-8 rounded-[36px] cursor-pointer border border-slate-100 bg-white transition-all shadow-sm hover:shadow-2xl hover:border-black hover:-translate-x-2 relative overflow-hidden group/card"
                                                        >
                                                            <div className="flex items-start justify-between relative z-10">
                                                                <div className="space-y-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${TYPE_CONFIG[ev.interview_type]?.border} text-black`}>
                                                                            {TYPE_CONFIG[ev.interview_type]?.label}
                                                                        </span>
                                                                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border ${STATUS_CONFIG[ev.status] || ''}`}>
                                                                            {ev.status}
                                                                        </span>
                                                                    </div>
                                                                    <h3 className="text-3xl font-black font-space tracking-tighter text-black">{ev.title}</h3>
                                                                    <div className="flex flex-wrap items-center gap-8 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                                                                        <div className="flex items-center gap-2"><User size={16} className="text-black" /> {ev.candidate_name || ev.candidate_email}</div>
                                                                        <div className="flex items-center gap-2"><Clock size={16} className="text-black" /> {ev.duration_minutes} MIN</div>
                                                                        {ev.interviewers.length > 0 && <div className="flex items-center gap-2"><Users size={16} className="text-black" /> LEAD: {ev.interviewers[0].name}</div>}
                                                                    </div>
                                                                </div>
                                                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 group-hover/card:bg-black group-hover/card:text-white transition-all">
                                                                    <ChevronRight size={32} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {hourEvents.length === 0 && (
                                                        <div className="h-full flex items-center px-6 text-[9px] font-black text-slate-200 uppercase tracking-[0.5em] opacity-0 group-hover:opacity-100 transition-opacity">Available Slot</div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Event Detail Modal */}
                <AnimatePresence>
                    {selectedEvent && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedEvent(null)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="relative w-full max-w-2xl bg-white rounded-[48px] border border-black p-12 overflow-hidden shadow-2xl"
                            >
                                <div className="flex items-center justify-between mb-12">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border border-slate-200 text-slate-400`}>
                                                {TYPE_CONFIG[selectedEvent.interview_type]?.label}
                                            </span>
                                            <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-black text-white">
                                                {selectedEvent.status}
                                            </span>
                                        </div>
                                        <h2 className="text-4xl font-black font-space tracking-tighter text-black">{selectedEvent.title}</h2>
                                    </div>
                                    <button onClick={() => setSelectedEvent(null)} className="p-4 hover:bg-slate-50 rounded-full transition-all text-black border border-transparent hover:border-slate-200"><X size={28} /></button>
                                </div>

                                <div className="space-y-10">
                                    <div className="grid grid-cols-2 gap-10">
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Evaluation Subject</p>
                                            <p className="text-lg font-black text-black">{selectedEvent.candidate_name || selectedEvent.candidate_email}</p>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Temporal Slot</p>
                                            <p className="text-lg font-black text-black">{getEventTime(selectedEvent)} • {selectedEvent.duration_minutes}M</p>
                                        </div>
                                    </div>

                                    <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Interview Panel</p>
                                        <div className="space-y-4">
                                            {selectedEvent.interviewers.map(iv => (
                                                <div key={iv.user_id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-black">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-[10px] font-black text-white shadow-lg">{iv.name.charAt(0)}</div>
                                                        <div className="text-sm font-black text-black uppercase tracking-tight">{iv.name}</div>
                                                    </div>
                                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 px-3 py-1 bg-slate-50 rounded-full">{iv.role}</span>
                                                </div>
                                            ))}
                                            {selectedEvent.interviewers.length === 0 && <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic text-center py-4">No observers assigned</p>}
                                        </div>
                                    </div>

                                    <div className="flex gap-4 pt-4">
                                        {selectedEvent.status !== 'completed' && (
                                            <>
                                                <button
                                                    onClick={() => window.location.href = `/interview/${selectedEvent.session_id}`}
                                                    className="flex-1 px-8 py-5 bg-black text-white rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-black/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-4"
                                                >
                                                    <Video size={18} /> START INTERVIEW
                                                </button>
                                                <button
                                                    onClick={() => window.location.href = `/prep/${selectedEvent.session_id}`}
                                                    className="px-8 py-5 bg-white text-black border border-black rounded-[24px] font-black text-[10px] uppercase tracking-[0.3em] hover:bg-slate-50 transition-all flex items-center justify-center gap-4"
                                                >
                                                    <BookOpen size={18} /> PREP
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(`${window.location.origin}/interview/${selectedEvent.session_id}`);
                                                alert('Sync linked');
                                            }}
                                            className="p-5 bg-slate-100 border border-slate-200 rounded-[24px] text-black hover:bg-black hover:text-white transition-all shadow-sm"
                                        >
                                            <ExternalLink size={20} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </DashboardLayout>
    );
}
