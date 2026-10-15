import React from 'react';
import { ScreenTab } from './Navbar';

interface LandingScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onOpenVoiceWithExample?: (phrase: string) => void;
  onShowToast: (msg: string) => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({
  onNavigate,
  onShowToast,
}) => {
  return (
    <section className="space-y-12">
      {/* HERO SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4 pb-8">
        {/* Left Column Text */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 bg-mint-green border-2 border-ink-brown px-3 py-1.5 rounded-full text-xs font-bold text-leaf-dark shadow-bahi-sm">
            <span>✨ A smarter ledger for small businesses</span>
            <span className="bg-haldi-yellow px-2 py-0.5 rounded-full border border-ink-brown text-[10px]">
              Made for small businesses ❤️
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-ink-brown leading-[1.1] tracking-tight">
            Credit tracking <br />
            <span className="text-tomato-red underline decoration-haldi-yellow decoration-wavy underline-offset-4">
              Without the headache.
            </span>
          </h1>

          <p className="text-lg text-ink-muted font-medium max-w-xl">
            Just speak naturally. Track customers, credit, and payments in your own words. Start with English, Hindi, or Hinglish.
          </p>

          {/* CTA Group */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-6 py-3.5 bg-leaf-green text-cream font-extrabold text-base border-2 border-ink-brown rounded-xl shadow-bahi hover:bg-leaf-dark active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2"
            >
              <span>Open Your Ledger</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('how-it-works');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-5 py-3.5 bg-white text-ink-brown font-bold text-base border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-cream active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-circle-play text-leaf-green"></i>
              <span>See How It Works</span>
            </button>
          </div>

          {/* Handwritten Annotation */}
          <div className="pt-2 flex items-center gap-3">
            <span className="font-handwriting text-2xl text-leaf-green font-bold -rotate-2">
              A clearer view of every transaction.
            </span>
            <i className="fa-solid fa-arrow-turn-down text-leaf-green rotate-45"></i>
          </div>
        </div>

        {/* Right Column Interactive Hero Demo Card */}
        <div className="lg:col-span-6">
          <div className="bg-white border-2 border-ink-brown rounded-2xl p-6 shadow-bahi-lg relative overflow-hidden">
            {/* Red Margin Line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 border-r-2 border-margin-red"></div>

            <div className="pl-6 space-y-5">
              <div className="flex justify-between items-center pb-3 border-b-2 border-notebook-line">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-tomato-red"></span>
                  <span className="w-3 h-3 rounded-full bg-haldi-yellow"></span>
                  <span className="w-3 h-3 rounded-full bg-leaf-green"></span>
                  <span className="text-xs font-extrabold text-ink-muted uppercase tracking-wider ml-2">
                    Voice Ledger Preview
                  </span>
                </div>
                <span className="bg-mint-green text-leaf-dark text-xs font-bold px-2.5 py-1 rounded-md border border-ink-brown">
                  Interactive Demo
                </span>
              </div>

              {/* Voice Input Simulation Box */}
              <div className="bg-cream p-4 rounded-xl border-2 border-ink-brown space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-muted flex items-center gap-1.5">
                    <i className="fa-solid fa-microphone text-tomato-red"></i> Voice Input (Spoken)
                  </span>
                  <span className="text-xs font-handwriting text-xl text-leaf-green font-bold">
                    "Speak in your own words"
                  </span>
                </div>

                <div className="p-3 bg-white rounded-lg border border-ink-brown font-medium text-ink-brown flex items-center justify-between">
                  <span>"Aarav Sharma purchased supplies worth ₹340."</span>
                  <button
                    onClick={() => onShowToast('🔊 Spoken speech: "Aarav Sharma purchased supplies worth ₹340."')}
                    className="text-xs bg-haldi-yellow px-2.5 py-1 rounded border border-ink-brown font-bold hover:bg-yellow-400"
                  >
                    <i className="fa-solid fa-volume-high mr-1"></i>Listen
                  </button>
                </div>
              </div>

              {/* Live AI Review Card */}
              <div className="bg-mint-green/60 p-4 rounded-xl border-2 border-ink-brown space-y-3 relative">
                <div className="absolute -top-3 right-4 bg-haldi-yellow text-ink-brown border border-ink-brown px-2 py-0.5 rounded text-[10px] font-extrabold uppercase">
                  Review Before Saving
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[11px] font-bold text-ink-muted uppercase block">Customer Name</span>
                    <span className="font-bold text-lg text-ink-brown">Aarav Sharma</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-ink-muted uppercase block">Amount</span>
                    <span className="font-extrabold text-lg text-tomato-red">₹340</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-ink-muted uppercase block">Transaction Type</span>
                    <span className="inline-block bg-tomato-red text-white text-xs font-bold px-2 py-0.5 rounded border border-ink-brown">
                      Credit Added
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-ink-muted uppercase block">Confidence</span>
                    <span className="text-xs font-bold text-leaf-green flex items-center gap-1">
                      <i className="fa-solid fa-circle-check"></i> Verified Entity
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-ink-brown/20">
                  <button
                    onClick={() => onNavigate('dashboard')}
                    className="flex-1 py-2 bg-leaf-green text-cream font-bold text-xs rounded-lg border border-ink-brown shadow-bahi-sm hover:bg-leaf-dark"
                  >
                    ✓ Confirm & Save
                  </button>
                  <button
                    onClick={() => onNavigate('voice')}
                    className="px-3 py-2 bg-white text-ink-brown font-bold text-xs rounded-lg border border-ink-brown shadow-bahi-sm hover:bg-cream"
                  >
                    Edit Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEATURE HIGHLIGHTS (3 GRID) */}
      <div className="space-y-6 pt-6">
        <div className="text-center space-y-2">
          <span className="font-handwriting text-3xl text-leaf-green font-bold">Made for Everyday Business</span>
          <h2 className="text-3xl font-extrabold text-ink-brown">Why Choose TalkLedger?</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-white p-6 rounded-2xl border-2 border-ink-brown shadow-bahi space-y-3">
            <div className="w-12 h-12 bg-haldi-yellow rounded-xl border-2 border-ink-brown flex items-center justify-center text-xl text-ink-brown font-bold shadow-bahi-sm">
              <i className="fa-solid fa-microphone-lines"></i>
            </div>
            <h3 className="text-xl font-bold text-ink-brown">Voice-First Entry</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Skip the typing. Speak naturally and review the suggested customer, amount, and due date before saving.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-6 rounded-2xl border-2 border-ink-brown shadow-bahi space-y-3">
            <div className="w-12 h-12 bg-mint-green rounded-xl border-2 border-ink-brown flex items-center justify-center text-xl text-leaf-green font-bold shadow-bahi-sm">
              <i className="fa-brands fa-whatsapp"></i>
            </div>
            <h3 className="text-xl font-bold text-ink-brown">Polite Payment Reminders</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Create polite, editable payment reminders that you can copy and share when you are ready.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white p-6 rounded-2xl border-2 border-ink-brown shadow-bahi space-y-3">
            <div className="w-12 h-12 bg-cream rounded-xl border-2 border-ink-brown flex items-center justify-center text-xl text-tomato-red font-bold shadow-bahi-sm">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
            <h3 className="text-xl font-bold text-ink-brown">Privacy-Conscious by Design</h3>
            <p className="text-sm text-ink-muted leading-relaxed">
              Your ledger gives you clear control over your business records. Persistent SQLite database with paise-level financial precision.
            </p>
          </div>
        </div>
      </div>

      {/* HOW IT WORKS SECTION */}
      <div id="how-it-works" className="bg-cream-card border-2 border-ink-brown rounded-3xl p-8 shadow-bahi-lg space-y-8">
        <div className="text-center space-y-2">
          <span className="font-handwriting text-3xl text-tomato-red font-bold">Aasan 3 Steps</span>
          <h2 className="text-3xl font-extrabold text-ink-brown">How It Works</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Step 1 */}
          <div className="space-y-3 text-center md:text-left relative">
            <div className="w-10 h-10 bg-leaf-green text-cream rounded-full border-2 border-ink-brown flex items-center justify-center font-extrabold text-lg mx-auto md:mx-0 shadow-bahi-sm">
              1
            </div>
            <h4 className="text-lg font-bold text-ink-brown">Mic Button Dabayein</h4>
            <p className="text-sm text-ink-muted">
              Open the app, tap the microphone, and speak naturally as you would during a regular business transaction.
            </p>
          </div>

          {/* Step 2 */}
          <div className="space-y-3 text-center md:text-left relative">
            <div className="w-10 h-10 bg-haldi-yellow text-ink-brown rounded-full border-2 border-ink-brown flex items-center justify-center font-extrabold text-lg mx-auto md:mx-0 shadow-bahi-sm">
              2
            </div>
            <h4 className="text-lg font-bold text-ink-brown">AI Entry Review Karein</h4>
            <p className="text-sm text-ink-muted">
              TalkLedger automatically customer, amount, aur date extract karega. Confirm button dabayein.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-3 text-center md:text-left relative">
            <div className="w-10 h-10 bg-tomato-red text-cream rounded-full border-2 border-ink-brown flex items-center justify-center font-extrabold text-lg mx-auto md:mx-0 shadow-bahi-sm">
              3
            </div>
            <h4 className="text-lg font-bold text-ink-brown">Your Ledger Is Updated!</h4>
            <p className="text-sm text-ink-muted">
              Your entry will be added to the ledger and the balance will update automatically in real time.
            </p>
          </div>
        </div>
      </div>

      {/* PRIVACY SECTION */}
      <div className="bg-mint-green border-2 border-ink-brown rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-bahi">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-leaf-green text-cream rounded-2xl border-2 border-ink-brown flex items-center justify-center text-2xl flex-shrink-0 shadow-bahi-sm">
            <i className="fa-solid fa-lock"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-ink-brown">Your Data, Your Control</h3>
            <p className="text-sm text-ink-muted">
              We do not share your financial ledger or customer phone numbers with anyone. All records are isolated per business account.
            </p>
          </div>
        </div>
        <button
          onClick={() => onNavigate('dashboard')}
          className="px-5 py-2.5 bg-leaf-green text-cream font-bold text-sm border-2 border-ink-brown rounded-xl shadow-bahi-sm hover:bg-leaf-dark whitespace-nowrap"
        >
          Get Started
        </button>
      </div>

      {/* FOOTER */}
      <footer className="pt-8 border-t-2 border-notebook-line flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-ink-muted font-medium">
        <div>
          <span className="font-bold text-ink-brown">TalkLedger</span> © 2026. Made with ❤️ for small businesses.
        </div>
        <div className="flex gap-4">
          <button onClick={() => onShowToast('Privacy Policy: All voice recordings and ledger records are securely stored and never shared.')} className="hover:underline">
            Privacy
          </button>
          <button onClick={() => onShowToast('Terms: Dedicated digital bahi-khata tool for small retail merchants.')} className="hover:underline">
            Terms
          </button>
          <button onClick={() => onShowToast('Support: WhatsApp help line: +91 98765 00000')} className="hover:underline">
            Help & Support
          </button>
        </div>
      </footer>
    </section>
  );
};
