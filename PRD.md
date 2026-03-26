# PRD — AnxietyTalk Interactive Platform
### Interactive Church Youth Session Web App
**Versi:** 1.0 | **Tanggal:** 26 Maret 2026 | **Author:** Michael

---

## 1. Executive Summary

**AnxietyTalk** adalah sebuah web application satu halaman (single-page web app) yang dirancang khusus untuk mendukung sesi sharing pemuda gereja bertema *anxiety* selama ±40 menit. Website ini terinspirasi dari karakter Anxiety di film *Inside Out 2* dan dirancang dengan gaya **Neo Brutalism berwarna oranye**.

Platform ini memiliki **3 tampilan terpisah** dalam satu URL:
- **Admin** — control panel untuk operator/pembicara
- **Display Screen** — layar bersih untuk videotron/proyektor
- **User** — antarmuka mobile untuk peserta

Fitur utama meliputi **Live Polling berbasis bubble word cloud**, **Trivia Quiz real-time ala Kahoot**, **Reaction System emoji**, dan **Leaderboard gabungan** dengan bobot poin yang adil.

---

## 2. Project Context

### 2.1 Latar Belakang
Sesi sharing ini berlangsung selama ±40 menit di lingkungan gereja pemuda. Pembicara (Michael) menggunakan **Canva untuk PPT** dan website ini sebagai **alat interaksi audiens**. Peserta berjumlah **30–50 orang** yang sebagian besar menggunakan smartphone dengan koneksi internet bervariasi.

### 2.2 Alur Keseluruhan Sesi
```
Opening (Canva PPT)
      ↓
Materi Pengantar (Canva PPT)
      ↓
[QR Code muncul di PPT → peserta scan]
      ↓
LIVE POLLING (Website — mode Polling)
      ↓
Materi Lanjutan (Canva PPT)
[Website standby — poin tersimpan]
      ↓
TRIVIA QUIZ (Website — mode Quiz)
      ↓
LEADERBOARD AKHIR (Website — mode Leaderboard)
      ↓
Closing (Canva PPT)
```

### 2.3 Asumsi Operasional
- **1 room** per session — tidak ada multi-room
- Admin membuka panel di laptop/tablet
- Display Screen dibuka di browser laptop terpisah yang terhubung ke videotron
- User mengakses lewat HP masing-masing setelah scan QR Code
- Koneksi internet: bervariasi (harus toleran terhadap latency tinggi)
- Skala: **30–50 pengguna bersamaan**

---

## 3. Goals & Success Metrics

### 3.1 Tujuan Utama
| Tujuan | Ukuran Keberhasilan |
|--------|---------------------|
| Engagement audiens meningkat | ≥80% peserta aktif jawab polling & quiz |
| Tidak ada hambatan teknis signifikan | 0 crash total selama sesi berlangsung |
| Kemudahan operasional | Admin bisa kontrol semua fitur tanpa bantuan teknis |
| Persistence data | Poin tidak hilang walau HP dikunci/ganti tab |

### 3.2 Non-Goals
- Tidak perlu sistem analytics mendalam pasca-session
- Tidak perlu multi-room / multi-event
- Tidak perlu mobile app (hanya web, mobile-responsive)
- Tidak perlu moderasi konten manual

---

## 4. Technical Architecture

### 4.1 Stack Rekomendasi

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| Frontend | Vanilla JS + HTML/CSS atau React | Lightweight, cepat di mobile |
| Real-time Engine | **Firebase Realtime Database** | Sync sub-100ms, gratis untuk skala ini |
| Database (state) | **Firestore** | Struktur data session, user, scores |
| Hosting | **Firebase Hosting** | CDN global, free tier cukup |
| Auth Admin | Custom password (hash di Firestore) | Simpel, bisa diubah dari dashboard |

### 4.2 Arsitektur URL

