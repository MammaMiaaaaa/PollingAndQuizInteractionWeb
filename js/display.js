/**
 * Display Screen Entry Script for AnxietyTalk
 *
 * Handles the display screen initialization, view switching, and real-time updates.
 * Shows bubble cloud for polling, quiz questions, and leaderboard.
 *
 * Dependencies:
 * - js/firebase-config.js (provides db, rtdb, sessionRef, usersRef references)
 * - js/session.js (provides Session module)
 * - js/bubbles.js (provides BubbleCloud class)
 * - js/reactions.js (provides ReactionSystem class)
 * - js/quiz.js (provides QuizDisplay class)
 * - js/leaderboard.js (provides LeaderboardDisplay class)
 * - Matter.js (loaded via CDN in display.html)
 */

(function() {
  'use strict';

  // ==========================================================================
  // DOM Elements
  // ==========================================================================

  var waitingView = document.getElementById('waitingView');
  var pollingView = document.getElementById('pollingView');
  var quizView = document.getElementById('quizView');
  var leaderboardView = document.getElementById('leaderboardView');
  var closedView = document.getElementById('closedView');

  var bubbleCanvas = document.getElementById('bubbleCanvas');
  var reactionContainer = document.getElementById('reactionContainer');
  var quizContent = document.getElementById('quizContent');

  // Polling elements
  var pollingPrompt = document.getElementById('pollingPrompt');
  var pollingResponses = document.getElementById('pollingResponses');

  // Quiz elements
  var timerFill = document.getElementById('timerFill');
  var timerText = document.getElementById('timerText');
  var quizQuestion = document.getElementById('quizQuestion');
  var quizOptions = {
    A: document.getElementById('optionAText'),
    B: document.getElementById('optionBText'),
    C: document.getElementById('optionCText'),
    D: document.getElementById('optionDText')
  };
  var quizAnswerCounter = document.getElementById('quizAnswerCounter');
  var quizResultsOverlay = document.getElementById('quizResultsOverlay');
  var resultsGrid = document.getElementById('resultsGrid');
  var resultsCorrect = document.getElementById('resultsCorrect');

  // Leaderboard elements
  var leaderboardList = document.getElementById('leaderboardList');

  // ==========================================================================
  // State & Instances
  // ==========================================================================

  var bubbleCloud = null;
  var reactionSystem = null;
  var quizDisplay = null;
  var leaderboardDisplay = null;

  var currentStatus = 'waiting';
  var currentQuestionIndex = 0;
  var timerInterval = null;

  var pollingListenerActive = false;
  var quizListenerActive = false;
  var pollingUnsubscribe = null;
  var quizUnsubscribe = null;
  var lastPollQuestionIndex = -1;
  var pollAnswerCount = 0;
  var pollProcessedAnswers = {}; // Track processed answer IDs to avoid duplicates
  var quizAnswerCounts = { A: 0, B: 0, C: 0, D: 0 };

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the display screen
   */
  function init() {
    console.log('Display init starting...');

    // Initialize BubbleCloud for polling
    if (bubbleCanvas) {
      console.log('Initializing BubbleCloud...');
      bubbleCloud = new BubbleCloud('bubbleCanvas');
    }

    // Initialize ReactionSystem for floating emojis
    if (reactionContainer) {
      reactionSystem = new ReactionSystem('reactionContainer');
      reactionSystem.startListening();
    }

    // Initialize QuizDisplay
    if (quizContent) {
      quizDisplay = new QuizDisplay();
      quizDisplay.init('quizContent');
    }

    // Initialize LeaderboardDisplay
    if (leaderboardList) {
      leaderboardDisplay = new LeaderboardDisplay('leaderboardList');
    }

    // Subscribe to session updates
    Session.subscribeToSession();

    // Listen for session changes
    Session.onSessionChange(handleSessionChange);

    // Subscribe to realtime collections
    setupRealtimeListeners();

    console.log('Display initialized');
  }

  // ==========================================================================
  // Session Change Handler
  // ==========================================================================

  /**
   * Handle session state changes
   * @param {Object} payload - Session change payload containing state and action
   */
  function handleSessionChange(payload) {
    var state = payload.state;
    var action = payload.action;

    console.log('Session change:', state.status, 'action:', action);

    // Only process if status changed
    if (state.status !== currentStatus) {
      currentStatus = state.status;
      console.log('Switching to view:', state.status);
      switchView(state.status);
    }

    // Handle specific state updates
    switch (state.status) {
      case 'waiting':
        handleWaitingState(state);
        break;
      case 'polling':
        handlePollingState(state, action);
        break;
      case 'quiz':
        handleQuizState(state, action);
        break;
      case 'leaderboard':
        handleLeaderboardState(state);
        break;
      case 'closed':
        handleClosedState(state);
        break;
    }
  }

  // ==========================================================================
  // View Switching
  // ==========================================================================

  /**
   * Switch to the appropriate view based on session status
   * @param {string} status - Session status
   */
  function switchView(status) {
    var views = [waitingView, pollingView, quizView, leaderboardView, closedView];

    // Hide all views
    views.forEach(function(view) {
      if (view) {
        view.classList.add('hidden');
        view.classList.remove('active');
      }
    });

    // Show appropriate view
    var targetView = null;
    switch (status) {
      case 'waiting':
        targetView = waitingView;
        break;
      case 'polling':
        targetView = pollingView;
        break;
      case 'quiz':
        targetView = quizView;
        // Clear quiz results overlay when switching to new quiz
        if (quizResultsOverlay) {
          quizResultsOverlay.classList.add('hidden');
        }
        break;
      case 'leaderboard':
        targetView = leaderboardView;
        break;
      case 'closed':
        targetView = closedView;
        break;
      default:
        targetView = waitingView;
    }

    if (targetView) {
      targetView.classList.remove('hidden');
      targetView.classList.add('active');
    }

    // Stop any running timers when switching views
    stopTimer();
  }

  // ==========================================================================
  // Waiting State
  // ==========================================================================

  /**
   * Handle waiting state
   * @param {Object} state - Session state
   */
  function handleWaitingState(state) {
    try {
      // Clear any existing bubbles
      if (bubbleCloud) {
        bubbleCloud.clear();
      }

      // Stop polling listener if active
      if (typeof pollingUnsubscribe !== 'undefined' && pollingUnsubscribe) {
        pollingUnsubscribe();
        pollingUnsubscribe = null;
      }
    } catch (e) {
      console.error('Error in handleWaitingState:', e);
    }
  }

  // ==========================================================================
  // Polling State
  // ==========================================================================

  /**
   * Handle polling state
   * @param {Object} state - Session state
   * @param {string} action - Action that triggered the change
   */
  function handlePollingState(state, action) {
    var pollingConfig = state.pollingConfig || {};
    var questions = pollingConfig.questions || [];
    var currentIndex = pollingConfig.currentIndex || 0;
    var showResults = pollingConfig.showResults !== false;

    var question = questions[currentIndex];

    if (pollingPrompt && question) {
      pollingPrompt.textContent = question;
    }

    if (bubbleCloud) {
      requestAnimationFrame(function() {
        bubbleCloud.resize();
      });
    }

    if (!showResults) {
      if (bubbleCloud) bubbleCloud.clear();
      if (pollingResponses) pollingResponses.textContent = '0';
      if (pollingListenerActive) {
        pollingAnswersRef.off();
        pollingListenerActive = false;
      }
      lastPollQuestionIndex = -1;
      return;
    }

    if (currentIndex !== lastPollQuestionIndex) {
      lastPollQuestionIndex = currentIndex;
      setupPollingListener(currentIndex);
    }
  }

  function setupPollingListener(questionIndex) {
    if (pollingListenerActive) {
      pollingAnswersRef.off('child_added');
    }

    pollAnswerCount = 0;
    pollProcessedAnswers = {}; // Reset processed answers tracking
    pollingListenerActive = true;

    if (bubbleCloud) {
      bubbleCloud.clear();
    }

    console.log('[Display] setupPollingListener for questionIndex:', questionIndex);

    // Use once('value') to load existing answers ONCE (doesn't repeat on reconnection)
    pollingAnswersRef.once('value').then(function(snapshot) {
      snapshot.forEach(function(childSnapshot) {
        var answerId = childSnapshot.key;
        var answer = childSnapshot.val();

        if (!answer || !answer.text) return;
        if ((answer.questionIndex || 0) !== questionIndex) return;

        // Mark as processed (don't animate existing answers)
        pollProcessedAnswers[answerId] = true;

        if (bubbleCloud) {
          bubbleCloud.addBubbleImmediate(answer.text, answer.userId || 'anonymous');
        }
        pollAnswerCount++;
      });

      if (pollingResponses) {
        pollingResponses.textContent = pollAnswerCount;
      }

      // Now set up child_added for NEW answers only
      // This listener will only fire for children added AFTER this point
      pollingAnswersRef.on('child_added', function(snapshot) {
        var answerId = snapshot.key;
        var answer = snapshot.val();

        // Skip if already processed (from the once('value') load)
        if (pollProcessedAnswers[answerId]) return;
        pollProcessedAnswers[answerId] = true;

        if (!answer || !answer.text) return;
        if ((answer.questionIndex || 0) !== questionIndex) return;

        if (bubbleCloud) {
          bubbleCloud.addBubble(answer.text, answer.userId || 'anonymous');
        }
        pollAnswerCount++;

        if (pollingResponses) {
          pollingResponses.textContent = pollAnswerCount;
        }
      });

    }).catch(function(error) {
      console.error('[Display] Polling initial load error:', error);
    });
  }

  // ==========================================================================
  // Quiz State
  // ==========================================================================

  /**
   * Handle quiz state
   * @param {Object} state - Session state
   * @param {string} action - Action that triggered the change
   */
  function handleQuizState(state, action) {
    console.log('[Display] handleQuizState called:', { action: action, state: state });

    var quizConfig = state.quizConfig || {};
    var questions = quizConfig.questions || [];
    var currentIndex = quizConfig.currentIndex || 0;
    var revealed = quizConfig.revealed || false;

    console.log('[Display] Quiz questions:', questions.length, 'at index:', currentIndex);

    // Get current question
    var question = questions[currentIndex];

    if (!question) {
      console.warn('[Display] No quiz question found at index', currentIndex, 'questions length:', questions.length);
      // Try to fetch from Firestore as fallback
      fetchQuizFromFirestore(currentIndex);
      return;
    }

    // Check if this is a reveal action
    if (revealed) {
      revealQuizAnswer(question);
      return;
    }

    // Show the question (always show when status is 'quiz')
    currentQuestionIndex = currentIndex;
    showQuizQuestion(question, quizConfig.timePerQuestion || 30);
  }

  /**
   * Fallback: fetch quiz questions from Firestore if Realtime Database didn't have them
   * @param {number} currentIndex - The question index to fetch
   */
  function fetchQuizFromFirestore(currentIndex) {
    console.log('[Display] Fetching quiz from Firestore as fallback...');

    sessionRef.get().then(function(doc) {
      if (doc.exists) {
        var data = doc.data();
        var quizConfig = data.quizConfig || {};
        var questions = quizConfig.questions || [];

        console.log('[Display] Firestore quiz questions:', questions.length);

        var question = questions[currentIndex];
        if (question) {
          console.log('[Display] Found question in Firestore, showing now');
          currentQuestionIndex = currentIndex;
          showQuizQuestion(question, quizConfig.timePerQuestion || 30);
        }
      }
    }).catch(function(error) {
      console.error('[Display] Error fetching from Firestore:', error);
    });
  }

  /**
   * Show quiz question on display
   * @param {Object} question - Question object
   * @param {number} timeLimit - Time limit in seconds
   */
  function showQuizQuestion(question, timeLimit) {
    // Update question text
    if (quizQuestion) {
      quizQuestion.textContent = question.text || 'Loading...';
    }

    // Update option texts
    if (question.options) {
      question.options.forEach(function(option, index) {
        var key = ['A', 'B', 'C', 'D'][index];
        if (quizOptions[key]) {
          quizOptions[key].textContent = option;
        }
      });
    }

    // Reset timer display
    if (timerText) {
      timerText.textContent = timeLimit;
    }
    if (timerFill) {
      timerFill.style.width = '100%';
    }

    // Hide results overlay
    if (quizResultsOverlay) {
      quizResultsOverlay.classList.add('hidden');
    }

    // Reset answer counter
    if (quizAnswerCounter) {
      quizAnswerCounter.textContent = '0 orang sudah menjawab';
    }

    // Reset quiz results grid
    if (resultsGrid) {
      resultsGrid.innerHTML = '';
    }

    // Start timer
    startTimer(timeLimit);

    // Setup quiz answer listener
    setupQuizListener();
  }

  /**
   * Start quiz countdown timer
   * @param {number} duration - Timer duration in seconds
   */
  function startTimer(duration) {
    stopTimer(); // Clear any existing timer

    var remaining = duration;
    var total = duration;

    timerInterval = setInterval(function() {
      remaining--;

      // Update timer text
      if (timerText) {
        timerText.textContent = remaining;
      }

      // Update timer fill bar
      if (timerFill) {
        var percentage = (remaining / total) * 100;
        timerFill.style.width = percentage + '%';

        // Change color when low on time
        if (remaining <= 5) {
          timerFill.style.backgroundColor = '#FF2D2D';
        }
      }

      // Time's up
      if (remaining <= 0) {
        stopTimer();
        handleQuizTimeUp();
      }
    }, 1000);
  }

  /**
   * Stop the countdown timer
   */
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  /**
   * Handle quiz time up
   */
  function handleQuizTimeUp() {
    // Reveal the correct answer
    var state = Session.getState();
    var quizConfig = state.quizConfig || {};
    var questions = quizConfig.questions || [];
    var question = questions[currentQuestionIndex];

    if (question) {
      revealQuizAnswer(question);
    }
  }

  /**
   * Reveal the quiz answer
   * @param {Object} question - Question object
   */
  function revealQuizAnswer(question) {
    stopTimer();

    // Show results overlay
    if (quizResultsOverlay) {
      quizResultsOverlay.classList.remove('hidden');
    }

    // Count answers by option
    var counts = { A: 0, B: 0, C: 0, D: 0 };

    // Note: In a real implementation, we would get actual answer counts from the database
    // For now, we'll just highlight the correct answer

    // Update results grid
    if (resultsGrid) {
      var correctIndex = question.correctIndex || 0;
      var letters = ['A', 'B', 'C', 'D'];

      var maxCount = Math.max.apply(null, Object.values(quizAnswerCounts).concat([1]));

      resultsGrid.innerHTML = question.options.map(function(option, index) {
        var letter = letters[index];
        var count = quizAnswerCounts[letter] || 0;
        var isCorrect = index === correctIndex;
        var heightPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
        return '<div class="result-bar">' +
               '<span class="result-bar-label">' + letter + '</span>' +
               '<div class="result-bar-fill" data-answer="' + letter + '" style="--fill-height: ' + heightPercent + '%;">' +
               '<span style="position:absolute;top:8px;font-family:var(--font-display);font-size:var(--text-xl);color:#fff;">' + count + '</span>' +
               '</div>' +
               '<span class="result-bar-count">' + (isCorrect ? '&#10003; ' : '') + count + '</span>' +
               '</div>';
      }).join('');
    }

    // Update correct answer text
    if (resultsCorrect) {
      resultsCorrect.textContent = 'Correct answer: ' + ['A', 'B', 'C', 'D'][correctIndex];
    }
  }

  /**
   * Setup real-time listener for quiz answers
   */
  function setupQuizListener() {
    if (quizListenerActive) {
      quizAnswersRef.off('child_added');
    }

    var currentIndex = (Session.getState().quizConfig || {}).currentIndex || 0;
    quizAnswerCounts = { A: 0, B: 0, C: 0, D: 0 };
    quizListenerActive = true;

    quizAnswersRef.on('child_added', function(snapshot) {
      var answer = snapshot.val();
      if (!answer || typeof answer.selectedIndex !== 'number') return;
      if ((answer.questionIndex || 0) !== currentIndex) return;

      var option = ['A', 'B', 'C', 'D'][answer.selectedIndex];
      if (option && quizAnswerCounts.hasOwnProperty(option)) {
        quizAnswerCounts[option]++;
      }

      Object.keys(quizAnswerCounts).forEach(function(opt) {
        var el = document.getElementById('result' + opt);
        if (el) {
          el.textContent = quizAnswerCounts[opt];
        }
      });

      var totalCount = Object.values(quizAnswerCounts).reduce(function(sum, count) { return sum + count; }, 0);
      if (quizAnswerCounter) {
        quizAnswerCounter.textContent = totalCount + ' orang sudah menjawab';
      }
    }, function(error) {
      console.error('Quiz listener error:', error);
      });
  }

  // ==========================================================================
  // Leaderboard State
  // ==========================================================================

  /**
   * Handle leaderboard state
   * @param {Object} state - Session state
   */
  function handleLeaderboardState(state) {
    // Fetch all users and show leaderboard
    usersRef.get().then(function(snapshot) {
      var users = [];

      snapshot.forEach(function(doc) {
        var userData = doc.data();
        userData.id = doc.id;
        users.push(userData);
      });

      if (leaderboardDisplay) {
        if (state.leaderboardType === 'interim') {
          leaderboardDisplay.showInterim(users, 5);
        } else {
          leaderboardDisplay.showFinal(users);
        }
      }
    }).catch(function(error) {
      console.error('Failed to fetch users for leaderboard:', error);
    });
  }

  // ==========================================================================
  // Closed State
  // ==========================================================================

  /**
   * Handle closed state
   * @param {Object} state - Session state
   */
  function handleClosedState(state) {
    try {
      // Clear all displays
      if (bubbleCloud) {
        bubbleCloud.clear();
      }

      stopTimer();

      // Cleanup listeners
      if (typeof pollingUnsubscribe !== 'undefined' && pollingUnsubscribe) {
        pollingUnsubscribe();
        pollingUnsubscribe = null;
      }
      if (typeof quizUnsubscribe !== 'undefined' && quizUnsubscribe) {
        quizUnsubscribe();
        quizUnsubscribe = null;
      }
    } catch (e) {
      console.error('Error in handleClosedState:', e);
    }
  }

  // ==========================================================================
  // Realtime Listeners Setup
  // ==========================================================================

  /**
   * Setup all realtime listeners
   */
  function setupRealtimeListeners() {
    // Initial session state fetch
    Session.fetchSessionState();
  }

  // ==========================================================================
  // Cleanup on Unload
  // ==========================================================================

  /**
   * Cleanup resources on page unload
   */
  function cleanup() {
    stopTimer();

    if (pollingUnsubscribe) {
      pollingUnsubscribe();
      pollingUnsubscribe = null;
    }

    if (quizUnsubscribe) {
      quizUnsubscribe();
      quizUnsubscribe = null;
    }

    if (reactionSystem) {
      reactionSystem.destroy();
      reactionSystem = null;
    }

    if (bubbleCloud) {
      bubbleCloud.destroy();
      bubbleCloud = null;
    }
  }

  window.addEventListener('beforeunload', cleanup);

  // ==========================================================================
  // Start
  // ==========================================================================

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
