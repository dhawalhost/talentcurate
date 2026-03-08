import { useEffect, useState, useRef } from 'react';
import { Send } from 'lucide-react';
import * as Y from 'yjs';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
    id: string;
    text: string;
    senderId: string;
    senderRole: 'interviewer' | 'candidate';
    timestamp: number;
}

interface ChatPanelProps {
    yDoc: Y.Doc | null;
    userId: string;
    userRole: 'interviewer' | 'candidate';
    isOpen: boolean;
    onClose: () => void;
}

export default function ChatPanel({ yDoc, userId, userRole, isOpen, onClose }: ChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!yDoc) return;

        const yMessages = yDoc.getArray<ChatMessage>('chat_messages');

        const updateMessages = () => {
            setMessages(yMessages.toArray());
        };

        yMessages.observe(updateMessages);
        updateMessages();

        return () => yMessages.unobserve(updateMessages);
    }, [yDoc]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages, isOpen]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !yDoc) return;

        const yMessages = yDoc.getArray<ChatMessage>('chat_messages');
        yMessages.push([{
            id: Math.random().toString(36).substring(7),
            text: newMessage,
            senderId: userId,
            senderRole: userRole,
            timestamp: Date.now()
        }]);

        setNewMessage('');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="glass-panel-elevated rounded-2xl border border-black/10 shadow-[0_12px_36px_rgba(0,0,0,0.1)] flex flex-col font-space shrink-0 overflow-hidden bg-white/50 backdrop-blur-2xl"
                >
                    <div className="w-[320px] flex flex-col h-full bg-white/50">
                        <div className="h-14 shrink-0 border-b border-black/10 px-4 flex justify-between items-center bg-black/5">
                            <h3 className="font-bold text-gray-900 tracking-wider flex items-center gap-2">
                                Session Chat
                            </h3>
                            <button
                                onClick={onClose}
                                className="text-gray-500 hover:text-gray-900 px-2 py-1 rounded hover:bg-black/5 transition-all text-sm font-bold"
                            >
                                CLOSE
                            </button>
                        </div>

                        <div ref={containerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                            {messages.length === 0 && (
                                <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 gap-3">
                                    <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center border border-black/5">
                                        <Send size={24} className="text-gray-400" />
                                    </div>
                                    <span className="font-medium text-sm">No messages yet. Say hi!</span>
                                </div>
                            )}
                            {messages.map((msg) => {
                                const isMe = msg.senderId === userId;
                                return (
                                    <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}>
                                        <span className="text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1 tracking-wider">
                                            {isMe ? 'You' : msg.senderRole}
                                        </span>
                                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? 'bg-black text-white rounded-tr-sm' : 'bg-black/5 border border-black/10 text-gray-900 rounded-tl-sm'}`}>
                                            {msg.text}
                                        </div>
                                        <span className="text-[10px] text-gray-400 mt-1 font-medium mr-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 border-t border-black/10 bg-white">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-black/5 border border-black/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-black focus:ring-1 focus:ring-black/20"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim()}
                                    className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center disabled:opacity-50 hover:bg-gray-800 transition-all font-bold"
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
