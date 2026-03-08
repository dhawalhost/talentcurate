import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    Plus,
    Edit2,
    Trash2,
    BookOpen,
    Layers,
    ChevronRight,
    SearchX
} from 'lucide-react';

interface Question {
    id: string;
    title: string;
    description: string;
    default_language: string;
}

interface Template {
    id: string;
    title: string;
    description: string;
    question_ids: string[];
    created_at: string;
}

interface LibraryManagerProps {
    questions: Question[];
    templates: Template[];
    onEditQuestion: (q: Question) => void;
    onDeleteQuestion: (id: string) => void;
    onCreateQuestion: () => void;
    onEditTemplate: (t: Template) => void;
    onDeleteTemplate: (id: string) => void;
    onCreateTemplate: () => void;
}

export default function LibraryManager({
    questions,
    templates,
    onEditQuestion,
    onDeleteQuestion,
    onCreateQuestion,
    onEditTemplate,
    onDeleteTemplate,
    onCreateTemplate
}: LibraryManagerProps) {
    const [activeSubTab, setActiveSubTab] = useState<'questions' | 'templates'>('questions');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredQuestions = questions.filter(q =>
        q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredTemplates = templates.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 h-12">
                <div className="flex gap-2 p-1 bg-slate-100/50 border border-slate-200 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveSubTab('questions')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${activeSubTab === 'questions'
                            ? 'bg-black text-white shadow-lg shadow-black/10'
                            : 'text-slate-400 hover:text-black hover:bg-white/50'
                            }`}
                    >
                        <BookOpen size={14} /> Questions
                    </button>
                    <button
                        onClick={() => setActiveSubTab('templates')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all ${activeSubTab === 'templates'
                            ? 'bg-black text-white shadow-lg shadow-black/10'
                            : 'text-slate-400 hover:text-black hover:bg-white/50'
                            }`}
                    >
                        <Layers size={14} /> Templates
                    </button>
                </div>

                <div className="flex items-center gap-4 flex-1 max-w-md h-full">
                    <div className="relative flex-1 group h-full">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-black transition-colors" size={16} />
                        <input
                            type="text"
                            placeholder={`Search ${activeSubTab}...`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-full bg-white border border-slate-100 rounded-2xl pl-11 pr-4 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:border-black transition-all placeholder:text-slate-300"
                        />
                    </div>
                    <button
                        onClick={activeSubTab === 'questions' ? onCreateQuestion : onCreateTemplate}
                        className="bg-black hover:scale-105 h-full aspect-square flex items-center justify-center rounded-2xl text-white shadow-xl shadow-black/10 transition-all group"
                    >
                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeSubTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                >
                    {activeSubTab === 'questions' ? (
                        filteredQuestions.length > 0 ? (
                            filteredQuestions.map((q) => (
                                <QuestionCard
                                    key={q.id}
                                    question={q}
                                    onEdit={onEditQuestion}
                                    onDelete={onDeleteQuestion}
                                />
                            ))
                        ) : <EmptyState activeSubTab="questions" />
                    ) : (
                        filteredTemplates.length > 0 ? (
                            filteredTemplates.map((t) => (
                                <TemplateCard
                                    key={t.id}
                                    template={t}
                                    questions={questions}
                                    onEdit={onEditTemplate}
                                    onDelete={onDeleteTemplate}
                                />
                            ))
                        ) : <EmptyState activeSubTab="templates" />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function QuestionCard({ question, onEdit, onDelete }: {
    question: Question,
    onEdit: (q: Question) => void,
    onDelete: (id: string) => void
}) {
    return (
        <div className="group relative p-8 rounded-[32px] bg-white border border-slate-100 hover:border-black transition-all shadow-sm hover:shadow-xl flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full bg-slate-50 text-slate-400 border border-slate-100">
                    {question.default_language}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(question)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-black rounded-xl transition-all"><Edit2 size={16} /></button>
                    <button onClick={() => onDelete(question.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose rounded-xl transition-all"><Trash2 size={16} /></button>
                </div>
            </div>
            <h3 className="text-xl font-black font-space tracking-tighter mb-4 text-black group-hover:translate-x-1 transition-transform">{question.title}</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed flex-1 line-clamp-3 mb-8">{question.description}</p>
            <div className="pt-6 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <span>EVALUATION MODULE</span>
                <ChevronRight size={14} className="group-hover:translate-x-2 transition-transform duration-300" />
            </div>
        </div>
    );
}

function TemplateCard({ template, questions, onEdit, onDelete }: {
    template: Template,
    questions: Question[],
    onEdit: (t: Template) => void,
    onDelete: (id: string) => void
}) {
    return (
        <div className="group relative p-8 rounded-[32px] bg-white border border-slate-100 hover:border-black transition-all shadow-sm hover:shadow-xl flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10">
                    <Layers size={22} />
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(template)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-black rounded-xl transition-all"><Edit2 size={16} /></button>
                    <button onClick={() => onDelete(template.id)} className="p-2.5 bg-slate-50 text-slate-400 hover:text-rose rounded-xl transition-all"><Trash2 size={16} /></button>
                </div>
            </div>
            <h3 className="text-xl font-black font-space tracking-tighter mb-4 text-black group-hover:translate-x-1 transition-transform">{template.title}</h3>
            <p className="text-slate-500 text-xs font-medium leading-relaxed flex-1 line-clamp-2 mb-6">{template.description}</p>

            <div className="flex flex-wrap gap-2 mb-8">
                {template.question_ids?.slice(0, 3).map(qid => {
                    const q = questions.find(question => question.id === qid);
                    return q ? (
                        <span key={qid} className="text-[8px] font-black px-3 py-1 bg-slate-50 rounded-full border border-slate-100 text-slate-400 uppercase tracking-widest">
                            {q.title}
                        </span>
                    ) : null;
                })}
                {template.question_ids?.length > 3 && (
                    <span className="text-[8px] font-black px-3 py-1 bg-black text-white rounded-full uppercase tracking-widest shadow-lg shadow-black/10">
                        +{template.question_ids.length - 3} MORE
                    </span>
                )}
            </div>

            <div className="pt-6 border-t border-slate-50 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <span>{template.question_ids?.length || 0} TOTAL QUESTIONS</span>
                <span className="opacity-50 tracking-tighter">{new Date(template.created_at).toLocaleDateString()}</span>
            </div>
        </div>
    );
}

function EmptyState({ activeSubTab }: { activeSubTab: string }) {
    return (
        <div className="col-span-full py-32 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-[32px] bg-slate-50 flex items-center justify-center mb-8 border border-slate-100 shadow-inner">
                <SearchX size={44} className="text-slate-200" />
            </div>
            <h3 className="text-2xl font-black font-space tracking-tighter mb-2">No {activeSubTab} synced</h3>
            <p className="text-slate-400 font-medium max-w-xs text-[10px] uppercase tracking-widest leading-relaxed">No matching records found in the current interview library.</p>
        </div>
    );
}
