'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useWebSocketEvent } from '@/hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { PaperAirplaneIcon, UserIcon, CpuChipIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  meta?: any;
}

interface ChatInterfaceProps {
  projectId: string;
  project: any;
}

export default function ChatInterface({ projectId, project }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Listen for new chat messages
  useWebSocketEvent('chat:message', (message) => {
    if (message.projectId === projectId) {
      setMessages((prev) => [...prev, message]);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async () => {
    try {
      const response = await api.get(`/projects/${projectId}/chat`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);

    try {
      const response = await api.post(`/projects/${projectId}/chat`, {
        content: userMessage,
      });

      // Replace temp message with actual response
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMessage.id),
        response.data.userMessage,
        response.data.assistantMessage,
      ]);

      // Store generated plan
      if (response.data.plan) {
        setGeneratedPlan(response.data.plan);
        toast.success('Plan generated! Review it in the Plans tab.');
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.response?.data?.error || 'Failed to send message');
      // Remove temp message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMessage.id));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-300px)] bg-white rounded-lg shadow">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <CpuChipIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Start a conversation with the AI agent to generate automation plans
            </p>
            <div className="mt-6">
              <div className="bg-blue-50 rounded-lg p-4 text-left">
                <p className="text-sm font-medium text-blue-900 mb-2">Example prompts:</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• "Navigate to example.com and take a screenshot"</li>
                  <li>• "Fill out the login form on mysite.com"</li>
                  <li>• "Extract all product prices from the homepage"</li>
                  <li>• "Automate clicking through a multi-step form"</li>
                </ul>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex max-w-3xl ${
                  message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                } space-x-3`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    message.role === 'user' ? 'bg-blue-600 ml-3' : 'bg-gray-200'
                  }`}
                >
                  {message.role === 'user' ? (
                    <UserIcon className="h-5 w-5 text-white" />
                  ) : (
                    <CpuChipIcon className="h-5 w-5 text-gray-600" />
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1">
                  <div
                    className={`rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    
                    {/* Plan Preview */}
                    {message.meta?.planPreview && (
                      <div className="mt-3 pt-3 border-t border-blue-500/20">
                        <p className="text-xs font-medium mb-1">Generated Plan Preview:</p>
                        <div className="text-xs space-y-1 opacity-90">
                          <p>• {message.meta.planPreview.taskCount} tasks</p>
                          {message.meta.planPreview.estimatedDuration && (
                            <p>• ~{message.meta.planPreview.estimatedDuration}s estimated</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(message.createdAt))} ago
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                <CpuChipIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="bg-gray-100 rounded-lg px-4 py-3">
                <div className="flex space-x-2">
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                  <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to automate..."
            disabled={loading}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Describe your automation task and the AI will generate an execution plan
        </p>
      </form>
    </div>
  );
}
