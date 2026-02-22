'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Bot, User, Plus, MessageSquare, Menu, X, Quote } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    saveMessage,
    getSessionMessages,
    createSession,
    getAllSessions,
    deleteSession,
    updateSessionTitle,
    ChatSession,
    Message
} from '@/lib/db';

export default function ChatInterface() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectionContext, setSelectionContext] = useState<string | null>(null);
    const [isRenamingId, setIsRenamingId] = useState<number | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [isImageLoading, setIsImageLoading] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load Sessions
    const loadSessions = async () => {
        const allSessions = await getAllSessions();
        setSessions(allSessions);
        if (!currentSessionId && allSessions.length > 0) {
            setCurrentSessionId(allSessions[0].id!);
        } else if (allSessions.length === 0) {
            handleNewChat();
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    // Load Messages for current session
    useEffect(() => {
        if (currentSessionId) {
            const loadMessages = async () => {
                const history = await getSessionMessages(currentSessionId);
                setMessages(history);
            };
            loadMessages();
        } else {
            setMessages([]);
        }
    }, [currentSessionId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleNewChat = async () => {
        const id = await createSession('New Chat');
        await loadSessions();
        setCurrentSessionId(id);
        setMessages([]);
        setIsSidebarOpen(false); // Close on mobile
    };

    const handleSend = async (forcedPrompt?: string, isImage?: boolean, displayContent?: string) => {
        if ((!input.trim() && !selectionContext && !forcedPrompt) || isLoading || !currentSessionId) return;

        let textToSubmit = forcedPrompt || input;
        let finalInput = textToSubmit;
        let uiContent = displayContent || forcedPrompt || input;

        if (selectionContext) {
            finalInput = `> ${selectionContext}\n\n${textToSubmit}`;
            uiContent = displayContent || `> ${selectionContext}\n\n${textToSubmit}`;
        }

        const userMessage: Message = {
            sessionId: currentSessionId,
            role: 'user',
            content: uiContent,
            timestamp: Date.now()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setSelectionContext(null);
        setIsLoading(true);

        // We save the UI content, but for the API call below, we might use finalInput
        await saveMessage(userMessage);

        // Scrub base64/large data URLs from API history to avoid token overflow
        const scrubbedMessages = messages.map(m => {
            let content = m.content;
            if (content.includes('data:image')) {
                content = content.replace(/!\[.*?\]\(data:image\/.*?;base64,.*?\)/g, '[Image Data]');
            }
            return { role: m.role, content };
        });

        // Add the current user input (already scrubbed if it contained selection context)
        const apiMessages = [...scrubbedMessages, { role: 'user', content: finalInput }];

        // Auto-title session
        if (messages.length === 0) {
            const title = textToSubmit.slice(0, 30) || 'New Chat';
            await updateSessionTitle(currentSessionId, title);
            loadSessions();
        }

        if (isImage) {
            setIsImageLoading(true);
            try {
                // Feature: AI-Enhanced Image Prompts
                console.log('[Image] Enhancing prompt with AI...');
                const promptEnhanceRes = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            role: 'user',
                            content: `Expand this image prompt into a professional, highly detailed, artistic description for an image generator: "${textToSubmit}". Only return the expanded description, nothing else.`
                        }]
                    }),
                });

                let optimizedPrompt = textToSubmit;
                if (promptEnhanceRes.ok) {
                    const enhancedData = await promptEnhanceRes.text();
                    // Basic parsing of the stream to get the text
                    const match = enhancedData.match(/"content":"(.*?)"/g);
                    if (match) {
                        optimizedPrompt = match.map(m => m.slice(11, -1)).join('').replace(/\\n/g, ' ').replace(/\\/g, '');
                    }
                }

                const res = await fetch('/api/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: optimizedPrompt }),
                });
                const data = await res.json();
                if (data.url) {
                    const assistantMsg: Message = {
                        sessionId: currentSessionId,
                        role: 'assistant',
                        content: `![generated image](${data.url})`,
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, assistantMsg]);
                    await saveMessage(assistantMsg);
                } else {
                    const errorMsg = data.error || 'Failed to generate image';
                    const assistantMsg: Message = {
                        sessionId: currentSessionId,
                        role: 'assistant',
                        content: `❌ **Error:** ${errorMsg}. Please try again in a moment.`,
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, assistantMsg]);
                    await saveMessage(assistantMsg);
                }
            } catch (e) {
                console.error('Image error:', e);
                const assistantMsg: Message = {
                    sessionId: currentSessionId,
                    role: 'assistant',
                    content: `❌ **Connection Error:** Could not reach the image generation service.`,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, assistantMsg]);
                await saveMessage(assistantMsg);
            } finally {
                setIsImageLoading(false);
                setIsLoading(false);
            }
            return;
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData.error || 'Failed to fetch response';
                const details = errorData.details || '';

                const assistantMsg: Message = {
                    sessionId: currentSessionId,
                    role: 'assistant',
                    content: `⚠️ **API Error:** ${errorMsg} ${details ? `\n\n> *Details: ${details}*` : ''}`,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, assistantMsg]);
                await saveMessage(assistantMsg);
                setIsLoading(false);
                return;
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let assistantContent = '';

            const assistantMsg: Message = {
                sessionId: currentSessionId,
                role: 'assistant',
                content: '',
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, assistantMsg]);

            if (reader) {
                let partialLine = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = (partialLine + chunk).split('\n');
                    partialLine = lines.pop() || ''; // Keep the last incomplete line

                    for (const line of lines) {
                        const trimmedLine = line.trim();
                        if (!trimmedLine || trimmedLine === 'data: [DONE]') continue;

                        if (trimmedLine.startsWith('data: ')) {
                            try {
                                const json = JSON.parse(trimmedLine.slice(6));
                                const content = json.choices[0]?.delta?.content || '';
                                if (content) {
                                    assistantContent += content;
                                    setMessages(prev => {
                                        const last = prev[prev.length - 1];
                                        return [...prev.slice(0, -1), { ...last, content: assistantContent }];
                                    });
                                }
                            } catch (e) {
                                console.error('[Stream] Parse Error:', e, trimmedLine);
                            }
                        }
                    }
                }
            }

            if (assistantContent.trim() === '') {
                const errorMsg = "AI returned an empty response. This can happen if the model is busy or the prompt is too complex. Please try again.";
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    return [...prev.slice(0, -1), { ...last, content: `⚠️ **Error:** ${errorMsg}` }];
                });
            } else {
                await saveMessage({
                    sessionId: currentSessionId,
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: Date.now()
                });
            }
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => {
                const last = prev[prev.length - 1];
                return [...prev.slice(0, -1), { ...last, content: `❌ **Connection Error:** Failed to get a response from the AI.` }];
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteSession = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Delete this chat?')) {
            await deleteSession(id);
            if (currentSessionId === id) setCurrentSessionId(null);
            loadSessions();
        }
    };

    const startRename = (e: React.MouseEvent, s: ChatSession) => {
        e.stopPropagation();
        setIsRenamingId(s.id!);
        setRenameValue(s.title);
    };

    const handleRename = async () => {
        if (isRenamingId && renameValue.trim()) {
            await updateSessionTitle(isRenamingId, renameValue.trim());
            setIsRenamingId(null);
            loadSessions();
        }
    };

    const handleTextSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== '') {
            // Selection made
        }
    };

    const quoteSelection = () => {
        const selection = window.getSelection();
        if (selection && selection.toString().trim() !== '') {
            setSelectionContext(selection.toString().trim());
            inputRef.current?.focus();
        }
    };

    const handleSearch = async () => {
        if (!input.trim() || isLoading) return;
        const query = input.trim();
        setInput('');
        setIsLoading(true);

        // UI Message for search
        const userMsg: Message = {
            sessionId: currentSessionId!,
            role: 'user',
            content: `🔍 Search: **${query}**`,
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        await saveMessage(userMsg);

        try {
            console.log('[Search] Triggering real web search...');
            const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const searchData = await searchRes.json();

            let context = '';
            if (searchData.results && searchData.results.length > 0) {
                context = `Here are the top search results for "${query}":\n\n` +
                    searchData.results.map((r: any) => `- **[${r.title}](${r.link})**\n  ${r.snippet}`).join('\n\n');
            } else {
                context = `No direct search results were found for "${query}", but I will try to answer based on my knowledge.`;
            }

            const searchPrompt = `USER REQUEST: ${query}\n\nWEB SEARCH CONTEXT:\n${context}\n\nPlease summarize these results for the user. Include the helpful links and be concise. If no results were found, answer based on your general knowledge.`;

            // Re-use handleSend logic but with the context
            handleSend(searchPrompt, false, `🔍 Search: **${query}**`);

        } catch (error) {
            console.error('[Search] Failed:', error);
            handleSend(query); // Fallback to normal chat if search fails
        }
    };

    const handleImageGen = () => {
        if (!input.trim()) return;
        const query = input.trim();
        handleSend(query, true, `🎨 Generate Image: **${query}**`);
    };

    return (
        <div className="flex h-screen bg-[#0d1117] text-[#e6edf3] overflow-hidden font-sans">
            {/* Sidebar */}
            <div className={`fixed md:relative z-40 h-full bg-[#161b22] border-r border-white/5 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
                <div className="flex flex-col h-full p-3">
                    <button
                        onClick={handleNewChat}
                        className="flex items-center gap-2 w-full p-3 rounded-xl border border-white/10 hover:bg-white/5 transition mb-6 font-medium"
                    >
                        <Plus size={18} /> New Chat
                    </button>

                    <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
                        {sessions.map((s) => (
                            <div
                                key={s.id}
                                onClick={() => {
                                    setCurrentSessionId(s.id!);
                                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                                }}
                                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${currentSessionId === s.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <div className="flex items-center gap-3 overflow-hidden flex-1">
                                    <MessageSquare size={16} className="shrink-0 opacity-50" />
                                    {isRenamingId === s.id ? (
                                        <input
                                            autoFocus
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={handleRename}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                            className="bg-transparent border-none outline-none w-full text-sm"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="truncate text-sm">{s.title}</span>
                                    )}
                                </div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={(e) => startRename(e, s)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-400 transition"
                                        title="Rename Chat"
                                    >
                                        <Menu size={14} className="rotate-90" />
                                    </button>
                                    <button
                                        onClick={(e) => handleDeleteSession(e, s.id!)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition"
                                        title="Delete Chat"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <p className="text-[10px] text-center mt-4 text-neutral-500 uppercase tracking-tighter">
                        All data stored locally in IndexedDB
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col relative min-w-0">
                {/* Mobile Header Overlay */}
                <div className="flex items-center gap-4 p-4 border-b border-white/5 md:hidden">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                        <Menu size={20} />
                    </button>
                    <h1 className="text-lg font-bold">MyGPT</h1>
                </div>

                {/* Message Area */}
                <div
                    className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scrollbar-hide"
                    onMouseUp={handleTextSelection}
                >
                    {!currentSessionId || messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center opacity-30 mt-[-10vh]">
                            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-6">
                                <Bot size={32} className="text-white" />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Build your thoughts</h2>
                            <p>Search the web or generate an image.</p>
                        </div>
                    ) : (
                        messages.map((m, i) => (
                            <div key={i} className={`flex gap-4 md:gap-6 group ${m.role === 'assistant' ? 'bg-white/5 p-4 md:p-6 rounded-3xl' : ''}`}>
                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center shrink-0 ${m.role === 'assistant' ? 'bg-green-600' : 'bg-neutral-700'}`}>
                                    {m.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="font-bold text-xs uppercase tracking-widest opacity-40">
                                            {m.role === 'assistant' ? 'MyGPT Assistant' : 'You'}
                                        </p>
                                        <button
                                            onClick={() => {
                                                setSelectionContext(m.content);
                                                inputRef.current?.focus();
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-white/10 transition"
                                            title="Quote message"
                                        >
                                            <Quote size={14} />
                                        </button>
                                    </div>
                                    <div className="text-neutral-200 leading-relaxed selection:bg-blue-500/30">
                                        <div className="prose prose-invert max-w-none">
                                            {m.content.includes('![') ? (
                                                <div className="my-4">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img
                                                        src={m.content.match(/\((.*?)\)/)?.[1] || ''}
                                                        alt="AI Generated"
                                                        className="rounded-2xl max-h-[500px] w-auto border border-white/10 shadow-2xl"
                                                    />
                                                </div>
                                            ) : (
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({ node, ...props }) => (
                                                            <a {...props} className="text-blue-400 hover:text-blue-300 underline font-medium transition-colors" target="_blank" rel="noopener noreferrer" />
                                                        ),
                                                        p: ({ node, ...props }) => <p {...props} className="mb-4 last:mb-0" />,
                                                        ul: ({ node, ...props }) => <ul {...props} className="list-disc ml-4 mb-4 space-y-2" />,
                                                        ol: ({ node, ...props }) => <ol {...props} className="list-decimal ml-4 mb-4 space-y-2" />,
                                                        strong: ({ node, ...props }) => <strong {...props} className="text-white font-bold" />
                                                    }}
                                                >
                                                    {m.content || (isLoading && i === messages.length - 1 ? '...' : '')}
                                                </ReactMarkdown>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                    {isImageLoading && (
                        <div className="flex gap-4 md:gap-6 bg-white/5 p-4 md:p-6 rounded-3xl animate-pulse">
                            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-green-600 flex items-center justify-center shrink-0">
                                <Bot size={20} />
                            </div>
                            <div className="flex-1 bg-white/5 h-[300px] rounded-2xl flex items-center justify-center text-neutral-500">
                                Generating your artistic vision...
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-8 pt-0 max-w-4xl mx-auto w-full">
                    <div className="relative bg-[#161b22] border border-white/10 rounded-3xl shadow-xl transition-all focus-within:border-blue-500/50">
                        {selectionContext && (
                            <div className="mx-4 mt-4 p-3 bg-white/5 rounded-xl border-l-4 border-blue-500 text-sm flex justify-between items-start">
                                <div className="truncate text-neutral-400 italic">
                                    &ldquo;{selectionContext}&rdquo;
                                </div>
                                <button onClick={() => setSelectionContext(null)} className="p-1 hover:bg-white/10 rounded-lg">
                                    <X size={14} />
                                </button>
                            </div>
                        )}

                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="How can I help you today?"
                            className="w-full bg-transparent p-4 pr-16 focus:outline-none min-h-[60px] max-h-48 resize-none scrollbar-hide text-lg"
                            rows={1}
                        />

                        <div className="flex items-center justify-between px-4 pb-3">
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSearch}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-lg transition"
                                    title="Search the web"
                                >
                                    Search
                                </button>
                                <button
                                    onClick={handleImageGen}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs rounded-lg transition"
                                    title="Generate Image"
                                >
                                    Image
                                </button>
                            </div>
                            <button
                                onClick={() => handleSend()}
                                disabled={isLoading || (!input.trim() && !selectionContext)}
                                className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:hover:bg-blue-600 text-white rounded-xl transition-all scale-100 active:scale-95"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                    </div>
                    <p className="text-[10px] text-center mt-4 text-neutral-600 uppercase tracking-widest font-medium">
                        Next-Gen Private AI Architecture
                    </p>
                </div>
            </div>
        </div>
    );
}