```
https://anxietytalk.web.app/
  ├── /              → Halaman pilihan role (Admin / Display / User)
  ├── /admin         → Admin Control Panel (password-protected)
  ├── /display       → Display Screen (clean, untuk videotron)
  └── /join          → User join page (nama → sesi)
```

### 4.3 Data Model (Firestore)

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

### 4.4 Persistence Strategy (Anti-Disconnect)

- Saat user pertama kali join → dibuat **`deviceId`** unik (UUID) disimpan di `localStorage`
- Setiap sesi → user di-match via `deviceId`, bukan session browser
- Saat user kembali → auto-rejoin dengan nama & poin yang sama
- Firestore menyimpan semua state permanen
- `localStorage` hanya sebagai cache lokal (nama, deviceId, token)

---

## 5. User Roles & Access Control

### 5.1 Tiga Role

| Role | Cara Akses | Perangkat |
|------|-----------|-----------|
| **Admin** | `/admin` + password | Laptop/tablet pembicara |
| **Display Screen** | `/display` (tanpa auth) | Laptop terhubung ke videotron |
| **User** | `/join` via QR Code | HP peserta |

### 5.2 Admin Authentication
- Login menggunakan password yang disimpan (bcrypt hash) di Firestore
- Password bisa diubah dari dalam dashboard admin (input: password lama → password baru)
- Session admin disimpan di `sessionStorage` browser (hilang saat tab ditutup)
- **Multi-operator**: beberapa orang bisa login dengan password yang sama dari device berbeda secara bersamaan

### 5.3 User Registration Flow
```
Scan QR Code → Buka /join
      ↓
Input nama (max 20 karakter)
      ↓
Sistem cek: apakah nama sudah dipakai?
  → Tidak: langsung masuk
  → Ya: auto-append angka (contoh: "Michael" → "Michael2")
      ↓
Device ID dicek: apakah device sudah pernah join?
  → Ya: restore user lama (same poin)
  → Tidak: buat user baru
      ↓
Masuk ke User Dashboard (mode: waiting / active tergantung status session)
```

**Rules:**
- 1 device = 1 user (di-enforce via `deviceId` di localStorage)
- Nama tidak boleh sama (auto-deduplicate dengan angka suffix)
- User tidak perlu login ulang jika ganti tab atau lock HP

---

## 6. Feature Specifications

---

### 6.1 Feature: Admin Control Panel

#### Overview
Halaman kontrol penuh untuk admin/operator. Terdapat semua pengaturan session dari awal hingga akhir.

#### 6.1.1 Dashboard Utama Admin
Setelah login, admin melihat:
- **Status session** saat ini (badge besar)
- **Tombol kontrol utama**: Start Session / Switch Mode / End Session
- **Jumlah user aktif** (real-time counter)
- **Mode switcher**: Waiting → Polling → Quiz → Leaderboard → Closed
- **QR Code** untuk dibagikan ke peserta (auto-generated dari URL `/join`)
- **Navigasi sidebar**: Settings, Polling, Quiz, Leaderboard, Users

#### 6.1.2 Session Management
| Aksi | Deskripsi |
|------|-----------|
| **Create/Start Session** | Reset semua data, buka room |
| **Switch to Polling Mode** | Display Screen tampilkan polling, User buka polling |
| **Switch to Quiz Mode** | Display Screen tampilkan quiz, User buka quiz |
| **Switch to Leaderboard** | Display Screen tampilkan leaderboard akhir |
| **Close Session** | Tutup session, user tidak bisa jawab lagi |
| **Reset Session** | Hapus semua data (poin, jawaban), mulai dari awal |

#### 6.1.3 Settings Panel
- **Password admin**: input password lama → input password baru → simpan
- **Max jawaban polling per user**: input angka (default: 3, min: 1, max: 99999)
- **Max karakter per jawaban polling**: input angka (default: 30, min: 5, max: 100)
- **Konfigurasi emoji reaction**: 5 slot emoji yang bisa diubah (default: 😰 😤 😢 😅 🙏)
- **Sound effects**: toggle ON/OFF

