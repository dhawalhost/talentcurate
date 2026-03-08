import { useEffect, useState } from 'react';
import { Play, Terminal as TerminalIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OutputTerminalProps {
    onRunCode: () => void;
    isRunning: boolean;
    stdin: string;
    onStdinChange: (val: string) => void;
}

interface ExecutionResult {
    stdout: string;
    stderr: string;
    exit_code: number;
}

interface ExecutionPayload {
    status: string;
    runtime_ms: number;
    memory_kb: number;
    results?: ExecutionResult[];
}

export default function OutputTerminal({ onRunCode, isRunning, stdin, onStdinChange }: OutputTerminalProps) {
    const [output, setOutput] = useState<ExecutionPayload | null>(null);
    const [activeTab, setActiveTab] = useState<'output' | 'input'>('output');

    useEffect(() => {
        const handleExecComplete = (event: Event) => {
            const customEvent = event as CustomEvent<ExecutionPayload>;
            setOutput(customEvent.detail);
        };

        window.addEventListener('EXEC_COMPLETED', handleExecComplete);
        return () => {
            window.removeEventListener('EXEC_COMPLETED', handleExecComplete);
        };
    }, []);
    const renderContent = () => {
        if (activeTab === 'input') {
            return (
                <div className="flex flex-col h-full w-full">
                    <p className="text-xs text-gray-500 mb-2 font-sans uppercase tracking-wider font-bold">Standard Input (stdin)</p>
                    <textarea
                        value={stdin}
                        onChange={(e) => onStdinChange(e.target.value)}
                        placeholder="Enter raw text to pipe to your program's standard input..."
                        className="flex-1 w-full bg-white/50 border border-black/10 rounded-lg p-3 text-sm font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-black/20 resize-none transition-all"
                        spellCheck={false}
                    />
                </div>
            );
        }

        if (isRunning) {
            return (
                <div className="flex flex-col gap-2 animate-pulse text-gray-600">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-4 bg-black animate-ping" />
                        <span>Executing sequence in sandbox...</span>
                    </div>
                </div>
            );
        }

        if (!output) {
            return <div className="text-gray-500 italic">System ready. Awaiting code execution...</div>;
        }

        if (output.status === 'TIMEOUT') {
            return <div className="text-red-600">Execution timed out (Limit: 60.0s exceeded). Potential infinite loop detected.</div>;
        }

        if (output.status === 'ERROR' && output.results && output.results.length > 0) {
            return <div className="text-red-600 whitespace-pre-wrap">{output.results[0].stderr}</div>;
        }

        if (output.results && output.results.length > 0) {
            const res = output.results[0];
            return (
                <div className="space-y-3">
                    {res.stdout && <pre className="text-gray-800 font-mono text-sm whitespace-pre-wrap">{res.stdout}</pre>}
                    {res.stderr && <pre className="text-red-600 font-mono text-sm whitespace-pre-wrap">{res.stderr}</pre>}
                    {res.exit_code !== 0 && (
                        <div className="text-red-600 text-xs mt-2 border border-red-200 bg-red-50 px-3 py-2 rounded-lg inline-block">
                            Process Exited with Code: {res.exit_code}
                        </div>
                    )}
                    <div className="text-gray-500 text-xs mt-6 flex items-center gap-6 border-t border-black/5 pt-3">
                        <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-black/50" />
                            Runtime: <span className="text-gray-900 font-mono">{output.runtime_ms}ms</span>
                        </span>
                        <span className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                            Memory: <span className="text-gray-900 font-mono">{output.memory_kb}KB</span>
                        </span>
                    </div>
                </div>
            );
        }

        return <div className="text-gray-500">No output returned from sandbox.</div>;
    };

    return (
        <div className="h-full w-full bg-transparent flex flex-col z-20 font-space relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 pointer-events-none" />

            <div className="h-12 px-4 flex items-center justify-between bg-white/50 border-b border-black/5 relative z-10 w-full">
                <div className="flex items-center gap-6 h-full">
                    <button
                        onClick={() => setActiveTab('output')}
                        className={`h-full flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'output' ? 'text-black border-black' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        <TerminalIcon size={16} />
                        <span>Output</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('input')}
                        className={`h-full flex items-center gap-2 text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'input' ? 'text-black border-black' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                    >
                        <span>Custom Input</span>
                        {stdin && <span className="w-2 h-2 rounded-full bg-blue-500 ml-1" title="Input provided" />}
                    </button>
                </div>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onRunCode}
                    disabled={isRunning}
                    className="flex items-center gap-2 px-4 py-1.5 bg-black hover:bg-gray-800 text-white text-xs font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_12px_rgba(0,0,0,0.15)] glow-primary"
                >
                    <Play size={14} fill={isRunning ? "transparent" : "currentColor"} />
                    {isRunning ? 'EXECUTING...' : 'RUN SEQUENCE'}
                </motion.button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto bg-transparent font-mono text-sm leading-relaxed relative z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={isRunning ? 'running' : output ? 'output' : 'idle'}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2 }}
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
