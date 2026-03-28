/**
 * Authentication Module for AnxietyTalk Admin
 *
 * Handles admin authentication using bcrypt for password hashing.
 * Uses Firestore for storing admin credentials and session settings.
 *
 * Dependencies:
 * - bcryptjs (loaded via CDN in admin.html)
 * - firebase/firebase-config.js (provides db, sessionRef)
 */

(function(window) {
  'use strict';

  // bcryptjs exposes as dcodeIO.bcrypt
  const bcrypt = window.dcodeIO ? window.dcodeIO.bcrypt : window.bcrypt;

  // Default admin password
  const DEFAULT_PASSWORD = 'admin123';

  // Session storage key for admin login status
  const SESSION_KEY = 'adminLoggedIn';

  // Firestore field names
  const FIELD_PASSWORD_HASH = 'passwordHash';
  const FIELD_SESSION_STATUS = 'sessionStatus';
  const FIELD_DEFAULT_SETTINGS = 'defaultSettings';
  const FIELD_POLLING_CONFIG = 'pollingConfig';
  const FIELD_QUIZ_CONFIG = 'quizConfig';

  /**
   * Hash a password using bcrypt
   * @param {string} password - The plain text password to hash
   * @returns {string} The hashed password
   */
  function hashPassword(password) {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
  }

  /**
   * Verify a password against a hash
   * @param {string} password - The plain text password to verify
   * @param {string} hash - The bcrypt hash to compare against
   * @returns {boolean} True if password matches hash, false otherwise
   */
  function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
  }

  // Placeholder polling questions (anxiety-themed, Indonesian)
  const PLACEHOLDER_POLLING_QUESTIONS = [
    'Apa yang kamu rasakan saat mengalami kecemasan?',
    'Apa yang biasanya kamu lakukan untuk mengatasi kecemasan?',
    'Siapa yang biasanya kamu ajak bicara saat merasa cemas?'
  ];

  // Placeholder quiz questions (anxiety-themed, Indonesian)
  const PLACEHOLDER_QUIZ_QUESTIONS = [
    {
      text: 'Apa itu anxiety?',
      options: ['Rasa takut berlebihan', 'Kehilangan memori', 'Gangguan tidur', 'Masalah pencernaan'],
      correctAnswer: 0,
      duration: 20
    },
    {
      text: 'Manakah yang BUKAN cara mengatasi anxiety?',
      options: ['Berolahraga', 'Menghindari masalah', 'Berbagi dengan orang terpercaya', 'Tarik napas dalam-dalam'],
      correctAnswer: 1,
      duration: 20
    },
    {
      text: 'Apa yang dilakukan Anxiety di Inside Out 2?',
      options: ['Menyebabkan bahagia', 'Membuat kita peduli', 'Menghilangkan kenangan', 'Membuat kita lupa'],
      correctAnswer: 1,
      duration: 20
    },
    {
      text: 'Kapan sebaiknya mencari bantuan profesional untuk anxiety?',
      options: ['Tidak perlu pernah', 'Ketika mengganggu aktivitas sehari-hari', 'Hanya saat panik', 'Ketika tidak bisa tidur satu malam'],
      correctAnswer: 1,
      duration: 20
    },
    {
      text: 'Apa yang TIDAK membantu mengurangi anxiety?',
      options: ['Meditasi', 'Mengkonsumsi alkohol berlebihan', 'Curhat', 'Olahraga rutin'],
      correctAnswer: 1,
      duration: 20
    }
  ];

  /**
   * Initialize authentication and session settings in Firestore
   * Creates default admin password hash and session configuration if not exists
   * @returns {Promise<void>}
   */
  async function initAuth() {
    try {
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        // Create new session document with default settings
        const defaultPasswordHash = hashPassword(DEFAULT_PASSWORD);

        await sessionRef.set({
          [FIELD_PASSWORD_HASH]: defaultPasswordHash,
          [FIELD_SESSION_STATUS]: 'waiting',
          [FIELD_DEFAULT_SETTINGS]: {
            maxPollAnswers: 0, // 0 = unlimited
            maxPollChars: 30,
            emojis: ['😰', '😤', '😢', '😅', '🙏']
          },
          [FIELD_POLLING_CONFIG]: {
            questions: PLACEHOLDER_POLLING_QUESTIONS
          },
          [FIELD_QUIZ_CONFIG]: {
            questions: PLACEHOLDER_QUIZ_QUESTIONS
          }
        });

        console.log('Auth initialized with default settings and placeholder content');
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      throw error;
    }
  }

  /**
   * Login with admin password
   * @param {string} password - The password to verify
   * @returns {Promise<boolean>} True if login successful, false otherwise
   */
  async function login(password) {
    try {
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        console.error('Session not initialized');
        return false;
      }

      const storedHash = sessionDoc.data()[FIELD_PASSWORD_HASH];

      if (verifyPassword(password, storedHash)) {
        sessionStorage.setItem(SESSION_KEY, 'true');
        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  /**
   * Check if user is logged in as admin
   * @returns {boolean} True if logged in, false otherwise
   */
  function isLoggedIn() {
    return sessionStorage.getItem(SESSION_KEY) === 'true';
  }

  /**
   * Logout and remove admin session
   */
  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  /**
   * Change the admin password
   * @param {string} oldPassword - The current password for verification
   * @param {string} newPassword - The new password to set
   * @returns {Promise<boolean>} True if password changed successfully, false otherwise
   */
  async function changePassword(oldPassword, newPassword) {
    try {
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        console.error('Session not initialized');
        return false;
      }

      const storedHash = sessionDoc.data()[FIELD_PASSWORD_HASH];

      // Verify old password
      if (!verifyPassword(oldPassword, storedHash)) {
        console.error('Old password is incorrect');
        return false;
      }

      // Hash new password and update
      const newPasswordHash = hashPassword(newPassword);

      await sessionRef.update({
        [FIELD_PASSWORD_HASH]: newPasswordHash
      });

      return true;
    } catch (error) {
      console.error('Error changing password:', error);
      return false;
    }
  }

  // Expose Auth object globally
  window.Auth = {
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    initAuth: initAuth,
    login: login,
    isLoggedIn: isLoggedIn,
    logout: logout,
    changePassword: changePassword
  };

})(window);