#### 6.1.4 Polling Management Panel
- **Daftar pertanyaan polling**: list semua pertanyaan yang sudah dibuat
- **Tambah pertanyaan**: form dengan field:
  - Teks pertanyaan/pernyataan (max 200 karakter)
- **Edit / hapus pertanyaan** yang ada
- **Navigasi pertanyaan aktif**: tombol `← Prev` dan `Next →` untuk memilih pertanyaan mana yang sedang aktif di display
- **Tombol "Show Results"**: switch display ke tampilan bubble word cloud hasil polling
- **Tombol "Hide Results"**: kembali ke mode menunggu jawaban
- **Reset jawaban pertanyaan ini**: hapus semua jawaban untuk pertanyaan aktif

#### 6.1.5 Quiz Management Panel
Daftar soal yang bisa di-add, edit, delete, dan reorder (drag-and-drop):

Setiap soal memiliki field:
| Field | Tipe | Keterangan |
|-------|------|-----------|
| Pertanyaan | Text area | Max 250 karakter |
| Pilihan A | Input text | Max 100 karakter |
| Pilihan B | Input text | Max 100 karakter |
| Pilihan C | Input text | Max 100 karakter |
| Pilihan D | Input text | Max 100 karakter |
| Jawaban benar | Dropdown | A / B / C / D |
| Durasi waktu | Number input | Dalam detik (default: 20, min: 5, max: 120) |

**Kontrol saat Quiz berjalan:**
- **Start Question**: mulai countdown untuk soal yang dipilih
- **Reveal Answer**: ungkap jawaban benar secara manual (sebelum/sesudah timer habis)
- **Next Question**: pindah ke soal berikutnya + tampilkan leaderboard sementara
- **Show Interim Leaderboard**: tampilkan leaderboard setelah tiap soal
- **End Quiz**: selesaikan quiz dan switch ke mode Leaderboard Akhir

#### 6.1.6 User Management Panel
- Tabel semua user yang bergabung: Nama, Device ID (4 karakter terakhir), Total Poin, Status (online/offline)
- Tombol **Kick User** (opsional: paksa disconnect user bermasalah)

#### 6.1.7 QR Code Generator
- Ditampilkan di sidebar admin (selalu visible)
- Auto-generate dari URL `/join` aktif
- Tombol **Download QR Code** (PNG) untuk dipasang di Canva PPT
- Tampilkan juga URL teks di bawah QR untuk yang tidak bisa scan

---

### 6.2 Feature: Live Polling (Bubble Word Cloud)

#### Overview
Peserta mengirim jawaban teks. Jawaban ditampilkan sebagai **bubble animasi** yang melayang dan bertabrakan satu sama lain di Display Screen — seperti tampilan di cryptobubbles.net.

#### 6.2.1 User Side — Jawaban Polling
**Layout mobile:**
- Header: pertanyaan/pernyataan aktif (besar, bold, neo-brutalism style)
- Input field teks (dengan character counter: `12/30`)
- Tombol **Kirim** (big, orange button dengan border hitam tebal)
- Di bawah input: **reaction emoji bar** (5 tombol emoji besar)
- Counter: "Kamu sudah mengirim X dari Y jawaban"
- Jika sudah mencapai batas: input di-disable, tampilkan pesan "Kamu sudah kirim semua jawaban! 🎉"

**Rules:**
- Max jawaban sesuai setting admin (misal: 3 kali)
- Setiap kirim jawaban: +**50 poin** (polling weight)
- Jawaban langsung muncul di display tanpa moderasi
- Emoji reaction bisa di-tap kapan saja (tidak terbatas)

#### 6.2.2 Display Screen — Bubble Physics Animation
**Layout layar (landscape):**
- Background gelap / oranye gelap (neo-brutalism)
- Pertanyaan aktif tampil di bagian atas (kecil, sebagai header)
- Area utama: **full canvas physics simulation**

