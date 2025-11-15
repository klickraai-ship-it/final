import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, User } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/genai';
import { DashboardData } from '../types';
import { marked } from 'marked';

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  data: DashboardData | null;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, data }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { sender: 'ai', text: "Hello! I'm your DeliverAI Assistant. How can I help you with your email deliverability today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversationHistory, setConversationHistory] = useState<string[]>([]);
    const messagesEndRef = useRef<null | HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [messages]);

    const clearConversation = () => {
        setMessages([
            { sender: 'ai', text: "Conversation cleared. How can I help you with your email deliverability?" }
        ]);
        setConversationHistory([]);
    };

    const handleSendMessage = async (prompt?: string) => {
        const userMessage = prompt || input;
        if (!userMessage.trim() || isLoading) return;

        setInput('');
        setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const genAI = new GoogleGenerativeAI(process.env.API_KEY as string);
            const model = genAI.getGenerativeModel({ 
                model: 'gemini-1.5-flash',
                systemInstruction: `You are DeliverAI Assistant, an expert in email deliverability, compliance, and marketing. Your goal is to provide concise, actionable advice based on the user's questions and the provided dashboard data. Be friendly and helpful. Format your responses using markdown. The user's current dashboard data is: ${JSON.stringify(data, null, 2)}`
            });
            
            const response = await model.generateContent(userMessage);

            const result = await response.response;
            const aiResponse = result.text();
            setMessages(prev => [...prev, { sender: 'ai', text: aiResponse }]);

        } catch (error) {
            console.error("Error calling Gemini API:", error);
            setMessages(prev => [...prev, { sender: 'ai', text: "Sorry, I'm having trouble connecting right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    }
    
    const suggestionPrompts = [
        "Explain my Gmail spam rate",
        "How can I fix my DMARC issue?",
        "Why is Outlook performance low?",
        "Suggest a subject line for a new product launch"
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}>
            <div
                className={`fixed top-0 right-0 h-full w-full max-w-lg bg-gray-800 border-l border-gray-700 shadow-xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    <div className="flex items-center">
                        <Bot className="h-6 w-6 text-brand-blue mr-2" />
                        <div>
                            <h2 className="text-lg font-semibold text-white">DeliverAI Assistant</h2>
                            <p className="text-xs text-gray-400">{messages.length - 1} messages</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {messages.length > 1 && (
                            <button 
                                onClick={clearConversation}
                                className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-all min-h-[36px]"
                            >
                                Clear
                            </button>
                        )}
                        <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-700 hover:text-white">
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                    {messages.map((msg, index) => (
                        <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                            {msg.sender === 'ai' && (
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-blue flex items-center justify-center">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                            )}
                            <div className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl ${msg.sender === 'user' ? 'bg-brand-blue text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                                <div className="prose prose-sm prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked.parseSync(msg.text) }} />
                            </div>
                            {msg.sender === 'user' && (
                                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-600 flex items-center justify-center">
                                    <User className="h-5 w-5 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-brand-blue flex items-center justify-center">
                                <Bot className="h-5 w-5 text-white" />
                            </div>
                            <div className="max-w-xs md:max-w-md px-4 py-3 rounded-2xl bg-gray-700 text-gray-200 rounded-bl-none flex items-center space-x-2">
                               <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                   <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                   <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Suggestions */}
                {messages.length <= 1 && !isLoading && (
                    <div className="px-4 pb-2">
                        <div className="grid grid-cols-2 gap-2">
                            {suggestionPrompts.map(prompt => (
                                <button key={prompt} onClick={() => handleSendMessage(prompt)} className="text-left text-sm p-3 min-h-[44px] bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center">
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* Input */}
                <div className="p-4 border-t border-gray-700 bg-gray-800">
                    <div className="relative">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask me anything about your data..."
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-4 pr-12 py-3 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-blue"
                            disabled={isLoading}
                        />
                        <button
                            onClick={() => handleSendMessage()}
                            disabled={isLoading || !input.trim()}
                            className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md bg-brand-blue text-white disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-brand-blue-light transition-colors"
                        >
                            <Send className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;