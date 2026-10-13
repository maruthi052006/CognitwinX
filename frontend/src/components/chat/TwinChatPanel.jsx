import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTwinStore } from '../../store/twinStore';
import {
  MessageSquare,
  X,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  Minimize2,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Layers,
  Cpu,
  RefreshCw,
  Globe
} from 'lucide-react';
import Button from '../common/Button';

export default function TwinChatPanel() {
  const { user } = useAuth();
  const { zones, activeZone, setSelectedZoneId } = useTwinStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'init',
      role: 'twin',
      content: "👋 Hello! I am the **Cognitive Digital Twin's Conversational Interface** for Chennai.\n\nI have real-time access to the **6 twin agents** (Sensing, Prediction, Simulation, Explainability, Alert, and Orchestrator). Ask me about water levels, forecast what-if scenarios, compare zone vulnerability, or inquire about historical events.",
      tool_calls_made: [],
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [language, setLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Initialize Speech Recognition if supported in browser
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognizer = new SpeechRecognition();
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.lang = language === 'hi' ? 'hi-IN' : (language === 'ta' ? 'ta-IN' : 'en-IN');

      recognizer.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognizer.onerror = () => {
        setIsListening(false);
      };

      recognizer.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognizer;
    }
  }, [language]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Toggle voice input
  const toggleSpeech = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error('Speech recognition error:', err);
      }
    }
  };

  // Send message handler
  const handleSendMessage = async (textToSend = null) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    setInputValue('');
    const userRole = user?.role || 'ndma_officer';
    const zoneId = activeZone?.id || (zones[0]?.id ?? 1);

    // Optimistically add user message
    const tempUserMsg = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setIsLoading(true);

    try {
      const data = await api.sendChatMessage({
        sessionId,
        message: text,
        zoneId,
        language,
        role: userRole
      });

      if (data.session_id) {
        setSessionId(data.session_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: data.twin_response.id,
          role: 'twin',
          content: data.twin_response.content,
          tool_calls_made: data.twin_response.tool_calls_made || [],
          requires_confirmation: data.twin_response.requires_confirmation,
          confirmation_payload: data.twin_response.confirmation_payload,
          timestamp: data.twin_response.timestamp
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'twin',
          content: `⚠️ Communication error: ${err.message || 'Unable to reach Chat Router Agent.'}`,
          tool_calls_made: [],
          timestamp: new Date().toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Prompt Chips
  const quickPrompts = [
    { label: "🌊 Water level?", prompt: `What is the current flood depth and confidence in ${activeZone?.name || 'Chennai'}?` },
    { label: "📊 Compare zones", prompt: "Compare flood risk and peak depths across all monitored city zones." },
    { label: "🧪 What-If +30% rain", prompt: `Simulate what happens if rainfall increases by +30% in ${activeZone?.name || 'Ward 173'}.` },
    { label: "🧠 Explain risk", prompt: `Explain the model features and SHAP attribution for ${activeZone?.name || 'this zone'}.` },
    { label: "🚨 Trigger alert", prompt: `Send emergency critical flood alert to SDMA for ${activeZone?.name || 'Ward 173'}.` }
  ];

  // Helper for agent badges
  const getBadgeStyle = (agentName) => {
    switch (agentName) {
      case 'Prediction Agent':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
      case 'Simulation Agent':
        return 'bg-purple-950/80 text-purple-300 border-purple-800/80';
      case 'Explainability Agent':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
      case 'Alert Agent':
        return 'bg-red-950/80 text-red-300 border-red-800/80 animate-pulse';
      case 'Orchestrator Agent':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[800] flex flex-col items-end">
      {/* Floating Toggle Bubble (When Closed) */}
      {!isOpen && (
        <Button
          variant="secondary"
          onClick={() => setIsOpen(true)}
          className="relative group flex items-center space-x-2.5 px-4 py-3 rounded-2xl bg-[#0b1329]/90 hover:bg-[#0f1b3d] text-cyan-300 border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.4)] backdrop-blur-xl transition-all duration-300 hover:scale-105"
        >
          <div className="relative">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold text-white tracking-wide">Chat with the Twin</div>
            <div className="text-[10px] text-cyan-400/80 font-mono">Agentic Front Door</div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-700 text-cyan-300 font-mono font-bold">
            7th Agent
          </span>
        </Button>
      )}

      {/* Expanded Chat Window */}
      {isOpen && (
        <div
          className={`flex flex-col glass-panel-glow border border-cyan-500/40 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
            isExpanded
              ? 'w-[94vw] max-w-[800px] h-[85vh]'
              : 'w-[92vw] sm:w-[440px] h-[600px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-950/80 border-b border-cyan-500/20 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-400 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-white text-xs tracking-wide">Cognitive Twin Chat</h3>
                  <span className="inline-flex items-center space-x-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>6 Agents Online</span>
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Context: <strong className="text-cyan-300">{activeZone?.name || 'Basin-Wide'}</strong>
                </div>
              </div>
            </div>

            {/* Controls: Language, Size, Close */}
            <div className="flex items-center space-x-1.5">
              {/* Language Selector */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-slate-900 border border-cyan-500/30 text-cyan-300 text-[10px] rounded-lg px-2 py-1 outline-none cursor-pointer hover:border-cyan-400"
                title="Select language"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
              </select>

              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Minimize Window' : 'Expand Window'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </Button>

              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setIsOpen(false)}
                className="hover:text-red-400 hover:bg-red-500/10"
                title="Close Chat"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 bg-slate-900/50 border-b border-cyan-500/10 flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
            {quickPrompts.map((qp, idx) => (
              <Button
                key={idx}
                variant="chip"
                size="chip"
                onClick={() => handleSendMessage(qp.prompt)}
              >
                {qp.label}
              </Button>
            ))}
          </div>

          {/* Messages Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 selection:bg-cyan-500 selection:text-black">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                >
                  <div className="flex items-center space-x-1.5 text-[9px] text-slate-400 px-1">
                    {isUser ? (
                      <>
                        <span>{user?.username || 'You'} ({user?.role ? user.role.replace('_', ' ') : 'Officer'})</span>
                        <User className="w-3 h-3 text-cyan-400" />
                      </>
                    ) : (
                      <>
                        <Bot className="w-3 h-3 text-cyan-400" />
                        <span className="font-semibold text-cyan-300">CognitwinX</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isUser
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none shadow-lg'
                        : 'bg-slate-900/90 text-slate-200 border border-slate-700/80 rounded-tl-none shadow-md backdrop-blur-md'
                    }`}
                  >
                    {/* Message Content (supports markdown linebreaks and bold) */}
                    <div className="whitespace-pre-line space-y-1">
                      {m.content}
                    </div>

                    {/* Multi-Agent Transparency Badges */}
                    {m.tool_calls_made && m.tool_calls_made.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5">
                        {m.tool_calls_made.map((tc, idx) => (
                          <span
                            key={idx}
                            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border ${getBadgeStyle(
                              tc.agent
                            )}`}
                          >
                            <span>⚡</span>
                            <span>via {tc.agent}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Inline Confirmation Prompts for Critical Actions */}
                    {m.requires_confirmation && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2">
                        <div className="flex items-center space-x-1.5 text-amber-300 text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span>Explicit Confirmation Required</span>
                        </div>
                        <p className="text-[10px] text-slate-300">
                          This will dispatch an official emergency broadcast to State Disaster Management Authority (SDMA).
                        </p>
                        <div className="flex items-center space-x-2 pt-1">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSendMessage('Yes, confirm alert dispatch')}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 shadow-md flex items-center justify-center space-x-1"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            <span>Confirm & Send Alert</span>
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleSendMessage('No, cancel alert')}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking Animation */}
            {isLoading && (
              <div className="flex items-start space-x-2 text-xs text-slate-400 py-1">
                <div className="p-1 rounded bg-cyan-500/20 text-cyan-400">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                <div className="px-3.5 py-2 rounded-2xl bg-slate-900 border border-cyan-500/30 flex items-center space-x-2">
                  <span className="text-[11px] text-cyan-300 font-mono">Twin is routing across agents...</span>
                  <div className="flex space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="p-3 bg-slate-950 border-t border-cyan-500/20 flex flex-col space-y-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center space-x-2"
            >
              {/* Voice Input Toggle */}
              {speechSupported && (
                <Button
                  type="button"
                  variant={isListening ? 'danger' : 'ghost'}
                  size="icon"
                  onClick={toggleSpeech}
                  className={`rounded-xl border ${
                    isListening
                      ? 'animate-pulse'
                      : 'border-slate-700 hover:border-cyan-500'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Voice Input (Web Speech API)'}
                >
                  {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                </Button>
              )}

              {/* Text Input */}
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  isListening
                    ? 'Listening... speak now'
                    : 'Ask the twin (e.g., "Water depth in Ward 173?", "Simulate +20% rain")...'
                }
                className="flex-1 bg-slate-900/90 border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all shadow-inner"
              />

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="icon"
                disabled={!inputValue.trim() || isLoading}
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>

            <div className="flex items-center justify-between text-[9px] text-slate-500 px-1 font-mono">
              <span>Strict Data Grounding: Cites actual sensor/model values</span>
              <span>Confirm-Before-Alert enforced</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