**Perilaku bubble:**
- Setiap jawaban = 1 bubble
- Bubble berisi teks jawaban user
- Ukuran bubble: **seragam** (tidak berubah berdasarkan panjang teks)
- Bubble bergerak bebas, saling bertabrakan (collision physics)
- Bubble **tidak keluar dari batas layar** (bouncing off walls)
- Bubble punya **velocity awal random** saat muncul pertama kali
- Bubble baru masuk dengan **animasi pop-in** (scale dari 0 ke 1 + bounce)
- **Warna bubble**: random dari palet neo-brutalism (oranye, kuning, merah, pink, lime)
- Bubble yang sama dari user yang sama: **warna berbeda dengan bubble sebelumnya**

**Interaksi Admin/Operator:**
- Admin (yang buka `/display` atau bisa juga lewat admin panel) bisa **klik dan drag bubble** untuk melempar/memindahkannya
- Setelah dilepas, bubble kembali bergerak dengan velocity dari arah drag

**Implementasi teknis:**
- Gunakan **Matter.js** atau **custom canvas physics** (2D rigidbody dengan circle collider)
- Sync real-time via Firebase Realtime Database (jawaban baru → bubble baru)
- Target: 60fps dengan 100+ bubble di layar

#### 6.2.3 Polling Flow (urutan kejadian)
```
Admin aktifkan pertanyaan polling
      ↓
Display Screen: tampilkan pertanyaan + bubble canvas kosong
User: muncul form jawaban + emoji bar
      ↓
User kirim jawaban → langsung muncul sebagai bubble baru
(real-time, delay < 500ms)
      ↓
Admin klik "Show Results" (atau sudah otomatis karena sudah berjalan)
      ↓
Jika ada pertanyaan berikutnya: Admin klik "Next Question"
Display update, User form reset
      ↓
Selesai semua pertanyaan → Admin switch ke mode berikutnya
```

---

### 6.3 Feature: Reaction System

#### Overview
User bisa menekan tombol emoji kapan saja (di mode polling maupun mode menunggu). Reaksi muncul sebagai **animasi mengambang naik ke atas** di Display Screen.

#### 6.3.1 User Side
- **5 tombol emoji besar** selalu visible di halaman user (di bawah area konten utama)
- Tidak ada cooldown — bisa di-spam
- Setiap tap: langsung kirim ke Firebase
- Visual feedback di HP: emoji muncul sebentar di atas tombol sebelum menghilang
- Setiap tap: +**1 poin** (reaction weight, sangat kecil)

#### 6.3.2 Display Screen — Floating Emoji Animation
- Reaksi masuk via Firebase Realtime DB (stream)
- Setiap reaksi: **1 emoji muncul di posisi random bawah layar**, lalu **animasi naik ke atas** sambil **fade out** dan sedikit **bergerak kiri-kanan** (seperti reaction di Google Meet / Zoom)
- Bisa ada **puluhan emoji terbang bersamaan** tanpa lag
- Implementasi: CSS animation / requestAnimationFrame, bukan DOM baru per emoji (gunakan object pool)

#### 6.3.3 Timing & Performance
- Delay boleh hingga **1-2 detik** (acceptable untuk visual effect)
- Batch incoming reactions setiap 500ms untuk render bersama-sama
- Max 50 emoji aktif di layar sekaligus (oldest auto-disappear)

---

### 6.4 Feature: Trivia Quiz (Kahoot-style)

#### Overview
Quiz real-time dengan timer countdown, 4 pilihan jawaban berbentuk icon berwarna. Flow persis seperti Kahoot: tampilkan soal di layar besar → user jawab di HP → reveal jawaban → leaderboard sementara → soal berikutnya.

#### 6.4.1 Display Screen — Quiz View

