/**
 * Session State Management Module for AnxietyTalk
 *
 * Provides real-time session state management and Firebase sync
 * using Realtime Database for live updates.
 *
 * Dependencies:
 * - firebase/firebase-config.js (provides rtdb reference)
 */

(function(window) {
  'use strict';

  // Realtime Database path for session
  const SESSION_PATH = 'session';

  /**
   * Current session state
   * @type {Object}
   */
  const sessionState = {
    status: 'waiting',
    currentQuestionIndex: 0,
    settings: {
      maxPollAnswers: 3,
      maxPollChars: 30,
      emojis: ['😰', '😤', '😢', '😅', '🙏']
    },
    pollingConfig: {
      questions: [],
      currentIndex: 0
    },
    quizConfig: {
      questions: [],
      currentIndex: 0,
      timePerQuestion: 30,
      revealed: false
    }
  };

  /**
   * Listeners for session state changes
   * @type {Array<Function>}
   */
  const listeners = [];

  /**
   * Reference to the Realtime Database listener for cleanup
   * @type {Function|null}
   */
  let unsubscribe = null;

  /**
   * Subscribe to session state changes
   * @param {Function} callback - Function to call when state changes
   * @returns {Function} Unsubscribe function
   */
  function onSessionChange(callback) {
    if (typeof callback === 'function') {
      listeners.push(callback);
    }

    // Return unsubscribe function
    return function unsubscribeFromSession() {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of state changes
   * @param {string} [action] - Optional action name that triggered the change
   */
  function notifyListeners(action) {
    const payload = {
      state: getState(),
      action: action || 'update',
      timestamp: Date.now()
    };

    listeners.forEach(function(listener) {
      try {
        listener(payload);
      } catch (error) {
        console.error('Error in session listener:', error);
      }
    });
  }

  /**
   * Get a deep clone of the current state
   * @returns {Object} Copy of the session state
   */
  function getState() {
    return JSON.parse(JSON.stringify(sessionState));
  }

  /**
   * Update local state and sync to Firebase
   * @param {Object} updates - Object with fields to update
   * @param {string} [action] - Action name for notification
   * @returns {Promise<void>}
   */
  async function updateState(updates, action) {
    // Deep merge updates into sessionState
    Object.keys(updates).forEach(function(key) {
      if (typeof updates[key] === 'object' && updates[key] !== null && !Array.isArray(updates[key])) {
        sessionState[key] = Object.assign({}, sessionState[key] || {}, updates[key]);
      } else {
        sessionState[key] = updates[key];
      }
    });

    // Sync to Realtime Database
    try {
      await rtdb.ref(SESSION_PATH).update(sessionState);
      notifyListeners(action);
    } catch (error) {
      console.error('Error syncing session state to Firebase:', error);
      throw error;
    }
  }

  /**
   * Fetch initial session state from Firestore
   * Used for one-time read of the current state
   * @returns {Promise<Object>} The session state
   */
  async function fetchSessionState() {
    try {
      const sessionDoc = await sessionRef.get();

      if (sessionDoc.exists) {
        const data = sessionDoc.data();

        // Map Firestore data to session state
        if (data.sessionStatus) {
          sessionState.status = data.sessionStatus;
        }
        if (data.defaultSettings) {
          sessionState.settings = Object.assign({}, sessionState.settings, data.defaultSettings);
        }
        if (data.pollingConfig) {
          sessionState.pollingConfig = Object.assign({}, sessionState.pollingConfig, data.pollingConfig);
        }
        if (data.quizConfig) {
          sessionState.quizConfig = Object.assign({}, sessionState.quizConfig, data.quizConfig);
        }
        if (typeof data.currentQuestionIndex === 'number') {
          sessionState.currentQuestionIndex = data.currentQuestionIndex;
        }
      }

      notifyListeners('fetch');
      return getState();
    } catch (error) {
      console.error('Error fetching session state:', error);
      throw error;
    }
  }

  /**
   * Subscribe to Realtime Database for real-time updates
   * Sets up a listener that automatically updates local state
   * @returns {Promise<Function>} Unsubscribe function
   */
  async function subscribeToSession() {
    // Clean up existing subscription
    if (unsubscribe) {
      unsubscribe();
    }

    return new Promise(function(resolve) {
      const sessionRefPath = rtdb.ref(SESSION_PATH);

      unsubscribe = sessionRefPath.on('value', function(snapshot) {
        var data = snapshot.val();

        if (data) {
          // Update local state with remote data
          if (data.status) sessionState.status = data.status;
          if (data.currentQuestionIndex !== undefined) sessionState.currentQuestionIndex = data.currentQuestionIndex;
          if (data.settings) sessionState.settings = Object.assign({}, sessionState.settings, data.settings);
          if (data.pollingConfig) sessionState.pollingConfig = Object.assign({}, sessionState.pollingConfig, data.pollingConfig);
          if (data.quizConfig) sessionState.quizConfig = Object.assign({}, sessionState.quizConfig, data.quizConfig);

          notifyListeners('sync');
        }
      }, function(error) {
        console.error('Error in session subscription:', error);
      });

      resolve(unsubscribe);
    });
  }

  /**
   * Unsubscribe from session updates
   */
  function unsubscribeFromSession() {
    if (unsubscribe) {
      rtdb.ref(SESSION_PATH).off('value', unsubscribe);
      unsubscribe = null;
    }
  }

  // ============================================
  // Session Actions
  // ============================================

  /**
   * Start session - reset to waiting state
   * @returns {Promise<void>}
   */
  async function startSession() {
    await updateState({
      status: 'waiting',
      currentQuestionIndex: 0,
      pollingConfig: {
        questions: sessionState.pollingConfig.questions,
        currentIndex: 0
      },
      quizConfig: {
        questions: sessionState.quizConfig.questions,
        currentIndex: 0,
        timePerQuestion: sessionState.quizConfig.timePerQuestion,
        revealed: false
      }
    }, 'startSession');
  }

  /**
   * Switch session to polling mode
   * @returns {Promise<void>}
   */
  async function switchToPolling() {
    await updateState({
      status: 'polling',
      currentQuestionIndex: 0
    }, 'switchToPolling');
  }

  /**
   * Switch session to quiz mode
   * @returns {Promise<void>}
   */
  async function switchToQuiz() {
    await updateState({
      status: 'quiz',
      currentQuestionIndex: 0,
      quizConfig: Object.assign({}, sessionState.quizConfig, {
        currentIndex: 0,
        revealed: false
      })
    }, 'switchToQuiz');
  }

  /**
   * Show leaderboard
   * @returns {Promise<void>}
   */
  async function showLeaderboard() {
    await updateState({
      status: 'leaderboard'
    }, 'showLeaderboard');
  }

  /**
   * Close the session
   * @returns {Promise<void>}
   */
  async function closeSession() {
    await updateState({
      status: 'closed'
    }, 'closeSession');
  }

  /**
   * Reset session - clear all data and reset
   * @returns {Promise<void>}
   */
  async function resetSession() {
    await updateState({
      status: 'waiting',
      currentQuestionIndex: 0,
      settings: {
        maxPollAnswers: 3,
        maxPollChars: 30,
        emojis: ['😰', '😤', '😢', '😅', '🙏']
      },
      pollingConfig: {
        questions: [],
        currentIndex: 0
      },
      quizConfig: {
        questions: [],
        currentIndex: 0,
        timePerQuestion: 30,
        revealed: false
      }
    }, 'resetSession');
  }

  // ============================================
  // Settings Actions
  // ============================================

  /**
   * Update session settings
   * @param {Object} newSettings - Settings to update
   * @param {number} [newSettings.maxPollAnswers] - Maximum poll answers
   * @param {number} [newSettings.maxPollChars] - Maximum characters per answer
   * @param {string[]} [newSettings.emojis] - Array of emoji strings
   * @returns {Promise<void>}
   */
  async function updateSettings(newSettings) {
    var updatedSettings = Object.assign({}, sessionState.settings, newSettings);
    await updateState({
      settings: updatedSettings
    }, 'updateSettings');
  }

  // ============================================
  // Polling Actions
  // ============================================

  /**
   * Add a polling question
   * @param {string} text - The question text
   * @returns {Promise<void>}
   */
  async function addPollingQuestion(text) {
    var questions = sessionState.pollingConfig.questions.slice();
    questions.push(text);
    await updateState({
      pollingConfig: Object.assign({}, sessionState.pollingConfig, {
        questions: questions
      })
    }, 'addPollingQuestion');
  }

  /**
   * Update a polling question
   * @param {number} index - The question index to update
   * @param {string} text - The new question text
   * @returns {Promise<void>}
   */
  async function updatePollingQuestion(index, text) {
    var questions = sessionState.pollingConfig.questions.slice();
    if (index >= 0 && index < questions.length) {
      questions[index] = text;
      await updateState({
        pollingConfig: Object.assign({}, sessionState.pollingConfig, {
          questions: questions
        })
      }, 'updatePollingQuestion');
    } else {
      console.error('Invalid polling question index:', index);
    }
  }

  /**
   * Delete a polling question
   * @param {number} index - The question index to delete
   * @returns {Promise<void>}
   */
  async function deletePollingQuestion(index) {
    var questions = sessionState.pollingConfig.questions.slice();
    if (index >= 0 && index < questions.length) {
      questions.splice(index, 1);
      await updateState({
        pollingConfig: Object.assign({}, sessionState.pollingConfig, {
          questions: questions
        })
      }, 'deletePollingQuestion');
    } else {
      console.error('Invalid polling question index:', index);
    }
  }

  /**
   * Set the active polling question
   * @param {number} index - The question index to activate
   * @returns {Promise<void>}
   */
  async function setActivePollingQuestion(index) {
    var questions = sessionState.pollingConfig.questions;
    if (index >= 0 && index < questions.length) {
      await updateState({
        pollingConfig: Object.assign({}, sessionState.pollingConfig, {
          currentIndex: index
        }),
        currentQuestionIndex: index
      }, 'setActivePollingQuestion');
    } else {
      console.error('Invalid polling question index:', index);
    }
  }

  // ============================================
  // Quiz Actions
  // ============================================

  /**
   * Add a quiz question
   * @param {Object} question - The quiz question object
   * @param {string} question.question - The question text
   * @param {string[]} question.options - Array of answer options
   * @param {number} question.correctAnswer - Index of the correct answer
   * @param {number} [question.timeLimit] - Time limit in seconds
   * @returns {Promise<void>}
   */
  async function addQuizQuestion(question) {
    var questions = sessionState.quizConfig.questions.slice();
    questions.push(question);
    await updateState({
      quizConfig: Object.assign({}, sessionState.quizConfig, {
        questions: questions
      })
    }, 'addQuizQuestion');
  }

  /**
   * Update a quiz question
   * @param {number} index - The question index to update
   * @param {Object} question - The new question object
   * @returns {Promise<void>}
   */
  async function updateQuizQuestion(index, question) {
    var questions = sessionState.quizConfig.questions.slice();
    if (index >= 0 && index < questions.length) {
      questions[index] = question;
      await updateState({
        quizConfig: Object.assign({}, sessionState.quizConfig, {
          questions: questions
        })
      }, 'updateQuizQuestion');
    } else {
      console.error('Invalid quiz question index:', index);
    }
  }

  /**
   * Delete a quiz question
   * @param {number} index - The question index to delete
   * @returns {Promise<void>}
   */
  async function deleteQuizQuestion(index) {
    var questions = sessionState.quizConfig.questions.slice();
    if (index >= 0 && index < questions.length) {
      questions.splice(index, 1);
      await updateState({
        quizConfig: Object.assign({}, sessionState.quizConfig, {
          questions: questions
        })
      }, 'deleteQuizQuestion');
    } else {
      console.error('Invalid quiz question index:', index);
    }
  }

  /**
   * Start a quiz question
   * @param {number} index - The question index to start
   * @returns {Promise<void>}
   */
  async function startQuizQuestion(index) {
    var questions = sessionState.quizConfig.questions;
    if (index >= 0 && index < questions.length) {
      await updateState({
        quizConfig: Object.assign({}, sessionState.quizConfig, {
          currentIndex: index,
          revealed: false
        }),
        currentQuestionIndex: index
      }, 'startQuizQuestion');
    } else {
      console.error('Invalid quiz question index:', index);
    }
  }

  /**
   * Reveal the quiz answer
   * @returns {Promise<void>}
   */
  async function revealQuizAnswer() {
    await updateState({
      quizConfig: Object.assign({}, sessionState.quizConfig, {
        revealed: true
      })
    }, 'revealQuizAnswer');
  }

  /**
   * End the quiz - reset quiz state
   * @returns {Promise<void>}
   */
  async function endQuiz() {
    await updateState({
      quizConfig: Object.assign({}, sessionState.quizConfig, {
        currentIndex: 0,
        revealed: false
      })
    }, 'endQuiz');
  }

  // Expose Session object globally
  window.Session = {
    // State access
    getState: getState,
    get sessionState() { return getState(); },

    // Event system
    onSessionChange: onSessionChange,
    notifyListeners: notifyListeners,

    // Data fetching
    fetchSessionState: fetchSessionState,
    subscribeToSession: subscribeToSession,
    unsubscribeFromSession: unsubscribeFromSession,

    // Session actions
    startSession: startSession,
    switchToPolling: switchToPolling,
    switchToQuiz: switchToQuiz,
    showLeaderboard: showLeaderboard,
    closeSession: closeSession,
    resetSession: resetSession,

    // Settings actions
    updateSettings: updateSettings,

    // Polling actions
    addPollingQuestion: addPollingQuestion,
    updatePollingQuestion: updatePollingQuestion,
    deletePollingQuestion: deletePollingQuestion,
    setActivePollingQuestion: setActivePollingQuestion,

    // Quiz actions
    addQuizQuestion: addQuizQuestion,
    updateQuizQuestion: updateQuizQuestion,
    deleteQuizQuestion: deleteQuizQuestion,
    startQuizQuestion: startQuizQuestion,
    revealQuizAnswer: revealQuizAnswer,
    endQuiz: endQuiz
  };

})(window);
