/**
 * User Join Page Entry Script for AnxietyTalk
 *
 * Handles user join flow, session interactions, polling, quiz, and reactions.
 * This script manages the mobile user experience.
 *
 * Dependencies:
 * - js/firebase-config.js (provides db, rtdb, sessionRef, usersRef, quizAnswersRef, pollingAnswersRef references)
 * - js/user.js (provides User module)
 * - js/session.js (provides Session module)
 * - js/reactions.js (provides ReactionBar class)
 * - js/quiz.js (provides QuizUser class)
 * - js/leaderboard.js (provides LeaderboardUser class)
 */

(function() {
  'use strict';

  // ==========================================================================
  // DOM Elements
  // ==========================================================================

  // Join elements
  var joinContainer = document.getElementById('joinContainer');
  var joinForm = document.getElementById('joinForm');
  var nameInput = document.getElementById('nameInput');
  var joinError = document.getElementById('joinError');

  // Session elements
  var sessionContainer = document.getElementById('sessionContainer');
  var userName = document.getElementById('userName');
  var userScore = document.getElementById('userScore');
  var reactionBar = document.getElementById('reactionBar');

  // State views
  var waitingState = document.getElementById('waitingState');
  var pollingState = document.getElementById('pollingState');
  var quizState = document.getElementById('quizState');
  var leaderboardState = document.getElementById('leaderboardState');

  // Polling elements
  var pollPrompt = document.getElementById('pollPrompt');
  var keywordButtons = document.getElementById('keywordButtons');
  var customKeywordInput = document.getElementById('customKeywordInput');
  var sendCustomKeyword = document.getElementById('sendCustomKeyword');

  // Quiz elements
  var quizTimerProgress = document.getElementById('quizTimerProgress');
  var quizTimerValue = document.getElementById('quizTimerValue');
  var quizPromptText = document.getElementById('quizPromptText');
  var quizAnswerButtons = document.getElementById('quizAnswerButtons');
  var quizFeedback = document.getElementById('quizFeedback');

  // Leaderboard elements
  var miniLeaderboard = document.getElementById('miniLeaderboard');
  var yourRank = document.getElementById('yourRank');

  // Connection status
  var connectionStatus = document.getElementById('connectionStatus');

  // ==========================================================================
  // State
  // ==========================================================================

  var currentUser = null;
  var currentStatus = 'waiting';
  var sessionSettings = null;
  var hasAnsweredPoll = false;
  var hasAnsweredQuiz = false;
  var quizTimerInterval = null;

  var reactionBarInstance = null;
  var quizUserInstance = null;
  var leaderboardUserInstance = null;

  var sessionUnsubscribe = null;

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the user page
   */
  function init() {
    // Check connection status
    updateConnectionStatus('connecting');

    // Check if already joined
    User.getCurrentUser().then(function(user) {
      if (user) {
        // User already joined
        currentUser = user;
        showSessionView();
      } else {
        // Need to join
        setupJoinForm();
      }

      // Subscribe to session updates
      Session.subscribeToSession();
      Session.onSessionChange(handleSessionChange);

      // Update connection status
      updateConnectionStatus('connected');

    }).catch(function(error) {
      console.error('Error checking current user:', error);
      setupJoinForm();
      updateConnectionStatus('error');
    });
  }

  // ==========================================================================
  // Join Form
  // ==========================================================================

  /**
   * Setup join form
   */
  function setupJoinForm() {
    if (!joinContainer) return;

    // Show join container
    joinContainer.classList.remove('hidden');
    if (sessionContainer) {
      sessionContainer.classList.add('hidden');
    }

    // Setup form submission
    if (joinForm) {
      joinForm.addEventListener('submit', function(e) {
        e.preventDefault();
        handleJoin();
      });
    }
  }

  /**
   * Handle join form submission
   */
  function handleJoin() {
    var name = nameInput.value.trim();

    if (!name) {
      showJoinError('Please enter your name');
      return;
    }

    if (name.length < 2) {
      showJoinError('Name must be at least 2 characters');
      return;
    }

    hideJoinError();

    User.joinSession(name).then(function(result) {
      currentUser = result;
      showSessionView();

      // Update user score display
      updateUserScore();

    }).catch(function(error) {
      console.error('Join error:', error);
      showJoinError('Failed to join session. Please try again.');
    });
  }

  /**
   * Show join error message
   * @param {string} message - Error message
   */
  function showJoinError(message) {
    if (joinError) {
      joinError.textContent = message;
      joinError.classList.remove('hidden');
    }
  }

  /**
   * Hide join error message
   */
  function hideJoinError() {
    if (joinError) {
      joinError.classList.add('hidden');
    }
  }

  // ==========================================================================
  // Session View
  // ==========================================================================

  /**
   * Show session view after joining
   */
  function showSessionView() {
    if (!joinContainer || !sessionContainer) return;

    // Hide join container, show session
    joinContainer.classList.add('hidden');
    sessionContainer.classList.remove('hidden');

    // Update user name display
    if (userName && currentUser) {
      userName.textContent = currentUser.name;
    }

    // Initialize ReactionBar with emojis from settings
    initReactionBar();

    // Initialize QuizUser
    initQuizUser();

    // Initialize LeaderboardUser
    initLeaderboardUser();

    // Fetch session settings
    fetchSessionSettings();
  }

  /**
   * Fetch session settings from Firestore
   */
  function fetchSessionSettings() {
    User.getSessionSettings().then(function(settings) {
      sessionSettings = settings;

      // Update reaction bar with configured emojis
      if (sessionSettings && sessionSettings.defaultSettings && reactionBarInstance) {
        var emojis = sessionSettings.defaultSettings.emojis || ['😰', '😤', '😢', '😅', '🙏'];
        reactionBarInstance.updateEmojis(emojis);
      }

    }).catch(function(error) {
      console.error('Error fetching session settings:', error);
    });
  }

  // ==========================================================================
  // Reaction Bar
  // ==========================================================================

  /**
   * Initialize reaction bar
   */
  function initReactionBar() {
    if (!reactionBar) return;

    // Default emojis (will be updated from settings)
    var emojis = ['😰', '😤', '😢', '😅', '🙏'];

    // Create reaction bar instance
    reactionBarInstance = new ReactionBar('reactionBar', emojis, function(emoji) {
      handleReaction(emoji);
    });
  }

  /**
   * Handle reaction button click
   * @param {string} emoji - The emoji that was clicked
   */
  function handleReaction(emoji) {
    if (!reactionBarInstance || !currentUser) return;

    // Send reaction to database
    reactionBarInstance.sendReaction(emoji, currentUser.userId).then(function() {
      console.log('Reaction sent:', emoji);

      // Update score (reaction points are handled server-side)
      updateUserScore();

    }).catch(function(error) {
      console.error('Failed to send reaction:', error);
    });
  }

  // ==========================================================================
  // Quiz User
  // ==========================================================================

  /**
   * Initialize QuizUser instance
   */
  function initQuizUser() {
    if (!quizState) return;

    quizUserInstance = new QuizUser();
    quizUserInstance.init(quizState);

    // Setup answer selection callback
    quizUserInstance.onAnswerSelect = function(index) {
      handleQuizAnswer(index);
    };
  }

  // ==========================================================================
  // Leaderboard User
  // ==========================================================================

  /**
   * Initialize LeaderboardUser instance
   */
  function initLeaderboardUser() {
    if (!miniLeaderboard) return;

    leaderboardUserInstance = new LeaderboardUser('leaderboardState');
  }

  // ==========================================================================
  // Session Change Handler
  // ==========================================================================

  /**
   * Handle session state changes
   * @param {Object} payload - Session change payload
   */
  function handleSessionChange(payload) {
    var state = payload.state;
    var action = payload.action;

    // Update current status
    var newStatus = state.status || 'waiting';

    // Only switch views if status changed
    if (newStatus !== currentStatus) {
      currentStatus = newStatus;
      switchStateView(newStatus);
    }

    // Handle specific state
    switch (newStatus) {
      case 'waiting':
        handleWaitingState();
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
        handleClosedState();
        break;
    }
  }

  // ==========================================================================
  // View Switching
  // ==========================================================================

  /**
   * Switch between state views
   * @param {string} status - Session status
   */
  function switchStateView(status) {
    var views = [waitingState, pollingState, quizState, leaderboardState];

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
        targetView = waitingState;
        break;
      case 'polling':
        targetView = pollingState;
        break;
      case 'quiz':
        targetView = quizState;
        hasAnsweredQuiz = false; // Reset for new quiz
        break;
      case 'leaderboard':
        targetView = leaderboardState;
        break;
      default:
        targetView = waitingState;
    }

    if (targetView) {
      targetView.classList.remove('hidden');
      targetView.classList.add('active');
    }

    // Stop quiz timer when switching views
    stopQuizTimer();
  }

  // ==========================================================================
  // Waiting State
  // ==========================================================================

  /**
   * Handle waiting state
   */
  function handleWaitingState() {
    hasAnsweredPoll = false;
    // Reset any poll-related state if needed
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

    // Get current question
    var question = questions[currentIndex];

    // Update poll prompt
    if (pollPrompt && question) {
      pollPrompt.textContent = question;
    }

    // Reset poll answered flag
    hasAnsweredPoll = false;

    // Generate keyword buttons
    generateKeywordButtons();

    // Setup custom keyword input
    setupCustomKeywordInput();
  }

  /**
   * Generate keyword buttons for quick responses
   */
  function generateKeywordButtons() {
    if (!keywordButtons) return;

    var keywords = ['anxious', 'stressed', 'calm', 'happy', 'worried', 'relaxed'];

    keywordButtons.innerHTML = keywords.map(function(keyword) {
      return '<button class="keyword-btn" data-keyword="' + keyword + '">' + keyword + '</button>';
    }).join('');

    // Add click handlers
    keywordButtons.querySelectorAll('.keyword-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var keyword = this.getAttribute('data-keyword');
        sendPollAnswer(keyword);
      });
    });
  }

  /**
   * Setup custom keyword input
   */
  function setupCustomKeywordInput() {
    if (!sendCustomKeyword || !customKeywordInput) return;

    sendCustomKeyword.addEventListener('click', function() {
      var text = customKeywordInput.value.trim();
      if (text) {
        sendPollAnswer(text);
        customKeywordInput.value = '';
      }
    });

    // Allow Enter key to submit
    if (customKeywordInput) {
      customKeywordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
          var text = this.value.trim();
          if (text) {
            sendPollAnswer(text);
            this.value = '';
          }
        }
      });
    }
  }

  /**
   * Send poll answer to database
   * @param {string} text - Answer text
   */
  function sendPollAnswer(text) {
    if (!currentUser || hasAnsweredPoll) return;

    hasAnsweredPoll = true;

    User.addPollingAnswer(currentUser.userId, 'current', text).then(function() {
      console.log('Poll answer sent:', text);
      updateUserScore();

      // Visual feedback
      if (pollPrompt) {
        pollPrompt.textContent = 'Answer sent!';
      }

    }).catch(function(error) {
      console.error('Failed to send poll answer:', error);
      hasAnsweredPoll = false; // Allow retry
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
    var quizConfig = state.quizConfig || {};
    var questions = quizConfig.questions || [];
    var currentIndex = quizConfig.currentIndex || 0;
    var timeLimit = quizConfig.timePerQuestion || 30;
    var revealed = quizConfig.revealed || false;

    // Get current question
    var question = questions[currentIndex];

    if (!question) {
      console.warn('No quiz question found');
      return;
    }

    // Check if answer should be revealed
    if (revealed) {
      showQuizResult(question, null, true);
      return;
    }

    // Show new question
    showQuizQuestion(question, timeLimit);
  }

  /**
   * Show quiz question to user
   * @param {Object} question - Question object
   * @param {number} timeLimit - Time limit in seconds
   */
  function showQuizQuestion(question, timeLimit) {
    if (quizPromptText) {
      quizPromptText.textContent = question.text || 'Loading...';
    }

    // Update answer options
    if (question.options) {
      var optionIds = ['quizAnswerA', 'quizAnswerB', 'quizAnswerC', 'quizAnswerD'];
      question.options.forEach(function(option, index) {
        var el = document.getElementById(optionIds[index]);
        if (el) {
          el.textContent = option;
        }
      });
    }

    // Reset answer buttons
    if (quizAnswerButtons) {
      var buttons = quizAnswerButtons.querySelectorAll('.quiz-answer-btn');
      buttons.forEach(function(btn) {
        btn.classList.remove('selected', 'correct', 'incorrect');
        btn.disabled = false;
      });
    }

    // Hide feedback
    if (quizFeedback) {
      quizFeedback.classList.add('hidden');
    }

    // Start timer
    startQuizTimer(timeLimit, question);

    // Reset answered flag
    hasAnsweredQuiz = false;
  }

  /**
   * Start quiz countdown timer
   * @param {number} duration - Timer duration in seconds
   * @param {Object} question - Current question
   */
  function startQuizTimer(duration, question) {
    stopQuizTimer();

    var remaining = duration;
    var total = duration;
    var circumference = 2 * Math.PI * 45; // Circle radius is 45

    if (quizTimerProgress) {
      quizTimerProgress.style.strokeDasharray = circumference;
      quizTimerProgress.style.strokeDashoffset = 0;
    }

    quizTimerInterval = setInterval(function() {
      remaining--;

      // Update timer text
      if (quizTimerValue) {
        quizTimerValue.textContent = remaining;
      }

      // Update circular progress
      if (quizTimerProgress) {
        var offset = circumference * (1 - remaining / total);
        quizTimerProgress.style.strokeDashoffset = offset;

        // Change color when low on time
        if (remaining <= 5) {
          quizTimerProgress.style.stroke = '#FF2D2D';
        }
      }

      // Time's up
      if (remaining <= 0) {
        stopQuizTimer();
        showQuizResult(question, null, true); // Show correct answer, no selection
      }
    }, 1000);
  }

  /**
   * Stop quiz timer
   */
  function stopQuizTimer() {
    if (quizTimerInterval) {
      clearInterval(quizTimerInterval);
      quizTimerInterval = null;
    }
  }

  /**
   * Handle quiz answer selection
   * @param {number} index - Selected option index (0-3)
   */
  function handleQuizAnswer(index) {
    if (!currentUser || hasAnsweredQuiz) return;

    hasAnsweredQuiz = true;
    stopQuizTimer();

    // Disable all buttons
    if (quizAnswerButtons) {
      var buttons = quizAnswerButtons.querySelectorAll('.quiz-answer-btn');
      buttons.forEach(function(btn) {
        btn.disabled = true;
      });
    }

    // Get current question from session state
    var state = Session.getState();
    var quizConfig = state.quizConfig || {};
    var questions = quizConfig.questions || [];
    var question = questions[quizConfig.currentIndex || 0];

    // Submit answer to Firestore
    submitQuizAnswer(index, question);

    // Calculate points (simplified - actual calculation done server-side)
    var isCorrect = index === question.correctIndex;
    var points = isCorrect ? 1000 : 0;

    // Show result
    showQuizResult(question, index, false);
  }

  /**
   * Submit quiz answer to database
   * @param {number} selectedIndex - Selected option index
   * @param {Object} question - Question object
   */
  function submitQuizAnswer(selectedIndex, question) {
    var answerData = {
      userId: currentUser.userId,
      questionId: 'current',
      selectedIndex: selectedIndex,
      isCorrect: selectedIndex === question.correctIndex,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    quizAnswersRef.add(answerData).then(function() {
      console.log('Quiz answer submitted');
      updateUserScore();

      // Award points if correct
      if (selectedIndex === question.correctIndex) {
        User.updateUserPoints(currentUser.userId, 'quiz', 1000);
      }

    }).catch(function(error) {
      console.error('Failed to submit quiz answer:', error);
    });
  }

  /**
   * Show quiz result to user
   * @param {Object} question - Question object
   * @param {number|null} selectedIndex - Selected index or null if time up
   * @param {boolean} timedUp - Whether time ran out
   */
  function showQuizResult(question, selectedIndex, timedUp) {
    stopQuizTimer();

    var isCorrect = selectedIndex !== null && selectedIndex === question.correctIndex;
    var points = isCorrect ? 1000 : 0;

    // Highlight buttons
    if (quizAnswerButtons) {
      var buttons = quizAnswerButtons.querySelectorAll('.quiz-answer-btn');
      buttons.forEach(function(btn, index) {
        btn.disabled = true;

        if (index === question.correctIndex) {
          btn.classList.add('correct');
        } else if (index === selectedIndex && !isCorrect) {
          btn.classList.add('incorrect');
        }
      });
    }

    // Show feedback
    if (quizFeedback) {
      quizFeedback.classList.remove('hidden');
      if (timedUp) {
        quizFeedback.textContent = "Time's up! +0 points";
        quizFeedback.style.color = '#FFE500';
      } else if (isCorrect) {
        quizFeedback.textContent = 'Correct! +' + points + ' points';
        quizFeedback.style.color = '#B5FF4D';
      } else {
        quizFeedback.textContent = 'Wrong! +0 points';
        quizFeedback.style.color = '#FF2D2D';
      }
    }
  }

  // ==========================================================================
  // Leaderboard State
  // ==========================================================================

  /**
   * Handle leaderboard state
   * @param {Object} state - Session state
   */
  function handleLeaderboardState(state) {
    if (!currentUser || !leaderboardUserInstance) return;

    // Fetch all users
    usersRef.get().then(function(snapshot) {
      var users = [];

      snapshot.forEach(function(doc) {
        var userData = doc.data();
        userData.id = doc.id;
        users.push(userData);
      });

      // Show personal rank
      leaderboardUserInstance.showPersonalRank(currentUser.userId, users);

      // Update mini leaderboard display
      updateMiniLeaderboard(users);

    }).catch(function(error) {
      console.error('Failed to fetch leaderboard:', error);
    });
  }

  /**
   * Update mini leaderboard display
   * @param {Array} users - Array of user objects
   */
  function updateMiniLeaderboard(users) {
    if (!miniLeaderboard) return;

    // Sort users by points
    var sorted = users.slice().sort(function(a, b) {
      var pointsA = (a.points && a.points.total) || 0;
      var pointsB = (b.points && b.points.total) || 0;
      return pointsB - pointsA;
    });

    // Take top 5
    var top5 = sorted.slice(0, 5);

    var html = '<div class="mini-leaderboard-list">';
    top5.forEach(function(user, index) {
      var rank = index + 1;
      var medal = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : rank + 'th';
      var totalPoints = (user.points && user.points.total) || 0;

      html += '<div class="mini-leaderboard-item">';
      html += '<span class="mini-rank">' + medal + '</span>';
      html += '<span class="mini-name">' + escapeHtml(user.name || 'Anonymous') + '</span>';
      html += '<span class="mini-points">' + totalPoints + '</span>';
      html += '</div>';
    });
    html += '</div>';

    miniLeaderboard.innerHTML = html;

    // Update user's rank display
    if (yourRank && currentUser) {
      var userRank = sorted.findIndex(function(u) { return u.id === currentUser.userId; }) + 1;
      if (userRank > 0) {
        yourRank.textContent = 'Your rank: #' + userRank;
      }
    }
  }

  // ==========================================================================
  // Closed State
  // ==========================================================================

  /**
   * Handle closed state
   */
  function handleClosedState() {
    stopQuizTimer();
    // Could show a "session ended" message
  }

  // ==========================================================================
  // User Score
  // ==========================================================================

  /**
   * Update user score display
   */
  function updateUserScore() {
    if (!currentUser) return;

    User.getCurrentUser().then(function(user) {
      if (user && user.points) {
        var total = user.points.total || 0;
        if (userScore) {
          userScore.textContent = total;
        }
      }
    }).catch(function(error) {
      console.error('Error updating user score:', error);
    });
  }

  // ==========================================================================
  // Connection Status
  // ==========================================================================

  /**
   * Update connection status indicator
   * @param {string} status - Connection status ('connecting', 'connected', 'error')
   */
  function updateConnectionStatus(status) {
    if (!connectionStatus) return;

    var statusDot = connectionStatus.querySelector('.status-dot');
    var statusText = connectionStatus.querySelector('.status-text');

    switch (status) {
      case 'connecting':
        if (statusDot) statusDot.className = 'status-dot connecting';
        if (statusText) statusText.textContent = 'Connecting...';
        break;
      case 'connected':
        if (statusDot) statusDot.className = 'status-dot connected';
        if (statusText) statusText.textContent = 'Connected';
        break;
      case 'error':
        if (statusDot) statusDot.className = 'status-dot error';
        if (statusText) statusText.textContent = 'Connection error';
        break;
    }
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==========================================================================
  // Cleanup on Unload
  // ==========================================================================

  function cleanup() {
    stopQuizTimer();

    if (sessionUnsubscribe) {
      sessionUnsubscribe();
      sessionUnsubscribe = null;
    }

    if (reactionBarInstance) {
      reactionBarInstance.destroy();
      reactionBarInstance = null;
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