**Fase 1: Tampilkan Soal (sebelum jawab)**
```
┌─────────────────────────────────────────────────────┐
│  Soal 1 / 5              ⏱ 00:20                   │
│                                                     │
│   "Apa yang biasanya dilakukan orang ketika         │
│    mereka merasa anxiety berlebihan?"               │
│                                                     │
│  ████████████████████  ← progress bar waktu         │
│                                                     │
│  🔺 Menarik diri       🔷 Berbicara sama orang      │
│  ⭕ Berdoa             ⬛ Overthinking               │
│                                                     │
│           [X orang sudah menjawab]                 │
└─────────────────────────────────────────────────────┘
```

- Background: warna gelap, pertanyaan teks besar di tengah
- 4 pilihan: masing-masing dengan **background warna solid** (merah, biru, hijau, kuning — neo-brutalism) dan **icon shape** (segitiga, berlian, lingkaran, kotak)
- Timer countdown: angka besar + progress bar animasi horizontal
- Counter jawaban masuk: "X orang sudah menjawab" (real-time)

**Fase 2: Reveal Jawaban**
```
┌─────────────────────────────────────────────────────┐
│  ✅ Jawaban Benar: Berdoa                            │
│                                                     │
│  🔺 Menarik diri   [===] 8 jawaban                  │
│  🔷 Berbicara      [=====] 12 jawaban               │
│  ⭕ Berdoa ✅       [========] 18 jawaban            │
│  ⬛ Overthinking   [==] 5 jawaban                   │
│                                                     │
│  Jawaban benar ditampilkan dengan glow/animasi      │
└─────────────────────────────────────────────────────┘
```

**Fase 3: Leaderboard Sementara**
- Top 5 user dengan poin tertinggi (dari semua soal yang sudah selesai)
- Animasi slide-in dari bawah, per-orang dengan delay (Kahoot-style)
- Tombol admin: "Next Question" atau "End Quiz"

#### 6.4.2 User Side — Quiz View

**Fase sebelum soal mulai:**
- Tampilan "Bersiap-siap..." dengan animasi countdown 3-2-1

**Fase menjawab:**
- Pertanyaan tampil (kecil, hanya sebagai konteks)
- **4 tombol besar** dengan warna dan shape icon berbeda:
  ```
  [🔺 Merah]    [🔷 Biru]
  [⭕ Hijau]    [⬛ Kuning]
  ```
- Setelah pilih: tombol yang dipilih **highlight**, yang lain **abu-abu**
- Tidak bisa ubah jawaban setelah pilih
- Timer bar tipis di bagian atas HP juga countdown

**Fase reveal:**
- Jika benar: animasi **celebration** (confetti, teks besar "BENAR! +X poin")
- Jika salah: animasi **shake** (teks "Ups, salah 😅")
- Tampilkan poin yang didapat dari soal ini
- Tampilkan kecepatan menjawab

**Jika tidak sempat jawab (waktu habis):**
- Tampilkan "Waktu habis! ⏰" dan 0 poin untuk soal ini

#### 6.4.3 Scoring Quiz (Speed-based)
```
Jawaban benar:
  Base score    = 1000 poin
  Speed bonus   = 500 × (waktu_sisa / durasi_soal)
  Total max     = 1500 poin per soal
  
Jawaban salah atau tidak jawab:
  = 0 poin
```

Contoh: soal 20 detik, user jawab di detik ke-5 (sisa 15 detik):
`1000 + 500 × (15/20) = 1000 + 375 = 1375 poin`

#### 6.4.4 Quiz Flow (urutan kejadian)
```
Admin klik "Start Question" untuk soal ke-N
      ↓
Display: tampilkan soal + 4 pilihan + timer mulai
User: tampilkan 4 tombol jawaban (pertanyaan visible)
      ↓
[Timer berjalan...]
User menjawab → jawaban tersimpan + feedback langsung di HP
Counter di Display naik real-time
      ↓
Timer habis ATAU Admin klik "Reveal Answer"
      ↓
Display: reveal jawaban + bar chart jumlah jawaban per opsi
User: tampilkan apakah benar/salah + poin didapat
      ↓
Admin klik "Show Leaderboard" (atau otomatis setelah 3 detik)
      ↓
Display: leaderboard sementara (top 5, animasi Kahoot)
      ↓
Admin klik "Next Question"
      ↓
[Ulangi untuk soal berikutnya]
      ↓
Semua soal selesai → Admin klik "End Quiz"
      ↓
Switch ke mode Leaderboard Akhir
```

