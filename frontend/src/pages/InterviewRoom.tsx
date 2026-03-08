import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { triggerExecution, submitFeedback } from '../lib/api';
import type { FeedbackData } from '../lib/api';
import { CollabService } from '../lib/socket';
import EditorWorkspace from '../components/EditorWorkspace';
import OutputTerminal from '../components/OutputTerminal';
import VideoSidebar from '../components/VideoSidebar';
import WhiteboardWorkspace from '../components/WhiteboardWorkspace';
import ChatPanel from '../components/ChatPanel';
import { Cpu, AlertTriangle, PanelLeftClose, PanelLeftOpen, PenTool, MessageSquare, Code2, LogOut, Sparkles, Settings } from 'lucide-react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { motion, AnimatePresence } from 'framer-motion';

export default function InterviewRoom() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const sessionId = searchParams.get('session_id') || window.location.pathname.split('/').pop() || '';

    // Overall Entry State
    const [isJoined, setIsJoined] = useState(false);
    const [errorStatus, setErrorStatus] = useState<string | null>(null);

    // Pre-Join Modal State
    const [requiresPreJoin, setRequiresPreJoin] = useState(false);
    const [guestName, setGuestName] = useState('');
    const [guestEmail, setGuestEmail] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);

    // Layout controls
    const [showEditor, setShowEditor] = useState(false);
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'code' | 'whiteboard'>('code');
    const [isChatOpen, setIsChatOpen] = useState(false);

    // Execution & Multi-language State
    const [isExecuting, setIsExecuting] = useState(false);
    const [executeStdin, setExecuteStdin] = useState<string>('');
    const [activeLanguage, setActiveLanguage] = useState<string>('python3');

    // Feedback Modal State
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [hireRecommendation, setHireRecommendation] = useState('HIRE');
    const [scoreAlgorithms, setScoreAlgorithms] = useState<number>(0);
    const [scoreCodeQuality, setScoreCodeQuality] = useState<number>(0);
    const [scoreCommunication, setScoreCommunication] = useState<number>(0);
    const [scoreSystemDesign, setScoreSystemDesign] = useState<number>(0);
    const [scoreLeadership, setScoreLeadership] = useState<number>(0);
    const [scoreProblemSolving, setScoreProblemSolving] = useState<number>(0);
    const [scoreCultureFit, setScoreCultureFit] = useState<number>(0);
    const [scoreDomainKnowledge, setScoreDomainKnowledge] = useState<number>(0);
    const [interviewNotes, setInterviewNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [lastSubmissionResult, setLastSubmissionResult] = useState<string | null>(null);

    // User Settings
    const [userSettings, setUserSettings] = useState({
        auto_record: true,
        default_cam_on: true,
        default_mic_on: true
    });

    // Interview Type (technical, behavioral, hr_screen, system_design)
    const [interviewType, setInterviewType] = useState<string>('technical');
    const isTechnical = interviewType === 'technical';
    const isBehavioral = interviewType === 'behavioral' || interviewType === 'hr_screen';


    // Real-time Service Hooks
    const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
    const [wsProvider, setWsProvider] = useState<WebsocketProvider | null>(null);
    const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

    // UI Feedback
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        if (actionError) {
            const t = setTimeout(() => setActionError(null), 5000);
            return () => clearTimeout(t);
        }
    }, [actionError]);

    // Synchronize workspace configuration (editor visibility, language) via Yjs
    useEffect(() => {
        if (!yDoc) return;
        const configMap = yDoc.getMap('config');

        const updateLocalState = () => {
            const remoteShowEditor = configMap.get('showEditor') as boolean;
            if (remoteShowEditor !== undefined && remoteShowEditor !== showEditor) {
                setShowEditor(remoteShowEditor);
            }

            const remoteLanguage = configMap.get('language') as string;
            if (remoteLanguage !== undefined && remoteLanguage !== activeLanguage) {
                setActiveLanguage(remoteLanguage);
            }
        };

        configMap.observe(updateLocalState);
        updateLocalState(); // Initial sync

        return () => configMap.unobserve(updateLocalState);
    }, [yDoc, showEditor, activeLanguage]);

    const toggleEditor = () => {
        if (!identity.startsWith('int_') || !yDoc) return;
        const configMap = yDoc.getMap('config');
        const nextState = !showEditor;
        configMap.set('showEditor', nextState);
        setShowEditor(nextState); // Optimistic local update
    };
    const collabServiceRef = useRef<CollabService | null>(null);

    // Video State
    const [videoToken, setVideoToken] = useState<string | null>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);

    // Identity tracked to manage UI roles
    const [identity, setIdentity] = useState<string>('');

    // Question Bank State
    const [questions, setQuestions] = useState<any[]>([]);
    const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
    const [questionDesc, setQuestionDesc] = useState<string | null>(null);

    // Execution & Multi-language State

    // Ensure we only trigger the recording API once per session when connection stabilizes
    const hasTriggeredRecording = useRef(false);

    useEffect(() => {
        if (wsStatus === 'connected' && identity?.startsWith('int_') && !hasTriggeredRecording.current) {
            hasTriggeredRecording.current = true;

            if (userSettings.auto_record === false) {
                console.log("[Recording] Auto-record is disabled in user settings. Skipping recording trigger.");
                return;
            }

            console.log("[Recording] WebRTC active. Triggering LiveKit egress recording for session:", sessionId);
            fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/sessions/${sessionId}/record`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('talentcurate_token')}` }
            }).then(res => {
                if (res.ok) {
                    console.log("[Recording] Recording request accepted for session:", sessionId);
                } else {
                    res.text().then(body => console.warn(`[Recording] Recording request failed (${res.status}):`, body));
                }
            }).catch(e => console.error("[Recording] Network error starting recording:", e));
        }
    }, [wsStatus, identity, sessionId]);

    useEffect(() => {
        if (!sessionId) {
            setErrorStatus("No Session ID provided in URL.");
            return;
        }

        const fetchSettingsAndJoin = async () => {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
            const authToken = localStorage.getItem('talentcurate_token');

            if (authToken) {
                try {
                    const setRes = await fetch(`${apiBase}/user/settings`, {
                        headers: { 'Authorization': `Bearer ${authToken}` }
                    });
                    if (setRes.ok) {
                        const data = await setRes.json();
                        setUserSettings(prev => ({ ...prev, ...data }));
                    }
                } catch (e) {
                    console.error("Failed to load settings before join", e);
                }

                // Parse User from LocalStorage to get their Real Name
                let hostName = 'Interviewer';
                try {
                    const userStr = localStorage.getItem('talentcurate_user');
                    if (userStr) {
                        const userObj = JSON.parse(userStr);
                        if (userObj.name) hostName = userObj.name;
                    }
                } catch (e) {
                    // Ignore parse errors, fallback to 'Interviewer'
                }

                try {
                    const res = await fetch(`${apiBase}/sessions/${sessionId}/join`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${authToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ host_name: hostName })
                    });

                    if (res.ok) {
                        const data = await res.json();
                        const iType = data.interview_type || 'technical';
                        setInterviewType(iType);
                        await completeJoin(data.video_token, data.identity, data.user_name);

                        // Auto-open editor for technical, whiteboard for system_design
                        if (iType === 'system_design') {
                            setShowEditor(true);
                            setActiveWorkspaceTab('whiteboard');
                        } else if (iType === 'technical') {
                            // Keep default behavior
                        }
                        // For behavioral/hr_screen, editor stays hidden

                        // Fetch questions for interviewer
                        const qRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/questions`);
                        if (qRes.ok) {
                            const qData = await qRes.json();
                            setQuestions(qData || []);
                        }
                    } else {
                        throw new Error("Failed to join as authenticated user.");
                    }
                } catch (err: any) {
                    setErrorStatus("Failed to join session. The link might be expired or invalid.");
                }
            } else {
                // Not logged in -> Must pass through Pre-Join
                setRequiresPreJoin(true);
            }
        };

        fetchSettingsAndJoin();

        window.addEventListener('EXEC_COMPLETED', () => {
            setIsExecuting(false);
        });

        return () => {
            if (collabServiceRef.current) {
                collabServiceRef.current.destroy();
            }
        }
    }, [sessionId]);

    const handleGuestJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsJoining(true);
        setJoinError(null);

        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
            const res = await fetch(`${apiBase}/sessions/${sessionId}/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ guest_name: guestName, guest_email: guestEmail })
            });

            if (res.ok) {
                const data = await res.json();
                setRequiresPreJoin(false);
                await completeJoin(data.video_token, data.identity, data.user_name);
            } else if (res.status === 403) {
                throw new Error("Access Denied: Email does not match the invited candidate.");
            } else {
                throw new Error("Failed to join the session. Invalid link or server error.");
            }
        } catch (err: any) {
            setJoinError(err.message);
        } finally {
            setIsJoining(false);
        }
    };

    const completeJoin = async (vToken: string, id: string, uName?: string) => {
        setVideoToken(vToken);
        setVideoUrl("http://localhost:7880");
        setIdentity(id);
        if (uName) {
            setGuestName(uName);
        }

        // Init WebSocket Client for Yjs CRDT
        const cs = new CollabService(sessionId, id);
        collabServiceRef.current = cs;

        // Wait for doc to be ready
        setYDoc(cs.doc);
        setWsProvider(cs.provider);
        cs.provider.on('status', (event: any) => {
            setWsStatus(event.status);
        });

        // Small delay to let the loading animation shine
        setTimeout(() => setIsJoined(true), 1500);
    };

    const handleRunCode = async () => {
        if (!sessionId || !yDoc) return;

        setIsExecuting(true);
        setActionError(null);
        const sourceCode = yDoc.getText('monaco').toString();

        try {
            await triggerExecution(sessionId, activeLanguage, sourceCode, executeStdin);
        } catch (err: any) {
            console.error("Execution trigger failed", err);
            setActionError(err.message || "Failed to trigger code execution");
            setIsExecuting(false);
        }
    };

    const handleLoadQuestion = async (qId: string) => {
        if (!qId) return;
        setSelectedQuestionId(qId);
        const q = questions.find(x => x.id === qId);
        if (q) {
            setQuestionDesc(q.description);
        }

        try {
            const token = localStorage.getItem('talentcurate_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1'}/sessions/${sessionId}/question`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question_id: qId })
            });

            if (res.ok && q && yDoc) {
                // Instantly inject starter code into Yjs document
                const monacoText = yDoc.getText('monaco');
                monacoText.delete(0, monacoText.length);
                if (q.starter_code) {
                    monacoText.insert(0, q.starter_code);
                }
            }
        } catch (err: any) {
            console.error("Failed to load question", err);
            setActionError(err.message || "Failed to load question securely");
        }
    };

    const handleLanguageChange = (lang: string) => {
        if (!yDoc) return;
        const configMap = yDoc.getMap('config');
        configMap.set('language', lang);
        setActiveLanguage(lang); // Optimistic remote sync handles the rest but local feels faster
    };

    const handleLeaveClick = () => {
        if (identity.startsWith('int_')) {
            setShowLeaveModal(true);
        } else {
            navigate('/dashboard');
        }
    };

    const handleAnalyzeClick = async () => {
        setIsAnalyzing(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
            const authToken = localStorage.getItem('talentcurate_token');

            const res = await fetch(`${apiBase}/sessions/${sessionId}/analyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            if (res.ok) {
                setIsAnalyzing(false);
                setShowLeaveModal(true);
            } else {
                const errText = await res.text();
                console.error("Analysis failed:", errText);
                setActionError("Analysis failed: " + errText);
                setIsAnalyzing(false);
            }
        } catch (err) {
            console.error("Analysis request error", err);
            setIsAnalyzing(false);
        }
    };

    const handleSubmitAnswer = async () => {
        if (!selectedQuestionId) {
            setActionError("No question selected. Load a question first.");
            return;
        }
        setShowSubmitConfirm(false);
        setIsSubmittingAnswer(true);
        try {
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';
            const authToken = localStorage.getItem('talentcurate_token');
            const sourceCode = yDoc ? yDoc.getText('monaco').toString() : '';

            if (!sourceCode.trim()) {
                setActionError("Cannot submit an empty answer. Write some code first.");
                setIsSubmittingAnswer(false);
                return;
            }

            const res = await fetch(`${apiBase}/sessions/${sessionId}/submit`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question_id: selectedQuestionId,
                    code: sourceCode,
                    language: activeLanguage
                })
            });
            if (res.ok) {
                const data = await res.json();
                setLastSubmissionResult(data.ai_analysis || 'Submitted successfully!');
            } else {
                const errText = await res.text();
                setActionError("Submission failed: " + errText);
            }
        } catch (err) {
            console.error("Submit answer error", err);
            setActionError("Failed to submit answer.");
        } finally {
            setIsSubmittingAnswer(false);
        }
    };

    const handleFeedbackSubmit = async () => {
        setIsSubmitting(true);
        try {
            const data: FeedbackData = {
                feedback,
                hire_recommendation: hireRecommendation,
                score_algorithms: scoreAlgorithms,
                score_code_quality: scoreCodeQuality,
                score_communication: scoreCommunication,
                score_system_design: scoreSystemDesign,
                score_leadership: scoreLeadership,
                score_problem_solving: scoreProblemSolving,
                score_culture_fit: scoreCultureFit,
                score_domain_knowledge: scoreDomainKnowledge,
                interview_notes: interviewNotes,
            };
            await submitFeedback(sessionId, data);
            navigate('/dashboard');
        } catch (err) {
            console.error("Failed to submit feedback", err);
            navigate('/dashboard');
        }
    };

    if (errorStatus) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-transparent p-8 relative overflow-hidden font-space">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-100/50 blur-[120px] rounded-full pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full glass-panel-elevated p-10 rounded-2xl border-t border-red-200 relative z-10 shadow-[0_16px_40px_rgba(239,68,68,0.1)]"
                >
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center border border-red-100 shadow-[0_4px_12px_rgba(239,68,68,0.1)]">
                            <AlertTriangle size={32} className="text-red-500" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold font-space text-center mb-3 text-gray-900">Connection Failed</h1>
                    <p className="text-red-600 text-center text-sm font-medium">{errorStatus}</p>
                </motion.div>
            </div>
        );
    }

    if (requiresPreJoin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-transparent p-8 relative overflow-hidden font-space">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 blur-[120px] rounded-full pointer-events-none" />

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md w-full glass-panel-elevated p-10 rounded-3xl border-t border-accent/20 relative z-10 shadow-[0_16px_40px_rgba(0,0,0,0.05)]"
                >
                    <div className="flex justify-center mb-8">
                        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20 glow-accent">
                            <Code2 size={32} className="text-accent" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-center mb-2 text-gray-900 tracking-tight">Join Interview</h1>
                    <p className="text-gray-500 text-center text-sm mb-8">Please enter your details to join the session.</p>

                    <form onSubmit={handleGuestJoin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700 ml-1">Full Name</label>
                            <input
                                type="text"
                                required
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                placeholder="E.g. Jane Doe"
                                className="w-full bg-white/50 border border-black/10 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-gray-900"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-gray-700 ml-1">Invited Email</label>
                            <input
                                type="email"
                                required
                                value={guestEmail}
                                onChange={(e) => setGuestEmail(e.target.value)}
                                placeholder="candidate@example.com"
                                className="w-full bg-white/50 border border-black/10 rounded-xl px-4 py-3 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all text-gray-900"
                            />
                        </div>

                        {joinError && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-2">
                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                <span>{joinError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isJoining || !guestName || !guestEmail}
                            className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border mt-4 ${isJoining || !guestName || !guestEmail
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-black hover:bg-gray-800 text-white border-black glow-primary shadow-[0_4px_14px_rgba(0,0,0,0.2)]'
                                }`}
                        >
                            {isJoining ? 'Joining...' : 'Join Session'}
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    if (!isJoined) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-transparent relative overflow-hidden font-space">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-black/5 blur-[120px] rounded-full pointer-events-none" />

                <motion.div
                    animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="flex flex-col items-center gap-6 z-10"
                >
                    <div className="relative">
                        <div className="absolute inset-0 bg-black/5 blur-xl rounded-full animate-pulse" />
                        <div className="w-20 h-20 bg-white/90 border border-black/10 rounded-full flex items-center justify-center relative z-10 shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
                            <Cpu size={36} className="text-gray-900 drop-shadow-sm" />
                        </div>
                    </div>
                    <p className="text-gray-900 font-bold tracking-[0.2em] uppercase text-sm drop-shadow-sm">Connecting...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }}
            className="flex flex-col absolute inset-0 bg-transparent overflow-hidden font-space text-gray-900"
        >
            {/* Ambient Background Glow for the workspace */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-black/5 blur-[150px] rounded-full pointer-events-none z-0" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-accent/5 blur-[150px] rounded-full pointer-events-none z-0" />

            {/* Navbar View */}
            <header className="h-14 shrink-0 flex items-center justify-between px-4 md:px-6 glass-panel border-b border-black/5 relative z-10 w-full">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-black/5 flex items-center justify-center text-gray-900 border border-black/10 hidden sm:flex">
                        <Code2 size={16} />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-bold tracking-wide text-gray-900">TalentCurate <span className="text-gradient hover:drop-shadow-sm transition-all cursor-default text-xs md:text-base">Interview</span></span>
                        <Link
                            to="/settings"
                            className="p-1.5 hover:bg-black/5 rounded-lg text-gray-400 hover:text-gray-900 transition-all border border-transparent hover:border-black/10"
                            title="Settings"
                        >
                            <Settings size={16} />
                        </Link>
                        {!isTechnical && (
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${isBehavioral ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}>
                                {interviewType.replace('_', ' ')}
                            </span>
                        )}
                    </div>

                    {/* Question Dropdown for interviewers — only for technical/coding interviews */}
                    {identity.startsWith('int_') && !isBehavioral && questions.length > 0 && (
                        <select
                            value={selectedQuestionId}
                            onChange={(e) => handleLoadQuestion(e.target.value)}
                            className="ml-2 bg-white border border-black/10 text-[10px] md:text-xs font-bold text-gray-700 px-3 py-1.5 rounded-lg shadow-sm focus:outline-none hidden md:block w-32 lg:w-40 truncate"
                        >
                            <option value="">-- Load a Question --</option>
                            {questions.map((q) => (
                                <option key={q.id} value={q.id}>{q.title}</option>
                            ))}
                        </select>
                    )}

                    {/* Editor toggle — only for technical and system_design */}
                    {identity.startsWith('int_') && !isBehavioral && (
                        <button
                            onClick={toggleEditor}
                            className={`ml-2 md:ml-4 flex items-center justify-center p-2 rounded-lg border transition-all ${showEditor ? 'bg-black/5 border-black/10 text-gray-900' : 'bg-black/5 border-black/10 text-gray-500 hover:text-gray-900'}`}
                            title={showEditor ? 'Hide Editor' : 'Show Editor'}
                        >
                            {showEditor ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                    )}

                    <button
                        onClick={() => setIsChatOpen(!isChatOpen)}
                        className={`ml-2 flex items-center justify-center p-2 rounded-lg border transition-all ${isChatOpen ? 'bg-primary border-primary text-white glow-primary' : 'bg-black/5 border-black/10 text-gray-900 hover:bg-black/10'}`}
                        title="Chat"
                    >
                        <MessageSquare size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                    <div className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-black/5 shadow-sm transition-colors ${wsStatus === 'connected' ? 'bg-white/60' : 'bg-red-50'}`}>
                        <div className={`w-2 h-2 rounded-full shadow-sm ${wsStatus === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse' : 'bg-red-500'} ${wsStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : ''}`} />
                        <span className="text-[10px] font-bold text-gray-700 tracking-tighter">
                            {wsStatus === 'connected' ? 'CONNECTED' : wsStatus === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 bg-white/40 md:bg-white/60 px-2 md:px-3 py-1.5 rounded-xl border border-black/5 shadow-sm overflow-hidden shrink min-w-0 max-w-[120px] md:max-w-none">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-gray-900 to-gray-600 flex items-center justify-center text-white shrink-0 shadow-sm">
                            <span className="text-[10px] md:text-xs font-bold">{(guestName || (identity.startsWith('int_') ? 'Int' : 'Can')).charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex flex-col min-w-0 hidden sm:flex">
                            <span className="text-[10px] md:text-xs font-bold text-gray-900 truncate tracking-tight">{guestName || (identity.startsWith('int_') ? 'Interviewer' : 'Candidate')}</span>
                            <span className="text-[8px] md:text-[10px] font-bold text-gray-500 truncate opacity-80 uppercase tracking-widest">{identity.startsWith('int_') ? 'Host' : 'Participant'}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
                        {identity.startsWith('int_') && (
                            <button
                                onClick={handleAnalyzeClick}
                                disabled={isAnalyzing}
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg transition-colors hover:shadow-sm disabled:opacity-50 font-bold text-xs md:text-sm shadow-sm"
                                title="End this interview session and generate an AI summary"
                            >
                                {isAnalyzing ? <div className="w-4 h-4 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : <Sparkles size={16} />}
                                <span className="hidden sm:inline">End & Analyze</span>
                            </button>
                        )}
                        <button
                            onClick={handleLeaveClick}
                            disabled={isAnalyzing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg transition-colors hover:shadow-sm disabled:opacity-50 font-bold text-xs md:text-sm shadow-sm relative"
                            title="Leave this interview session"
                        >
                            <LogOut size={16} />
                            <span className="hidden sm:inline">Leave</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative z-10 p-2 md:p-4 gap-4 min-h-0">
                {/* Behavioral Interview Notes Panel */}
                {isBehavioral && identity.startsWith('int_') && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col glass-panel-elevated rounded-2xl border border-black/10 shadow-[0_12px_36px_rgba(0,0,0,0.1)] lg:w-[400px] xl:w-[480px] shrink-0 overflow-hidden"
                    >
                        <div className="p-4 border-b border-black/10 bg-emerald-50/50">
                            <h3 className="font-bold text-sm text-emerald-800 flex items-center gap-2">
                                📝 Interview Notes
                                <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200">
                                    {interviewType.replace('_', ' ')}
                                </span>
                            </h3>
                            <p className="text-[11px] text-gray-500 mt-1">Use the STAR method: Situation → Task → Action → Result</p>
                        </div>
                        <div className="flex-1 flex flex-col p-4 gap-3 overflow-y-auto">
                            {/* STAR Prompts */}
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { emoji: '📍', label: 'Situation', hint: 'Context and background', color: 'blue' },
                                    { emoji: '🎯', label: 'Task', hint: 'What was required', color: 'amber' },
                                    { emoji: '⚡', label: 'Action', hint: 'Steps they took', color: 'purple' },
                                    { emoji: '✅', label: 'Result', hint: 'Outcome achieved', color: 'green' },
                                ].map(p => (
                                    <div key={p.label} className={`p-2 rounded-lg border bg-${p.color}-50/50 border-${p.color}-100`}>
                                        <span className="text-[10px] font-bold text-gray-600">{p.emoji} {p.label}</span>
                                        <p className="text-[9px] text-gray-400">{p.hint}</p>
                                    </div>
                                ))}
                            </div>
                            <textarea
                                value={interviewNotes}
                                onChange={(e) => setInterviewNotes(e.target.value)}
                                placeholder="Take notes during the interview...\n\n• How did the candidate describe the situation?\n• What specific actions did they take?\n• What was the measurable result?\n• Did they demonstrate leadership / teamwork?\n• Communication clarity and confidence level?"
                                className="flex-1 min-h-[200px] px-4 py-3 rounded-xl border border-black/10 bg-white/80 shadow-sm font-medium text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-300/50 resize-none placeholder:text-gray-400 leading-relaxed"
                            />
                        </div>
                    </motion.div>
                )}

                {/* Editor + Terminal Panel (hidden for behavioral) */}
                <AnimatePresence>
                    {showEditor && (
                        <motion.div
                            initial={{ width: 0, opacity: 0, flex: 0 }}
                            animate={{ width: "auto", opacity: 1, flex: 1 }}
                            exit={{ width: 0, opacity: 0, flex: 0 }}
                            className="flex flex-col relative min-w-0 glass-panel-elevated rounded-2xl border border-black/10 shadow-[0_12px_36px_rgba(0,0,0,0.1)] lg:h-full h-[50vh] shrink-0 overflow-hidden"
                        >
                            <div className="flex-1 relative min-h-0 bg-white/50 flex flex-col">
                                {questionDesc && activeWorkspaceTab === 'code' && (
                                    <div className="shrink-0 max-h-[150px] overflow-y-auto p-4 bg-yellow-50/50 border-b border-yellow-200 text-sm text-gray-800 font-medium">
                                        <div className="flex items-center justify-between gap-2">
                                            <h4 className="font-bold text-yellow-800 mb-1">Question Description</h4>
                                            <button
                                                onClick={() => setShowSubmitConfirm(true)}
                                                disabled={isSubmittingAnswer}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50 shrink-0"
                                                title="Submit your answer for AI evaluation"
                                            >
                                                {isSubmittingAnswer ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles size={14} />}
                                                Submit Answer
                                            </button>
                                        </div>
                                        <p className="whitespace-pre-wrap leading-relaxed">{questionDesc}</p>
                                    </div>
                                )}

                                {/* Workspace Tabs */}
                                <div className="flex bg-black/5 border-b border-black/10 shrink-0">
                                    <button
                                        onClick={() => setActiveWorkspaceTab('code')}
                                        className={`flex-1 py-3 text-sm font-bold tracking-wider flex items-center justify-center gap-2 transition-colors ${activeWorkspaceTab === 'code' ? 'bg-white text-gray-900 border-t-2 border-t-primary' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'}`}
                                    >
                                        <Code2 size={16} /> CODE
                                    </button>
                                    <button
                                        onClick={() => setActiveWorkspaceTab('whiteboard')}
                                        className={`flex-1 py-3 text-sm font-bold tracking-wider flex items-center justify-center gap-2 transition-colors ${activeWorkspaceTab === 'whiteboard' ? 'bg-white text-gray-900 border-t-2 border-t-primary' : 'text-gray-500 hover:text-gray-900 hover:bg-black/5'}`}
                                    >
                                        <PenTool size={16} /> WHITEBOARD
                                    </button>
                                </div>

                                <div className="flex-1 min-h-0 relative">
                                    {activeWorkspaceTab === 'code' ? (
                                        <EditorWorkspace
                                            yDoc={yDoc}
                                            provider={wsProvider}
                                            language={activeLanguage}
                                            onLanguageChange={handleLanguageChange}
                                        />
                                    ) : (
                                        <WhiteboardWorkspace yDoc={yDoc} provider={wsProvider} />
                                    )}
                                </div>
                            </div>
                            {activeWorkspaceTab === 'code' && (
                                <div className="shrink-0 h-[200px] md:h-[250px] border-t border-black/10 bg-white/50">
                                    <OutputTerminal
                                        onRunCode={handleRunCode}
                                        isRunning={isExecuting}
                                        stdin={executeStdin}
                                        onStdinChange={setExecuteStdin}
                                    />
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Video Panel */}
                <motion.div
                    layout
                    className={`glass-panel-elevated rounded-2xl border border-white/5 bg-black/40 overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] flex flex-col min-h-0 ${showEditor ? 'lg:w-[300px] xl:w-[360px] shrink-0' : 'flex-1 min-w-0'}`}
                >
                    {videoToken && videoUrl ? (
                        <div className="flex-1 w-full min-h-0">
                            <VideoSidebar token={videoToken} serverUrl={videoUrl} identity={identity} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center flex-1 text-text-muted text-sm gap-3">
                            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                            <span className="font-medium tracking-wider">Awaiting video signal...</span>
                        </div>
                    )}
                </motion.div>
                {/* Chat Panel Integrated horizontally */}
                <ChatPanel
                    yDoc={yDoc!}
                    userId={identity}
                    userRole={identity.startsWith('int_') ? 'interviewer' : 'candidate'}
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                />
            </div>

            {/* Feedback Modal */}
            <AnimatePresence>
                {showLeaveModal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm font-space"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white/90 backdrop-blur-2xl p-8 rounded-2xl w-full max-w-lg border border-black/10 shadow-[0_24px_60px_rgba(0,0,0,0.15)] flex flex-col gap-6"
                        >
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Interview Complete</h2>
                                <p className="text-gray-600 font-medium">Please provide your evaluation to help HR make a decision.</p>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-gray-900 tracking-wider">Evaluation Rubric (1-5)</label>
                                <div className="grid grid-cols-1 gap-3 bg-black/5 p-4 rounded-xl border border-black/10">
                                    {(isBehavioral ? [
                                        { label: 'Leadership & Initiative', val: scoreLeadership, setter: setScoreLeadership },
                                        { label: 'Problem Solving', val: scoreProblemSolving, setter: setScoreProblemSolving },
                                        { label: 'Communication & Clarity', val: scoreCommunication, setter: setScoreCommunication },
                                        { label: 'Culture Fit & Values', val: scoreCultureFit, setter: setScoreCultureFit },
                                        { label: 'Domain Knowledge', val: scoreDomainKnowledge, setter: setScoreDomainKnowledge },
                                    ] : [
                                        { label: 'Algorithms & Data Structures', val: scoreAlgorithms, setter: setScoreAlgorithms },
                                        { label: 'Code Quality & Best Practices', val: scoreCodeQuality, setter: setScoreCodeQuality },
                                        { label: 'Communication & Clarity', val: scoreCommunication, setter: setScoreCommunication },
                                        { label: 'System Design & Architecture', val: scoreSystemDesign, setter: setScoreSystemDesign },
                                    ]).map((metric, idx) => (
                                        <div key={idx} className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{metric.label}</span>
                                                <span className="text-xs font-bold text-gray-900">{metric.val > 0 ? `${metric.val}/5` : '-'}</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <button
                                                        key={star}
                                                        onClick={() => metric.setter(star)}
                                                        className={`flex-1 h-8 rounded-lg font-bold text-xs transition-all border ${metric.val >= star
                                                            ? 'bg-black text-white border-black scale-[1.02] shadow-sm'
                                                            : 'bg-white text-gray-400 border-black/5 hover:border-black/20 hover:text-gray-600'}`}
                                                    >
                                                        {star}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-gray-900 tracking-wider">Recommendation</label>
                                <select
                                    value={hireRecommendation}
                                    onChange={(e) => setHireRecommendation(e.target.value)}
                                    className="px-4 py-3 rounded-xl border border-black/10 bg-white shadow-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20"
                                >
                                    <option value="STRONG_HIRE">Strong Hire</option>
                                    <option value="HIRE">Hire</option>
                                    <option value="NO_HIRE">No Hire</option>
                                    <option value="STRONG_NO_HIRE">Strong No Hire</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-gray-900 tracking-wider">
                                    {isBehavioral ? 'Behavioral Feedback' : 'Technical Feedback'}
                                </label>
                                <textarea
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    rows={4}
                                    placeholder={isBehavioral
                                        ? 'Evaluate communication, leadership, problem-solving approach, culture fit...'
                                        : 'Assess problem solving, code quality, communication...'
                                    }
                                    className="px-4 py-3 rounded-xl border border-black/10 bg-white shadow-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-black/20 resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-3 mt-4">
                                <button
                                    onClick={() => setShowLeaveModal(false)}
                                    className="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:text-gray-800 hover:bg-black/5 transition-all outline-none focus:ring-2 focus:ring-black/10 mr-auto"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:text-gray-900 hover:bg-black/5 transition-all outline-none focus:ring-2 focus:ring-black/10"
                                >
                                    Skip
                                </button>
                                <button
                                    onClick={handleFeedbackSubmit}
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 rounded-xl font-bold text-white bg-black hover:bg-gray-800 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.2)] disabled:opacity-50 flex items-center gap-2 outline-none focus:ring-2 focus:ring-black/50 focus:ring-offset-2"
                                >
                                    {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                                    Submit
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Submit Answer Confirmation Dialog */}
            <AnimatePresence>
                {showSubmitConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm font-space"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white/90 backdrop-blur-2xl p-6 rounded-2xl w-full max-w-sm border border-black/10 shadow-[0_24px_60px_rgba(0,0,0,0.15)] flex flex-col gap-4"
                        >
                            <h3 className="text-lg font-bold text-gray-900">Submit Your Answer?</h3>
                            <p className="text-sm text-gray-600">Your current code will be submitted for AI evaluation. You can still continue coding after submission.</p>
                            <div className="flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className="px-4 py-2 rounded-xl font-bold text-gray-500 hover:text-gray-800 hover:bg-black/5 transition-all"
                                >Cancel</button>
                                <button
                                    onClick={handleSubmitAnswer}
                                    className="px-5 py-2 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all shadow-md"
                                >Submit</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* AI Analysis Result Overlay */}
            <AnimatePresence>
                {lastSubmissionResult && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm font-space"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white/95 backdrop-blur-2xl p-6 rounded-2xl w-full max-w-lg border border-black/10 shadow-[0_24px_60px_rgba(0,0,0,0.15)] flex flex-col gap-4 max-h-[70vh] overflow-y-auto"
                        >
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Sparkles size={18} className="text-indigo-600" /> AI Analysis</h3>
                                <button onClick={() => setLastSubmissionResult(null)} className="text-gray-400 hover:text-gray-700 transition-colors">&times;</button>
                            </div>
                            <div className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: lastSubmissionResult.replace(/\n/g, '<br/>') }} />
                            <button
                                onClick={() => setLastSubmissionResult(null)}
                                className="self-end px-5 py-2 rounded-xl font-bold text-white bg-black hover:bg-gray-800 transition-all shadow-md"
                            >Close</button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error Toast overlays */}
            <AnimatePresence>
                {actionError && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 left-6 max-w-sm bg-red-600 border-l-4 border-red-800 text-white px-4 py-3 rounded-lg shadow-2xl z-50 flex items-start gap-3"
                    >
                        <AlertTriangle className="shrink-0 animate-pulse mt-0.5" size={20} />
                        <div className="flex-1 text-sm font-medium leading-tight">
                            {actionError}
                        </div>
                        <button onClick={() => setActionError(null)} className="opacity-70 hover:opacity-100 transition-opacity p-0.5">
                            <PanelLeftClose size={16} />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
