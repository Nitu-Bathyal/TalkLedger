import React, { useState, useEffect, useRef } from 'react';
import { Customer, VoiceParseResult } from '../shared/types';
import { api } from '../services/api';

interface VoiceScreenProps {
  customers: Customer[];
  onTransactionSaved: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const VoiceScreen: React.FC<VoiceScreenProps> = ({
  customers,
  onTransactionSaved,
  onShowToast,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState<'Hindi' | 'Hinglish' | 'English'>('English');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('Click the microphone or choose an example below:');
  const [rawTranscript, setRawTranscript] = useState('');
  const [manualFallbackText, setManualFallbackText] = useState('');
  const [hasSpeechSupport, setHasSpeechSupport] = useState(true);

  // Extracted preview state
  const [preview, setPreview] = useState<VoiceParseResult | null>(null);

  const [, setFormCustName] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formType, setFormType] = useState<'CREDIT' | 'PAYMENT'>('CREDIT');
  const [formDueDate, setFormDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDesc, setFormDesc] = useState('');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Feature detection for Web Speech API
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setHasSpeechSupport(false);
      setStatusText('Speech recognition is not supported in this browser. Please use the text input below.');
    }
  }, []);

  // Sync form inputs when preview changes
  const updateFormFromParsedResult = (res: VoiceParseResult) => {
    setPreview(res);
    setFormCustName(res.customerName || '');
    setFormCustomerId(res.matchedCustomerId || '');
    setFormAmount(res.amount !== null ? res.amount : '');
    setFormType(res.transactionType || 'CREDIT');
    setFormDueDate(res.dueDate || new Date().toISOString().split('T')[0]);
    setFormDesc(res.description || res.rawTranscript || 'Voice entry');

    // If customer name was extracted, try finding in existing customer list
    if (res.customerName && !res.matchedCustomerId) {
      const match = customers.find(
        (c) => c.name.toLowerCase() === res.customerName?.toLowerCase()
      );
      if (match) {
        setFormCustomerId(match.id);
      }
    }
  };

  const handleProcessTranscript = async (transcript: string) => {
    const clean = transcript.trim();
    if (!clean) {
      onShowToast('Please speak or type a transaction phrase.', 'info');
      return;
    }

    setRawTranscript(clean);
    setManualFallbackText(clean); // Preserve in fallback box for easy editing/retry
    setIsProcessing(true);
    setStatusText(`Processing speech: "${clean}"...`);

    try {
      const result = await api.parseVoice(clean);
      updateFormFromParsedResult(result);

      if (result.clarificationNeeded) {
        onShowToast(result.clarificationReason || 'Review required: some details were unclear.', 'info');
        setStatusText(result.clarificationReason || 'Review and edit the extracted details before saving.');
      } else {
        onShowToast('✓ Speech extracted! Review and confirm to save.', 'success');
        setStatusText(`Captured: "${clean}"`);
      }
    } catch (err: any) {
      onShowToast(err.message || 'Failed to process voice text', 'error');
      setStatusText('Failed to process speech. You can edit the form manually below.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startVoiceRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      onShowToast('Speech Recognition is not available in this browser. Please use text entry.', 'info');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;

      // Set recognition language
      if (selectedLanguage === 'Hindi') {
        recognition.lang = 'hi-IN';
      } else if (selectedLanguage === 'Hinglish') {
        recognition.lang = 'en-IN';
      } else {
        recognition.lang = 'en-IN';
      }

      recognition.onstart = () => {
        setIsRecording(true);
        setStatusText('Listening... Speak naturally.');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        setIsRecording(false);
        setManualFallbackText(transcript);
        if (transcript.trim()) {
          handleProcessTranscript(transcript);
        } else {
          setStatusText('No speech detected. Please tap the mic and try again.');
          onShowToast('No speech was detected. Please try again or type below.', 'info');
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsRecording(false);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setStatusText('Microphone permission denied. Please allow microphone access in your browser or type details below.');
          onShowToast('Microphone access was denied in browser permissions.', 'error');
        } else if (event.error === 'no-speech') {
          setStatusText('No speech detected. Please tap the mic and speak clearly.');
        } else if (event.error === 'network') {
          setStatusText('Network error with speech service. Please check your internet or use text input below.');
          onShowToast('Speech recognition service encountered a network error.', 'error');
        } else if (event.error === 'audio-capture') {
          setStatusText('No microphone detected. Please check your microphone connection or use text input below.');
          onShowToast('No microphone found on this device.', 'error');
        } else if (event.error === 'aborted') {
          setStatusText('Listening paused.');
        } else {
          setStatusText(`Speech error (${event.error}). Please use text fallback below.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch (err: any) {
      console.error(err);
      setIsRecording(false);
      setStatusText('Could not access microphone. Please type your entry below.');
    }
  };

  const stopVoiceRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setStatusText('Recording stopped.');
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formCustomerId) {
      onShowToast('Please select or add a customer to link this entry.', 'error');
      return;
    }

    if (!formAmount || formAmount <= 0) {
      onShowToast('Please specify a positive transaction amount.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await api.createTransaction({
        customerId: formCustomerId,
        type: formType,
        amount: Number(formAmount),
        description: formDesc || 'Voice entry',
        dueDate: formDueDate || undefined,
        source: 'VOICE',
        paymentMode: formType === 'PAYMENT' ? 'CASH' : undefined,
      });

      const matchedCust = customers.find((c) => c.id === formCustomerId);
      onShowToast(`✓ Ledger updated for ${matchedCust?.name || 'Customer'} (₹${formAmount})!`, 'success');
      onTransactionSaved();
    } catch (err: any) {
      onShowToast(err.message || 'Failed to save transaction', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 bg-haldi-yellow border border-ink-brown px-3 py-1 rounded-full text-xs font-bold text-ink-brown">
          <i className="fa-solid fa-wand-magic-sparkles"></i> AI Powered Voice Recognition
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-brown">Speak. Review. Save.</h1>
        <p className="text-sm text-ink-muted">Speak naturally in your shop dialect. AI automatically fills the ledger.</p>
      </div>

      {/* Language Pill Selection */}
      <div className="flex justify-center gap-2">
        {(['Hindi', 'Hinglish', 'English'] as const).map((lang) => (
          <button
            key={lang}
            onClick={() => {
              setSelectedLanguage(lang);
              onShowToast(`Speech language set to ${lang}`, 'info');
            }}
            className={`px-4 py-1.5 rounded-full border-2 border-ink-brown font-bold text-xs shadow-bahi-sm transition-all ${
              selectedLanguage === lang ? 'bg-leaf-green text-cream' : 'bg-white text-ink-brown hover:bg-cream'
            }`}
          >
            {lang === 'English' ? '🌐 English' : lang}
          </button>
        ))}
      </div>

      {/* Voice Recording Canvas Box */}
      <div className="bg-white border-2 border-ink-brown rounded-3xl p-8 shadow-bahi-lg text-center space-y-6 relative overflow-hidden">
        {/* Handwritten note */}
        <span className="absolute top-4 right-6 font-handwriting text-2xl text-leaf-green font-bold -rotate-3 hidden sm:block">
          Try speaking now! 🎙️
        </span>

        {/* Giant Mic Button with Wave Ring */}
        <div className="relative py-4 flex justify-center items-center">
          {isRecording && (
            <div className="absolute w-48 h-48 rounded-full bg-tomato-red/20 wave-ring"></div>
          )}

          <button
            onClick={toggleRecording}
            disabled={isProcessing}
            className={`relative z-10 w-28 h-28 text-white border-4 border-ink-brown rounded-full flex flex-col items-center justify-center shadow-bahi hover:scale-105 active:scale-95 transition-all ${
              isRecording ? 'bg-red-700 animate-pulse' : 'bg-tomato-red'
            } ${isProcessing ? 'opacity-50 cursor-wait' : ''}`}
          >
            <i className={`fa-solid ${isRecording ? 'fa-stop' : 'fa-microphone'} text-4xl`}></i>
            <span className="text-[10px] uppercase font-extrabold tracking-wider mt-1">
              {isRecording ? 'LISTENING...' : isProcessing ? 'PROCESSING...' : 'TAP TO SPEAK'}
            </span>
          </button>
        </div>

        {/* Animated Waveforms (Shown while recording) */}
        {isRecording && (
          <div className="flex items-center justify-center gap-1.5 h-10">
            <div className="w-1.5 bg-tomato-red rounded-full sound-bar" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-1.5 bg-tomato-red rounded-full sound-bar" style={{ animationDelay: '0.3s' }}></div>
            <div className="w-1.5 bg-tomato-red rounded-full sound-bar" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-1.5 bg-tomato-red rounded-full sound-bar" style={{ animationDelay: '0.4s' }}></div>
            <div className="w-1.5 bg-tomato-red rounded-full sound-bar" style={{ animationDelay: '0.15s' }}></div>
          </div>
        )}

        {/* Status text */}
        <div className="text-sm font-bold text-ink-muted">
          {statusText}
        </div>

        {/* Text Fallback Input Box */}
        <div className="pt-2 border-t border-notebook-line">
          <div className="flex gap-2 max-w-lg mx-auto">
            <input
              type="text"
              value={manualFallbackText}
              onChange={(e) => setManualFallbackText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualFallbackText.trim()) {
                  handleProcessTranscript(manualFallbackText);
                }
              }}
              placeholder="Or type speech e.g. Ramesh Kumar owes 500 rupees..."
              className="flex-1 px-3 py-2 bg-cream border-2 border-ink-brown rounded-xl text-xs font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
            />
            <button
              onClick={() => {
                if (manualFallbackText.trim()) {
                  handleProcessTranscript(manualFallbackText);
                }
              }}
              className="px-4 py-2 bg-leaf-green text-cream font-bold text-xs rounded-xl border border-ink-brown hover:bg-leaf-dark"
            >
              Parse
            </button>
          </div>
          {!hasSpeechSupport && (
            <span className="text-[11px] text-tomato-red font-semibold block mt-1">
              (Web Speech API unavailable in this browser; text parsing works 100% offline)
            </span>
          )}
        </div>

        {/* Sample Clickable Spoken Phrase Chips */}
        <div className="space-y-2 pt-2 border-t border-notebook-line">
          <span className="text-xs font-bold text-ink-muted uppercase block">Try an example:</span>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => handleProcessTranscript('Ramesh Kumar has ₹500 outstanding and will pay next Friday.')}
              className="text-xs bg-cream hover:bg-haldi-yellow border border-ink-brown font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              "Ramesh Kumar has ₹500 outstanding and will pay next Friday."
            </button>
            <button
              onClick={() => handleProcessTranscript('Aarav Sharma paid ₹1,200 in cash.')}
              className="text-xs bg-cream hover:bg-haldi-yellow border border-ink-brown font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              "Aarav Sharma paid ₹1,200 in cash."
            </button>
            <button
              onClick={() => handleProcessTranscript('Anita Tailor received fabric worth ₹850 on credit.')}
              className="text-xs bg-cream hover:bg-haldi-yellow border border-ink-brown font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              "Anita Tailor received fabric worth ₹850 on credit."
            </button>
          </div>
        </div>
      </div>

      {/* Extraction Review Form (Editable Preview) */}
      <div className="bg-mint-green/80 border-2 border-ink-brown rounded-2xl p-6 shadow-bahi space-y-4">
        <div className="flex items-center justify-between border-b-2 border-ink-brown/20 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-leaf-green"></span>
            <h3 className="font-extrabold text-lg text-ink-brown">Extracted Transaction Preview</h3>
          </div>
          <span className="text-xs font-bold bg-white px-2.5 py-1 rounded border border-ink-brown text-leaf-dark">
            Please verify before saving
          </span>
        </div>

        {/* Clarification Alert if ambiguous */}
        {preview?.clarificationNeeded && (
          <div className="bg-haldi-yellow/40 border border-ink-brown p-3 rounded-xl flex items-start gap-2.5 text-xs font-bold text-ink-brown">
            <i className="fa-solid fa-triangle-exclamation text-tomato-red text-sm mt-0.5"></i>
            <div>
              <span className="font-extrabold">Clarification Note: </span>
              {preview.clarificationReason}
            </div>
          </div>
        )}

        <form onSubmit={handleConfirmSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Select Customer Account
            </label>
            <select
              value={formCustomerId}
              onChange={(e) => {
                setFormCustomerId(e.target.value);
                const matched = customers.find((c) => c.id === e.target.value);
                if (matched) setFormCustName(matched.name);
              }}
              required
              className="w-full px-3 py-2 bg-white border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
            >
              <option value="">-- Choose from your ledger --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''} - Bal: ₹{(c.balancePaise / 100).toLocaleString('en-IN')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Amount (₹)
            </label>
            <input
              type="number"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value === '' ? '' : Number(e.target.value))}
              required
              min="1"
              step="any"
              className="w-full px-3 py-2 bg-white border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Transaction Type
            </label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as 'CREDIT' | 'PAYMENT')}
              className="w-full px-3 py-2 bg-white border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
            >
              <option value="CREDIT">Credit Added (Udhaar +)</option>
              <option value="PAYMENT">Payment Received (Paid −)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Due Date / Promise Date
            </label>
            <input
              type="date"
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-white border-2 border-ink-brown rounded-xl text-sm font-bold text-ink-brown focus:outline-none focus:ring-2 focus:ring-leaf-green"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase text-ink-muted mb-1">
              Items / Description Note
            </label>
            <input
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="e.g. Flour, groceries, UPI settlement"
              className="w-full px-3 py-2 bg-white border-2 border-ink-brown rounded-xl text-sm text-ink-brown"
            />
          </div>

          {rawTranscript && (
            <div className="sm:col-span-2 text-xs text-ink-muted bg-white/60 p-2 rounded-lg border border-ink-brown/20">
              <span className="font-bold">Raw Speech:</span> "{rawTranscript}"
            </div>
          )}

          <div className="sm:col-span-2 flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className={`flex-1 py-3 bg-leaf-green text-cream font-extrabold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark active:translate-y-0.5 transition-all ${
                isSaving ? 'opacity-50 cursor-wait' : ''
              }`}
            >
              {isSaving ? 'Saving to Ledger...' : '✓ Confirm & Save to Ledger'}
            </button>
            <button
              type="button"
              onClick={toggleRecording}
              className="px-5 py-3 bg-white text-ink-brown font-bold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-cream"
            >
              Record Again
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
