/**
 * Firebase Configuration for AnxietyTalk
 *
 * To get these values:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project or select an existing one
 * 3. Click the gear icon > Project settings
 * 4. Scroll down to "Your apps" section
 * 5. If no app exists, click the Web icon (</>) to register a web app
 * 6. Copy the firebaseConfig object values from the SDK setup snippet
 */

// Firebase configuration object
// Replace these placeholder values with your actual Firebase project values
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firestore database reference
const db = firebase.firestore();

// Realtime Database reference
const rtdb = firebase.database();

// Collection/Node references for Firestore
const sessionRef = db.collection('session').doc('current');
const usersRef = db.collection('users');
const pollingAnswersRef = db.collection('pollingAnswers');
const reactionsRef = db.collection('reactions');
const quizAnswersRef = db.collection('quizAnswers');
