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
  apiKey: "AIzaSyAk7u32qQqr_8Gf8AdtsIUrXSWv8VtpTY8",
  authDomain: "pollingandquizweb.firebaseapp.com",
  databaseURL: "https://pollingandquizweb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pollingandquizweb",
  storageBucket: "pollingandquizweb.firebasestorage.app",
  messagingSenderId: "390099329616",
  appId: "1:390099329616:web:d12c8834fda68051c8e755"
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

// Realtime Database references for real-time collections
const pollingAnswersRef = rtdb.ref('pollingAnswers');
const quizAnswersRef = rtdb.ref('quizAnswers');
const reactionsRef = rtdb.ref('reactions');
