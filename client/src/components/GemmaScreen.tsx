import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '../shared/types';
import { api } from '../services/api';

interface GemmaScreenProps {
  customers: Customer[];
  onDataChanged: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  preview?: {
    actionType: 'TRANSACTION' | 'CUSTOMER';
    requiresConfirmation: true;
    data: any;
    summaryText: string;
  } | null;
  timestamp: string;
}

export const GemmaScreen: React.FC<GemmaScreenProps> = ({ onDataChanged, onShowToast }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Namaste! I am your TalkLedger assistant powered by Google Gemma 2 (Open Weights). You can ask me questions about your ledger balances, collections today, or ask me to prepare a transaction or customer ledger for you.',
      model: 'gemma2-9b-it',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);

  // Gemma Provider Status
  const [status, setStatus] = useState<{
    configured: boolean;
    provider: string;
    model: string;
    status: string;
    message: string;
    instructions: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getGemmaStatus()
      .then(setStatus)
      .catch((err) => console.warn('Failed to fetch Gemma status:', err));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputPrompt).trim();
    if (!text || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role, content: m.content }));
      const res = await api.sendGemmaChat(text, history);

      const assistantMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.message,
        model: res.model,
        preview: res.preview,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      onShowToast(err.message || 'Failed to communicate with Gemma assistant', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Speech Recognition for Voice Chat
  const toggleVoiceRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast('Speech Recognition not supported in this browser. Please type below.', 'info');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        onShowToast('Listening... Speak naturally to Gemma', 'info');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript;
        setIsRecording(false);
        if (transcript) {
          setInputPrompt(transcript);
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Gemma speech error:', event.error);
        setIsRecording(false);
        onShowToast(`Speech recognition error (${event.error})`, 'error');
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err: any) {
      console.error(err);
      setIsRecording(false);
      onShowToast('Could not access microphone', 'error');
    }
  };

  // Speech Synthesis (Text-to-Speech)
  const speakText = (text: string, msgId: string) => {
    if (!('speechSynthesis' in window)) {
      onShowToast('Text-to-speech not supported in this browser', 'info');
      return;
    }

    if (isSpeaking === msgId) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#_>`]/g, '').replace(/₹/g, 'Rupees ');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-IN';
    utterance.rate = 1.0;

    utterance.onend = () => setIsSpeaking(null);
    utterance.onerror = () => setIsSpeaking(null);

    setIsSpeaking(msgId);
    window.speechSynthesis.speak(utterance);
  };

  // Explicit confirmation handler
  const handleConfirmAction = async (msgId: string, preview: NonNullable<Message['preview']>) => {
    setIsConfirming(true);
    try {
      const res = await api.confirmGemmaAction(preview.actionType, preview.data);
      onShowToast(res.message, 'success');
      onDataChanged();

      // Update message to remove preview and show confirmed state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                preview: null,
                content: `${m.content}\n\n**✓ Action Confirmed & Saved to Ledger**: ${res.message}`,
              }
            : m
        )
      );
    } catch (err: any) {
      onShowToast(err.message || 'Failed to save confirmed action', 'error');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleDismissPreview = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId ? { ...m, preview: null, content: `${m.content}\n\n*(Preview cancelled)*` } : m
      )
    );
    onShowToast('Action cancelled', 'info');
  };

  return (
    <section className="max-w-4xl mx-auto space-y-5 animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="bg-white border-2 border-ink-brown rounded-3xl p-5 shadow-bahi-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 bg-leaf-green text-cream px-3 py-1 rounded-full text-xs font-extrabold shadow-sm">
            <i className="fa-solid fa-sparkles"></i>
            <span>Google Gemma 2 (Open Weights)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-brown">Conversational Shop Assistant</h1>
          <p className="text-xs text-ink-muted">
            Ask natural questions about your balances, debtors, or tell Gemma to prepare new entries.
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex flex-col items-start md:items-end text-xs">
          <div className="flex items-center gap-1.5 font-bold">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status?.configured ? 'bg-leaf-green animate-pulse' : 'bg-tomato-red'
              }`}
            ></span>
            <span className="text-ink-brown uppercase tracking-wider text-[11px] font-extrabold">
              Model: {status?.model || 'gemma2-9b-it'}
            </span>
          </div>
          <span className="text-[11px] text-ink-muted">
            Provider:{' '}
            <strong className="text-leaf-dark uppercase">
              {status?.provider === 'unconfigured' ? 'Offline Rule Engine' : status?.provider || 'Groq LPU'}
            </strong>
          </span>
        </div>
      </div>

      {/* Model Setup Notice if Unconfigured */}
      {status && !status.configured && (
        <div className="bg-haldi-yellow/30 border-2 border-ink-brown rounded-2xl p-4 shadow-bahi-sm text-xs text-ink-brown space-y-2">
          <div className="flex items-center gap-2 font-extrabold text-sm">
            <i className="fa-solid fa-circle-info text-tomato-red"></i>
            <span>Gemma 2 Setup Guide (Best Use of Gemma Sponsor Prize)</span>
          </div>
          <p className="text-ink-muted leading-relaxed">
            The assistant is currently running with the local factual ledger query engine. To connect a live Google
            Gemma 2 open-weight model:
          </p>
          <div className="bg-white/80 p-3 rounded-xl border border-ink-brown/30 font-mono text-[11px] space-y-1">
            <div>
              1. <strong>Groq Cloud (Free, ultra-fast)</strong>: Set <code className="text-tomato-red">GROQ_API_KEY</code> in server <code className="text-tomato-red">.env</code> (Free at console.groq.com)
            </div>
            <div>
              2. <strong>Hugging Face Serverless</strong>: Set <code className="text-tomato-red">HF_TOKEN</code> with access to <code className="text-leaf-dark">google/gemma-2-9b-it</code>
            </div>
            <div>
              3. <strong>Local Ollama</strong>: Run <code className="text-leaf-dark">ollama run gemma2:2b</code> and set <code className="text-tomato-red">GEMMA_API_BASE_URL="http://localhost:11434/v1"</code>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages Container */}
      <div className="bg-white border-2 border-ink-brown rounded-3xl p-5 shadow-bahi-lg h-[460px] flex flex-col justify-between">
        <div className="overflow-y-auto space-y-4 pr-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-center gap-2 text-[10px] text-ink-muted font-bold px-1">
                <span>{m.role === 'user' ? '👤 Shopkeeper' : '🤖 Gemma 2 Assistant'}</span>
                <span>•</span>
                <span>{m.timestamp}</span>
                {m.model && <span className="bg-cream px-1.5 py-0.5 rounded border border-ink-brown/20 font-mono text-[9px]">{m.model}</span>}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-4 text-xs font-medium border-2 border-ink-brown shadow-bahi-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-haldi-yellow text-ink-brown rounded-tr-none'
                    : 'bg-cream text-ink-brown rounded-tl-none'
                }`}
              >
                {m.content}

                {/* Speak button for assistant responses */}
                {m.role === 'assistant' && (
                  <div className="pt-2 mt-2 border-t border-ink-brown/15 flex items-center gap-2">
                    <button
                      onClick={() => speakText(m.content, m.id)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border border-ink-brown flex items-center gap-1 transition-all ${
                        isSpeaking === m.id ? 'bg-tomato-red text-white' : 'bg-white text-ink-brown hover:bg-haldi-yellow'
                      }`}
                    >
                      <i className={`fa-solid ${isSpeaking === m.id ? 'fa-stop' : 'fa-volume-high'}`}></i>
                      <span>{isSpeaking === m.id ? 'Stop Speaking' : 'Listen'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action Confirmation Preview Card */}
              {m.preview && (
                <div className="w-full max-w-md bg-mint-green border-2 border-ink-brown rounded-2xl p-4 shadow-bahi text-xs space-y-3 mt-1 animate-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-ink-brown/20 pb-2">
                    <span className="font-extrabold text-ink-brown flex items-center gap-1.5">
                      <i className="fa-solid fa-clipboard-check text-leaf-green"></i>
                      <span>Confirmation Required</span>
                    </span>
                    <span className="bg-white px-2 py-0.5 rounded text-[10px] font-bold border border-ink-brown">
                      {m.preview.actionType}
                    </span>
                  </div>

                  <div className="space-y-1 text-ink-brown">
                    <div className="font-bold">{m.preview.summaryText}</div>
                    <div className="text-[11px] text-ink-muted">
                      Please confirm to post this directly to the ledger. Gemma will never commit financial changes without your explicit approval.
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleConfirmAction(m.id, m.preview!)}
                      disabled={isConfirming}
                      className="flex-1 py-2 bg-leaf-green text-cream font-extrabold rounded-xl border border-ink-brown shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5 transition-all text-xs"
                    >
                      {isConfirming ? 'Saving...' : '✓ Confirm & Save to Ledger'}
                    </button>
                    <button
                      onClick={() => handleDismissPreview(m.id)}
                      disabled={isConfirming}
                      className="px-3 py-2 bg-white text-ink-brown font-bold rounded-xl border border-ink-brown hover:bg-cream text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-bold text-ink-muted p-2">
              <span className="w-2 h-2 rounded-full bg-leaf-green animate-ping"></span>
              <span>Gemma is analyzing your ledger...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="pt-2 border-t border-notebook-line">
          <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {[
              'Who owes the most in my shop?',
              'How much did we collect today?',
              'Give me an overview of my ledger.',
              'Show recent transactions.',
              'Anita Tailor owes 400 rupees.',
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSendMessage(chip)}
                className="whitespace-nowrap px-2.5 py-1 bg-cream hover:bg-haldi-yellow border border-ink-brown rounded-lg text-[11px] font-bold text-ink-brown transition-colors shadow-sm"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input & Voice Controls */}
          <div className="flex gap-2 items-center pt-1">
            <button
              onClick={toggleVoiceRecording}
              className={`w-10 h-10 rounded-xl border-2 border-ink-brown flex items-center justify-center font-bold text-sm shadow-bahi-sm transition-all ${
                isRecording ? 'bg-tomato-red text-white animate-pulse' : 'bg-haldi-yellow text-ink-brown hover:bg-yellow-400'
              }`}
              title="Click to speak your question"
            >
              <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
            </button>

            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask Gemma about balances, collections, or say 'Aarav owes ₹300'..."
              className="flex-1 px-4 py-2.5 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputPrompt.trim()}
              className="px-4 py-2.5 bg-leaf-green text-cream font-extrabold text-xs rounded-xl border-2 border-ink-brown shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5 disabled:opacity-50 transition-all"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
