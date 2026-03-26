# AnxietyTalk — Interactive Platform Design Specification

**Version:** 1.0 | **Date:** 2026-03-26 | **Author:** Michael

---

## 1. Overview

**AnxietyTalk** is a single-page web application designed for church youth sessions focused on anxiety awareness. The platform enables real-time audience interaction through live polling, trivia quizzes, and reaction systems — all synchronized across three distinct views (Admin, Display, User) via Firebase.

### 1.1 Session Context
- **Duration:** ~40 minutes
- **Audience:** 30-50 participants (mobile-first)
- **Flow:** Opening (Canva) → QR Code → Live Polling → Quiz → Leaderboard → Closing (Canva)

---

## 2. Technical Architecture

### 2.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Vanilla JS + HTML/CSS | Lightweight, fast mobile load |
| Real-time Engine | Firebase Realtime Database | Sub-100ms sync, free tier sufficient |
| Database | Firestore | Session state, user data, scores |
| Physics | Matter.js (~100KB) | Bubble collision simulation |
| Hosting | Firebase Hosting | CDN global, free tier |
| Fonts | Google Fonts (Bebas Neue + Inter) | Neo Brutalism aesthetic |

### 2.2 URL Structure

```
https://anxietytalk.web.app/
├── /              → Role selection (Admin / Display / User)
├── /admin         → Admin control panel (password protected)
├── /display       → Display screen for videotron (no auth)
└── /join          → User join page (mobile)
```

### 2.3 Data Model (Firestore)

```
session/
└── current/
      ├── status: "waiting" | "polling" | "quiz" | "leaderboard" | "closed"
      ├── currentQuestionIndex: number
      ├── pollingConfig: { questions[], maxAnswers, maxChars, emojis[] }
      ├── quizConfig: { questions[], currentIndex, timePerQuestion, revealed }
      └── settings: { adminPassword (hashed), maxPollAnswers, emojis[] }

users/
└── {userId}/
      ├── name: string
      ├── deviceId: string
      ├── joinedAt: timestamp
      ├── points: { quiz: number, polling: number, reaction: number, total: number }
      └── answers: { polling: [], quiz: [] }

pollingAnswers/
└── {questionId}/
      └── {answerId}/
            ├── userId: string
            ├── text: string
            └── timestamp

reactions/
└── {timestamp}/
      ├── userId: string
      └── emoji: string

quizAnswers/
└── {questionId}/
      └── {userId}/
            ├── answer: number (0-3)
            ├── isCorrect: boolean
            ├── responseTime: milliseconds
            └── pointsEarned: number
```

### 2.4 Persistence Strategy

- **Device ID:** Generated UUID stored in `localStorage` on first join
- **User matching:** Via `deviceId` — users auto-rejoin with same points
- **Name deduplication:** Auto-append number suffix (e.g., "Michael2")
- **State storage:** All data in Firestore (permanent); `localStorage` only for deviceId cache

---

## 3. User Roles & Authentication

### 3.1 Role Matrix

| Role | URL | Auth | Device |
|------|-----|------|--------|
| Admin | `/admin` | Password (bcrypt hash in Firestore) | Laptop/tablet |
| Display | `/display` | None | Laptop → videotron |
| User | `/join` | None (just name input) | Mobile |

### 3.2 Admin Authentication
- Password stored as bcrypt hash in Firestore `session/current/settings`
- Default password set on first Firebase setup
- Admin can change password from dashboard
- Session stored in `sessionStorage` (clears on tab close)
- Multiple operators can login simultaneously with same password

### 3.3 User Join Flow
```
1. User scans QR code → opens /join
2. User enters name (max 20 chars)
3. System checks name uniqueness → auto-deduplicate with suffix
4. System checks deviceId in localStorage:
   - Exists → restore user with existing points
   - New → create new user
5. User enters session dashboard (mode depends on session status)
```

---

## 4. Feature Specifications

### 4.1 Admin Control Panel