---

### 6.5 Feature: Leaderboard System

#### 6.5.1 Point Weight Summary
| Sumber | Bobot | Poin |
|--------|-------|------|
| Quiz benar + cepat | ⭐⭐⭐ Tinggi | Max 1500 / soal |
| Quiz benar + lambat | ⭐⭐⭐ Tinggi | Min 1000 / soal |
| Kirim jawaban polling | ⭐⭐ Sedang | 50 / jawaban |
| Tap reaction emoji | ⭐ Kecil | 1 / tap |

**Filosofi:** Orang yang spam emoji tapi tidak jawab quiz dengan benar **tidak bisa menang**. Quiz adalah penentu utama ranking.

#### 6.5.2 Leaderboard Sementara (Per Soal Quiz)
- Ditampilkan setelah setiap soal selesai
- Hanya tampilkan **Top 5**
- Animasi masuk: card slide-in dari bawah satu per satu dengan delay 300ms (Kahoot-style)
- Setiap card: Rank (nomor besar), Nama, Total Poin, Poin dari soal ini (+XXX)
- Pemain yang naik rank: animasi naik (panah hijau ke atas)

#### 6.5.3 Final Leaderboard
**Display Screen:**
```
[🏆 LEADERBOARD AKHIR 🏆]

🥇 Michael          — 8.750 poin
🥈 Sarah            — 7.320 poin
🥉 Joshua           — 6.100 poin
   David            — 5.450 poin
   Hannah           — 4.200 poin
   [... dst ...]
```

Animasi Kahoot-style Final Leaderboard:
1. Mulai dari posisi ke-5 (atau lebih rendah jika lebih dari 5 peserta)
2. Setiap nama "reveal" satu per satu dari bawah ke atas
3. Nama ke-1 (pemenang) reveal **paling terakhir** dengan efek dramatis (confetti burst, sound effect fanfare)
4. Background berubah menjadi lebih terang/celebratory saat reveal pemenang

**User Side (saat leaderboard):**
- Tampilkan posisi user sendiri (misal: "Kamu di posisi ke-7 🎉")
- Tampilkan breakdown poin: Quiz + Polling + Reaction
- Jika user di top 3: tampilkan animasi khusus (confetti)

#### 6.5.4 Animasi Detail (Kahoot-inspired)
- **Leaderboard card reveal**: slide-in dari bawah + fade-in, satu per satu
- **Rank up animation**: nama yang naik rank → animasi fly-up dari posisi lama ke posisi baru
- **Winner reveal**: zoom-in card pemenang + burst confetti + sound effect fanfare
- **Podium mode** (opsional, untuk 3 besar): tampilkan podium visual dengan 3 pemenang

---

### 6.6 Feature: Sound Effects (Kahoot-style)

Sound effects yang diperlukan:

| Event | Sound |
|-------|-------|
| User join | Suara chime pendek |
| Quiz dimulai | Countdown beep (3-2-1) |
| Timer berjalan | Background tick (bisa di-toggle admin) |
| Jawaban benar | Fanfare pendek + celebratory |
| Jawaban salah | "Womp womp" pendek |
| Reveal jawaban | Dramatic reveal sound |
| Leaderboard muncul | Rising tension music pendek |
| Pemenang reveal | Fanfare besar + confetti |

**Kontrol:**
- Admin bisa toggle sound ON/OFF dari dashboard
- Sound effects dimainkan di **Display Screen** (bukan di HP user)
- Format audio: `.mp3` atau `.ogg`, disimpan sebagai asset statis

