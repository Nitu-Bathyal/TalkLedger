# TalkLedger — 60-Second Video Demonstration

> **DEV Hackathon / Hacktoberfest 2026 Side Hustle Track**  
> **Official Final Demo Video:** `talkledger-demo-final.mp4` (Duration: Exactly 60.00s | 1080p Full HD | 30 FPS | Clean No-Subtitle Edition)  
> **Original Backup Video:** `talkledger-demo.mp4`  
> **Live Web Application:** [https://talkledger-4.onrender.com](https://talkledger-4.onrender.com)  
> **GitHub Repository:** [https://github.com/Nitu-Bathyal/TalkLedger](https://github.com/Nitu-Bathyal/TalkLedger)  

---

## 📺 Video Overview

This demo video was produced to demonstrate **TalkLedger**, a voice-first digital udhaar ledger designed specifically for Indian micro-merchants, neighborhood kirana stores, and independent tradespeople.

Instead of losing uncollected dues in dog-eared paper notebooks (*bahi-khata*), shopkeepers can record credit in seconds using spoken Hindi, Hinglish, or English, while retaining 100% control through an explicit human-in-the-loop confirmation guard before database writes.

---

## ⏱️ Scene Breakdown (Exact 60.00-Second Timeline)

| Scene | Duration | Timestamp | Content & Feature Highlight |
| :--- | :--- | :--- | :--- |
| **1. The Problem** | 8.0s | `0:00 – 0:08` | Traditional Indian red-cloth paper bahi-khata with crossed-out entries, overdue dues, and calculation hassles. |
| **2. Welcome & Dashboard** | 8.0s | `0:08 – 0:16` | Bahi-khata visual identity (`#FAF7EE` cream, `#1B4332` leaf green), Sharma General Store dashboard metrics (`₹2,590` total outstanding). |
| **3. Customer Ledger** | 13.0s | `0:16 – 0:29` | Customer directory (Ramesh Kumar, Aarav Sharma, Anita Tailor), transparent balances, and timeline transaction history. |
| **4. Voice Entry & Guard** | 12.0s | `0:29 – 0:41` | Spoken phrase `"Ramesh ko 500 rupaye udhaar diye"`, high-confidence NLP extraction, and explicit confirmation review guard. |
| **5. Technical Rigor** | 10.0s | `0:41 – 0:51` | React 18, Vite, Express, Prisma ORM, 42/42 automated tests passing, 100% strict TypeScript, integer paise math. |
| **6. Closing & CTA** | 9.0s | `0:51 – 1:00` | Branded closing title card with GitHub repository and live Render deployment links. |

---

## 🎨 Cultural & Visual Identity

The interface and video aesthetic are modeled after traditional Indian ledger books (*Bahi-Khata*):
- **Base Background:** Warm cream paper texture (`#FAF7EE`)
- **Brand Primary:** Deep leaf green (`#1B4332`)
- **Accent Badges:** Haldi yellow (`#E9A820`)
- **Dues / Warnings:** Tomato red (`#D62828` / `#991B1B`)
- **Contrast / Type:** Dark charcoal brown (`#2B1810`)

---

## 🛠️ Video Production Specifications

- **File:** `demo-video/talkledger-demo.mp4`
- **Container:** MP4 (ISO Base Media)
- **Video Stream:** H.264 (High Profile, Level 4.2), 1920×1080 (16:9), 30.00 fps progressive, YUV420p
- **Audio Stream:** AAC-LC, 48 kHz stereo, 192 kbps
- **Narration:** Windows SAPI Speech Synthesis (Microsoft Zira, US English, professional tone)
- **Background Music:** Synthesized warm acoustic ambient chords ducked at -18dB under narration
- **Captions:** Hardcoded burned-in subtitles with high-contrast pill styling
- **Duration:** Exactly 60.00 seconds (verified via `ffprobe`)

---

## 🔍 Feature Verification & AI Honesty

In strict compliance with open-source hackathon standards:
1. **Real Data:** The customers and transaction balances shown (Ramesh Kumar ₹500, Aarav Sharma ₹1,240, Anita Tailor ₹850, total ₹2,590) are real records from the local SQLite store ledger (`server/prisma/dev.db`).
2. **Real NLP Voice Extraction:** Spoken input parsing (`/api/voice/parse`) is a real, functional rule-based parser that maps Hindi/Hinglish quantity, entity, and direction tokens to structured transaction drafts.
3. **Transparent Model Status:** Google Gemma 2 and TabPFN integration endpoints are transparently presented with their current configuration status (`OFFLINE RULE ENGINE`), avoiding synthetic or fabricated responses.

---

## 🚀 Running the Project Locally

```bash
# Clone the repository
git clone https://github.com/Nitu-Bathyal/TalkLedger.git
cd TalkLedger

# Install dependencies
npm run install:all

# Run automated test suite (42 tests)
npm test

# Start local development server (SQLite)
npm run start
```