#### 4.1.1 Dashboard
- Session status badge (Waiting/Polling/Quiz/Leaderboard/Closed)
- Mode switcher buttons
- Active user count (real-time)
- QR code display with download button
- Sidebar navigation: Settings, Polling, Quiz, Users

#### 4.1.2 Session Controls
| Action | Behavior |
|--------|----------|
| Start Session | Reset data, open room |
| Switch to Polling | Enable polling mode |
| Switch to Quiz | Enable quiz mode |
| Show Leaderboard | Display final rankings |
| Close Session | End session, freeze scores |
| Reset Session | Clear all data, restart |

#### 4.1.3 Settings Panel
- **Admin password:** Change password form
- **Max poll answers per user:** Number input (default: 3, min: 1)
- **Max chars per answer:** Number input (default: 30, min: 5, max: 100)
- **Emoji reactions:** 5 configurable emoji slots (default: 😰 😤 😢 😅 🙏)
- **Sound effects:** Toggle ON/OFF (future)

#### 4.1.4 Polling Management
- Question list with add/edit/delete
- Question field: text (max 200 chars)
- Navigation: Prev/Next question selector
- Controls: Show Results, Hide Results, Reset Answers

#### 4.1.5 Quiz Management
- Question list with add/edit/delete/reorder
- Per-question fields:
  - Question text (max 250 chars)
  - 4 answer options (max 100 chars each)
  - Correct answer (A/B/C/D dropdown)
  - Timer duration (seconds, default: 20, min: 5, max: 120)
- Quiz controls: Start Question, Reveal Answer, Next Question, End Quiz

#### 4.1.6 User Management
- User table: Name, Device ID (last 4 chars), Total Points, Status
- Kick user button (force disconnect)

### 4.2 Live Polling (Bubble Word Cloud)

#### 4.2.1 User Side
- Header: Active question text
- Input field with character counter (e.g., "12/30")
- Submit button (orange, neo-brutalism)
- Reaction emoji bar (5 buttons)
- Answer counter: "Kamu sudah kirim X dari Y jawaban"
- Disable input when limit reached