---

## 7. Design System

### 7.1 Style: Neo Brutalism

| Elemen | Spesifikasi |
|--------|-------------|
| **Border** | 3-4px solid hitam (`#000000`) di semua komponen interaktif |
| **Shadow** | Offset shadow hitam: `4px 4px 0px #000000` |
| **Radius** | Minimal atau 0 (kotak, tegas) |
| **Typography** | Oversized, bold, rata kiri atau tengah |
| **Layout** | Dense, penuh, tidak banyak whitespace |
| **Hover effect** | Tombol bergeser 2-4px saat hover (translate), shadow hilang |

### 7.2 Color Palette

| Nama | Hex | Penggunaan |
|------|-----|-----------|
| **Anxiety Orange** | `#FF6B2B` | Primary, CTA utama, accent |
| **Deep Orange** | `#E84E0F` | Hover states, secondary accent |
| **Black** | `#0D0D0D` | Border, teks utama |
| **Off-White** | `#FFF5E4` | Background utama, card |
| **Lemon** | `#FFE500` | Highlight, badge |
| **Hot Pink** | `#FF3CAC` | Accent sekunder |
| **Lime** | `#B5FF4D` | Correct answer, success |
| **Red** | `#FF2D2D` | Error, wrong answer |
| **Quiz Blue** | `#2D6AFF` | Opsi B quiz |
| **Dark BG** | `#1A1A1A` | Background display screen |

### 7.3 Typography

| Elemen | Font | Size | Weight |
|--------|------|------|--------|
| App title / display header | Display font (contoh: **Bebas Neue** / **Black Han Sans**) | 60-120px | 900 |
| Pertanyaan quiz/polling | Display font | 32-48px | 700 |
| Body teks | **Inter** / **Nunito** | 16-20px | 500 |
| Poin / angka besar | Display font | 48-80px | 900 |
| Label kecil | Inter | 12-14px | 600 |

**Font Stack:** Google Fonts (`Bebas Neue` + `Inter`)

### 7.4 Component Anatomy

**Tombol Primary (Neo Brutalism):**
```css
background: #FF6B2B;
border: 3px solid #000;
box-shadow: 4px 4px 0px #000;
border-radius: 4px;
font-weight: 800;
padding: 16px 32px;
transition: all 0.1s ease;

/* hover */
transform: translate(2px, 2px);
box-shadow: 2px 2px 0px #000;
```

**Quiz Answer Button (4 variasi):**
```
🔺 Opsi A: Background Merah (#FF2D2D) + shape segitiga
🔷 Opsi B: Background Biru (#2D6AFF) + shape berlian
⭕ Opsi C: Background Hijau Lime (#B5FF4D) + shape lingkaran
⬛ Opsi D: Background Kuning (#FFE500) + shape kotak
```

### 7.5 Animation Principles

| Prinsip | Detail |
|---------|--------|
| **Playful** | Semua animasi bouncy, overshoot sedikit |
| **Fast in, slow out** | Ease-out untuk semua masuk elemen |
| **Duration** | 200-400ms untuk UI, 600-1000ms untuk celebratory |
| **Physics** | Gunakan spring animation untuk leaderboard reveal |

---

## 8. Performance & Scalability

### 8.1 Target Performa
| Metric | Target |
|--------|--------|
| First Contentful Paint (HP) | < 2 detik |
| Time to Interactive (HP) | < 3 detik |
| Firebase read latency | < 500ms rata-rata |
| Bubble animation | 60fps (60 bubble aktif) |
| Concurrent users | 50 (dengan Firebase free tier) |

### 8.2 Optimisasi untuk Koneksi Lemah
- Gunakan **Firebase Realtime Database** (binary WebSocket) — lebih ringan dari Firestore streaming
- Lazy load asset berat (Sound effects, physics engine)
- Kompres gambar dan asset statis
- Gunakan **Service Worker** minimal untuk cache asset kritis
- Polling interval sebagai fallback jika WebSocket putus (auto-reconnect Firebase)
- Emoji animation: gunakan **CSS animation + object pooling** (bukan create DOM baru tiap emoji)

