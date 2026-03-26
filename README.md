# AnxietyTalk

An interactive web-based audience engagement platform designed for anxiety awareness sessions. Features real-time polling, quiz functionality, emoji reactions, and a live leaderboard.

## Features

- **Real-time Polling**: Engage participants with live polling questions
- **Interactive Quiz**: Test knowledge with timed quiz questions and track scores
- **Emoji Reactions**: Participants can react with emoji bubbles in real-time
- **Live Leaderboard**: Track and display participant rankings
- **Multi-role Interface**: Separate views for admin, display screen, and participants
- **Firebase Backend**: Real-time data synchronization across all connected clients

## Prerequisites

- Node.js 18+ (for Firebase CLI)
- Firebase account (free tier available)
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Firebase Setup

### Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup wizard
3. Choose a project name (e.g., "anxiety-talk")

### Step 2: Enable Firestore Database

1. In the Firebase Console, go to "Build" > "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development) or configure proper rules
4. Select a location closest to your users

### Step 3: Enable Realtime Database

1. In the Firebase Console, go to "Build" > "Realtime Database"
2. Click "Create Database"
3. Choose "Start in test mode" for development
4. Select the same location as Firestore

### Step 4: Register Your Web App

1. Go to "Project settings" (gear icon)
2. Scroll to "Your apps" section
3. Click the Web icon (`</>`)
4. Register your app with a nickname
5. Copy the `firebaseConfig` object

### Step 5: Configure Firebase Settings

Open `/js/firebase-config.js` and replace the placeholder values:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## Firebase Security Rules

### Firestore Rules

Go to "Firestore Database" > "Rules" and apply:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Session settings - read for all, write for admin only
    match /session/{document=*} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Users - authenticated users can read and write their own data
    match /users/{userId} {
      allow read: if true;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if request.auth != null && request.auth.uid == userId;
    }

    // Polling answers - anyone can read, authenticated users can write
    match /pollingAnswers/{document=*} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Reactions - anyone can read, authenticated users can write
    match /reactions/{document=*} {
      allow read: if true;
      allow write: if request.auth != null;
    }

    // Quiz answers - anyone can read, authenticated users can write
    match /quizAnswers/{document=*} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

### Realtime Database Rules

Go to "Realtime Database" > "Rules" and apply:

```json
{
  "rules": {
    "session": {
      ".read": true,
      ".write": true
    },
    "users": {
      ".read": true,
      "$userId": {
        ".write": "auth != null && auth.uid === $userId"
      }
    },
    "reactions": {
      ".read": true,
      ".write": true
    }
  }
}
```

## Local Development

### Using a Local Server

Since this project uses Firebase SDK, you need to serve files over HTTP(S):

```bash
# Using Python 3
python3 -m http.server 8080

# Using Node.js (with http-server)
npx http-server -p 8080

# Using PHP
php -S localhost:8080
```

Then open `http://localhost:8080` in your browser.

### Using Firebase Hosting (Recommended)

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Firebase Hosting in your project:
```bash
firebase init hosting
```
- Select your project
- Set public directory to `.` (current directory)
- Configure as single-page app: Yes
- Set up automatic builds: No

4. Deploy locally for testing:
```bash
firebase serve --only hosting
```

5. Open `http://localhost:5000`

## Firebase Hosting Deployment

### Step 1: Initialize Firebase Project

```bash
firebase init
```
Select:
- Hosting (with your existing Firebase project)
- Public directory: `.`
- Single-page app: Yes

### Step 2: Create firebase.json

The init command creates this file. Ensure it contains:

```json
{
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### Step 3: Deploy

```bash
firebase deploy
```

Your site will be live at `https://YOUR_PROJECT_ID.web.app`

## Usage Guide

### Admin Panel (admin.html)

1. Open `admin.html` in a browser
2. Login with default password: `admin123`
3. Configure session settings (max poll answers, characters, emojis)
4. Add polling questions
5. Add quiz questions with correct answers and time limits
6. Control the session flow:
   - Start Session
   - Switch to Polling mode
   - Switch to Quiz mode
   - Show Leaderboard
   - Close Session
   - Reset Session

### Display Screen (display.html)

1. Open `display.html` on a secondary screen/projector
2. View:
   - Live polling results (word bubbles)
   - Current quiz question with timer
   - Leaderboard rankings
   - Real-time emoji reactions

### Participant View (index.html)

1. Participants open `index.html` or the hosted URL
2. Enter their display name
3. Participate in:
   - Answer polling questions
   - Answer quiz questions
   - Send emoji reactions

## Default Admin Password

**IMPORTANT**: The default admin password is `admin123`.

For production use:
1. Login to the admin panel
2. Go to settings or password change section
3. Set a strong, unique password
4. Document the password securely

## Project Structure

```
/
├── index.html          # Participant view
├── admin.html          # Admin panel
├── display.html        # Display screen
├── css/
│   └── styles.css      # Main stylesheet
├── js/
│   ├── firebase-config.js  # Firebase initialization
│   ├── auth.js         # Admin authentication
│   ├── session.js      # Session state management
│   ├── user.js         # User management
│   ├── bubbles.js      # Polling word bubbles
│   ├── reactions.js    # Emoji reactions
│   ├── quiz.js         # Quiz functionality
│   ├── leaderboard.js  # Score tracking
│   ├── admin.js        # Admin UI logic
│   ├── display.js      # Display screen logic
│   └── main.js         # Main participant logic
├── SPEC.md             # Technical specification
└── README.md           # This file
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT License

Copyright (c) 2024 AnxietyTalk

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