#### 4.2.2 Display Screen
- Dark background (#1A1A1A)
- Question text at top (small)
- Full canvas physics simulation (Matter.js)
- Bubbles: uniform size, random neon colors from palette
- Physics: wall bouncing, collision, random initial velocity
- Animation: pop-in (scale 0→1 with bounce) for new bubbles
- Same user = different colored bubbles

#### 4.2.3 Scoring
- 50 points per polling answer submitted

### 4.3 Reaction System

#### 4.3.1 User Side
- 5 emoji buttons always visible at bottom
- No cooldown, can spam
- Visual feedback: emoji briefly appears above button
- +1 point per tap

#### 4.3.2 Display Screen
- Emojis spawn at random bottom positions
- Float upward while fading out
- Slight horizontal wobble (random)
- Object pooling: max 50 active emojis
- Batch render every 500ms

### 4.4 Trivia Quiz (Kahoot-style)

#### 4.4.1 Display Screen

**Phase 1: Question Active**
```
┌─────────────────────────────────────────┐
│  Soal 1 / 5                    ⏱ 00:18   │
│                                         │
│  "Apa yang biasanya dilakukan ketika     │
│   merasa cemas berlebihan?"             │
│                                         │
│  ████████████████░░░░  ← timer bar      │
│                                         │
│  🔺 Menarik diri      🔷 Berbicara      │
│  ⭕ Berdoa            ⬛ Overthinking    │
│                                         │
│        [X orang sudah menjawab]         │
└─────────────────────────────────────────┘
```

**Phase 2: Answer Revealed**
- Correct answer highlighted with glow
- Bar chart showing answer distribution
- Points earned displayed

**Phase 3: Interim Leaderboard**
- Top 5 users with points
- Kahoot-style slide-in animation
- Per-user: rank, name, total points, points from this question

#### 4.4.2 User Side (Mobile)

**Waiting Phase**
- "Bersiap-siap..." with countdown 3-2-1

**Answer Phase**
- Question text (small)
- 4 large buttons with colors + shapes:
  ```
  [🔺 MERAH]    [🔷 BIRU]
  [⭕ HIJAU]     [⬛ KUNING]
  ```
- Selected button highlights, others gray out
- Timer bar at top

**Result Phase**
- Correct: celebration + "BENAR! +X poin"
- Wrong: shake animation + "Ups, salah 😅"
- Shows points earned and response speed

**Time Up:**
- "Waktu habis! ⏰" message
- 0 points

#### 4.4.3 Scoring Formula
```
Base score     = 1000 points
Speed bonus    = 500 × (time_remaining / duration)
Total max      = 1500 points per question

Example: 20-second question, answered at 5 seconds:
1000 + 500 × (15/20) = 1375 points
```

### 4.5 Leaderboard

#### 4.5.1 Point Weights
| Source | Weight | Points |
|--------|--------|--------|
| Quiz correct + fast | High | Max 1500/question |
| Quiz correct + slow | High | Min 1000/question |
| Polling answer | Medium | 50/answer |
| Emoji reaction | Low | 1/tap |

#### 4.5.2 Interim Leaderboard
- Top 5 after each quiz question
- Slide-in animation (300ms stagger)
- Shows rank change indicator

#### 4.5.3 Final Leaderboard
- Full ranking display
- Kahoot-style reveal: bottom to top, winner last
- Confetti burst for winner
- User side: shows personal rank + point breakdown

---

## 5. Design System

### 5.1 Neo Brutalism Style

| Element | Specification |
|---------|--------------|
| Border | 3-4px solid #000000 |
| Shadow | 4px 4px 0px #000000 |
| Border-radius | 4px or 0 |
| Hover | translate(2px, 2px) + shadow shrinks to 2px 2px |

### 5.2 Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| Anxiety Orange | #FF6B2B | Primary, CTA |
| Deep Orange | #E84E0F | Hover states |
| Black | #0D0D0D | Borders, text |
| Off-White | #FFF5E4 | Backgrounds |
| Lemon | #FFE500 | Highlights, badges |
| Hot Pink | #FF3CAC | Secondary accent |
| Lime | #B5FF4D | Correct, success |
| Red | #FF2D2D | Error, wrong |
| Quiz Blue | #2D6AFF | Quiz option B |
| Dark BG | #1A1A1A | Display screen |

### 5.3 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Display header | Bebas Neue | 60-120px | 900 |
| Question header | Bebas Neue | 32-48px | 700 |
| Body text | Inter | 16-20px | 500 |
| Points/numbers | Bebas Neue | 48-80px | 900 |
| Labels | Inter | 12-14px | 600 |

### 5.4 Component Styles

**Primary Button:**
```css
background: #FF6B2B;
border: 3px solid #000;
box-shadow: 4px 4px 0px #000;
border-radius: 4px;
font-weight: 800;
padding: 16px 32px;
transition: all 0.1s ease;
```

**Quiz Answer Buttons:**
- A: #FF2D2D + triangle shape
- B: #2D6AFF + diamond shape
- C: #B5FF4D + circle shape
- D: #FFE500 + square shape

---

## 6. Performance Targets

| Metric | Target |
|--------|--------|
| FCP (mobile) | < 2 seconds |
| TTI (mobile) | < 3 seconds |
| Firebase latency | < 500ms avg |
| Bubble animation | 60fps |
| Concurrent users | 50 (with free tier) |

### Optimization Strategies
- Lazy load Matter.js only on Display page
- Firebase Realtime DB (binary WebSocket) over Firestore for streaming
- Object pooling for emoji animations
- Service Worker for asset caching
- Minimal bundle size (Vanilla JS)

---

## 7. Out of Scope (v1.0)

- Multi-room / simultaneous sessions
- Export PDF/Excel
- Content moderation queue
- Custom branding per session
- Custom backend
- Native mobile apps
- Video/audio streaming
- Analytics/heatmaps

---

## 8. Dependencies

```json
{
  "firebase": "^10.x",
  "matter-js": "^0.19.x"
}
```

---

*This specification is based on PRD.md dated 2026-03-26 and validated through design review.*