### 8.3 Firebase Free Tier Check
| Resource | Free Limit | Estimasi Penggunaan |
|----------|-----------|---------------------|
| Realtime DB storage | 1 GB | < 5 MB per session |
| Realtime DB connections | 100 concurrent | Max 50 users + display |
| Realtime DB bandwidth | 10 GB/bulan | < 100 MB per session |
| Firestore reads | 50K/hari | < 5K per session |

**Kesimpulan: Firebase free tier lebih dari cukup.**

---

## 9. Data & History

Karena kebutuhan history tidak prioritas, implementasinya minimal:

- Setelah session ditutup admin, **snapshot data** (scores, answers, reactions) otomatis disimpan ke Firestore collection `sessionHistory/{sessionId}`
- Data tersimpan selama 30 hari (atau manual hapus)
- Admin bisa lihat summary session terakhir dari dashboard (total peserta, top 3, dll)
- Tidak ada export PDF/Excel di versi 1.0

---

## 10. Out of Scope (v1.0)

Berikut hal-hal yang **tidak** akan dibangun di versi pertama:

- Multi-room / multiple simultaneous sessions
- Export PDF/Excel hasil session
- Moderation queue untuk jawaban polling
- Custom branding / theming per session
- Backend server custom (semua via Firebase)
- Mobile app (iOS/Android)
- Video/audio streaming
- Anonymous analytics / heatmaps
- Whiteboard / drawing tool
- Social sharing hasil quiz

---

## 11. Open Questions & Risks

| Pertanyaan | Status | Catatan |
|-----------|--------|---------|
| Nama app final? | ❓ Belum ditentukan | Saran: "AnxietyTalk", "YouthPulse", "FOMO App" |
| Custom domain? | ❓ Optional | Bisa pakai `anxietytalk.web.app` (gratis) |
| Apakah display screen perlu auth? | 🔍 | Saran: tidak perlu, hanya admin yang protected |
| Berapa soal quiz yang direncanakan? | ❓ | Rekomendasi 5-8 soal untuk 40 menit sesi |
| Bubble collision: Matter.js atau custom? | 🔍 | Matter.js lebih mudah, tapi tambah bundle size ~100KB |

---

## 12. Milestones & Build Order (Rekomendasi)

Urutan pembangunan yang disarankan:

```
Phase 1 — Foundation (Hari 1-2)
  ✓ Setup Firebase project
  ✓ Struktur URL & routing (admin / display / user)
  ✓ Admin auth (login + change password)
  ✓ User join flow (nama, deviceId, deduplication)
  ✓ Session state management (Firebase Realtime DB)

Phase 2 — Polling (Hari 3-4)
  ✓ Admin: buat & manage pertanyaan polling
  ✓ User: form jawaban + emoji bar
  ✓ Display: bubble physics canvas
  ✓ Scoring polling

Phase 3 — Quiz (Hari 5-7)
  ✓ Admin: buat & manage soal quiz
  ✓ User: tampilan 4 tombol + timer
  ✓ Display: tampilan soal + countdown
  ✓ Speed-based scoring
  ✓ Leaderboard sementara per soal

Phase 4 — Polish (Hari 8-9)
  ✓ Final leaderboard + animasi Kahoot-style
  ✓ Sound effects integration
  ✓ Reaction system
  ✓ QR Code generator
  ✓ Design system (Neo Brutalism full)

Phase 5 — Testing (Hari 10)
  ✓ Load testing (simulasi 50 user)
  ✓ Mobile testing (berbagai HP)
  ✓ End-to-end flow test (full 40 menit simulasi)
  ✓ Fix bugs & performance tuning
```

---

*PRD ini merupakan dokumen hidup. Revisi dan update mungkin diperlukan seiring perkembangan development.*

*