import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { Code2, ChevronDown } from 'lucide-react';

export const SUPPORTED_LANGUAGES = [
    { id: 'python3', name: 'Python 3', monaco: 'python' },
    { id: 'javascript', name: 'Node.js', monaco: 'javascript' },
    { id: 'go', name: 'Go', monaco: 'go' },
    { id: 'cpp', name: 'C++', monaco: 'cpp' }
];

interface EditorWorkspaceProps {
    yDoc: Y.Doc | null;
    provider: WebsocketProvider | null;
    language: string;
    onLanguageChange: (lang: string) => void;
}

export default function EditorWorkspace({ yDoc, provider, language, onLanguageChange }: EditorWorkspaceProps) {
    const editorRef = useRef<any>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;

        if (yDoc && provider) {
            // Create a shared text type for the editor
            const type = yDoc.getText('monaco');

            // Bind the shared document to the monaco editor
            bindingRef.current = new MonacoBinding(
                type,
                editorRef.current.getModel(),
                new Set([editorRef.current]),
                provider.awareness
            );
        }
    };

    useEffect(() => {
        return () => {
            // Clean up binding on unmount
            if (bindingRef.current) {
                bindingRef.current.destroy();
            }
        };
    }, []);

    // Find monaco language mapping
    const activeLang = SUPPORTED_LANGUAGES.find(l => l.id === language) || SUPPORTED_LANGUAGES[0];

    return (
        <div className="w-full h-full flex flex-col bg-white/50 font-space">
            <div className="h-12 px-5 flex flex-row items-center justify-between bg-white/50 border-b border-black/5 text-sm font-bold text-gray-500 uppercase tracking-wider">
                <div className="flex items-center gap-2 text-gray-900 border-b-2 border-black py-3">
                    <Code2 size={16} className="text-gray-900" />
                    <span>Workspace</span>
                </div>

                <div className="relative flex items-center">
                    <select
                        value={language}
                        onChange={(e) => onLanguageChange(e.target.value)}
                        className="appearance-none bg-white border border-gray-200 text-gray-800 text-xs font-bold rounded px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-black/10 cursor-pointer shadow-sm"
                    >
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <option key={lang.id} value={lang.id}>{lang.name}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 text-gray-500 pointer-events-none" />
                </div>
            </div>
            <div className="flex-1 relative">
                <Editor
                    height="100%"
                    language={activeLang.monaco}
                    theme="light"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 15,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        wordWrap: 'on',
                        padding: { top: 24, bottom: 24 },
                        scrollBeyondLastLine: false,
                        lineHeight: 24,
                        fontLigatures: true,
                    }}
                    onMount={handleEditorDidMount}
                />
                {!yDoc && (
                    <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-md flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3 animate-pulse">
                            <div className="w-8 h-8 rounded-full border-2 border-black border-t-transparent animate-spin" />
                            <div className="text-gray-900 font-bold tracking-widest text-sm">INITIALIZING CRDT...</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
