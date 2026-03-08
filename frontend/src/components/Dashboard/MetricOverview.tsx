import React from 'react';
import { motion } from 'framer-motion';
import { Users, Calendar, Zap, CheckCircle } from 'lucide-react';

interface MetricProps {
    totalInterviews: number;
    scheduled: number;
    completed: number;
    hireRate: number;
}

export default function MetricOverview({ totalInterviews, scheduled, completed, hireRate }: MetricProps) {
    const stats = [
        { label: 'Total Events', value: totalInterviews, icon: Users, color: 'text-black', bg: 'bg-slate-100' },
        { label: 'Scheduled', value: scheduled, icon: Calendar, color: 'text-black', bg: 'bg-slate-100' },
        { label: 'Completed', value: completed, icon: CheckCircle, color: 'text-black', bg: 'bg-slate-100' },
        { label: 'Hire Success', value: `${hireRate}%`, icon: Zap, color: 'text-black', bg: 'bg-slate-100' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {stats.map((stat, idx) => (
                <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm group hover:border-black transition-all hover:shadow-md"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className={`w-12 h-12 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center text-black shadow-inner`}>
                            <stat.icon size={24} />
                        </div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">Live</span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-4xl font-black font-space tracking-tight text-black">{stat.value}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
