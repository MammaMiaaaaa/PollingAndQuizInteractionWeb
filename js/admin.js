/**
 * Admin Panel Entry Script for AnxietyTalk
 *
 * Handles admin authentication, session control, and admin dashboard initialization.
 * This script executes on page load and sets up all admin functionality.
 *
 * Dependencies:
 * - js/firebase-config.js (provides db, rtdb, sessionRef, usersRef references)
 * - js/auth.js (provides Auth module)
 * - js/session.js (provides Session module)
 * - QRCode.js (loaded via CDN in admin.html)
 */

(function() {
  'use strict';

  // ==========================================================================
  // DOM Elements
  // ==========================================================================

  var loginScreen = document.getElementById('loginScreen');
  var adminDashboard = document.getElementById('adminDashboard');
  var loginForm = document.getElementById('loginForm');
  var passwordInput = document.getElementById('passwordInput');
  var loginError = document.getElementById('loginError');

  // Navigation elements
  var navItems = document.querySelectorAll('.nav-item');
  var sections = document.querySelectorAll('.admin-section');

  // Session elements
  var sessionStatusBadge = document.getElementById('sessionStatusBadge');
  var startSessionBtn = document.getElementById('startSessionBtn');
  var closeSessionBtn = document.getElementById('closeSessionBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var userCount = document.getElementById('userCount');

  // Polling elements
  var pollingPrompt = document.getElementById('pollingPrompt');
  var startPollingBtn = document.getElementById('startPollingBtn');
  var stopPollingBtn = document.getElementById('stopPollingBtn');
  var pollingResultsContainer = document.getElementById('pollingResultsContainer');

  // Quiz elements
  var quizQuestion = document.getElementById('quizQuestion');
  var quizOptions = {
    A: document.getElementById('quizOptionA'),
    B: document.getElementById('quizOptionB'),
    C: document.getElementById('quizOptionC'),
    D: document.getElementById('quizOptionD')
  };
  var correctAnswer = document.getElementById('correctAnswer');
  var quizTimer = document.getElementById('quizTimer');
  var startQuizBtn = document.getElementById('startQuizBtn');
  var stopQuizBtn = document.getElementById('stopQuizBtn');
  var showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
  var resultCounts = {
    A: document.getElementById('resultA'),
    B: document.getElementById('resultB'),
    C: document.getElementById('resultC'),
    D: document.getElementById('resultD')
  };

  // Settings elements
  var adminPassword = document.getElementById('adminPassword');
  var confirmPassword = document.getElementById('confirmPassword');
  var updatePasswordBtn = document.getElementById('updatePasswordBtn');

  // ==========================================================================
  // State
  // ==========================================================================

  var currentSection = 'session';
  var currentUser = null;
  var usersUnsubscribe = null;
  var quizAnswersUnsubscribe = null;
  var pollingAnswersUnsubscribe = null;

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the admin panel
   */
  function init() {
    // Check if already logged in
    if (Auth.isLoggedIn()) {
      showDashboard();
    } else {
      showLogin();
    }

    // Initialize auth settings
    Auth.initAuth().catch(function(error) {
      console.error('Failed to initialize auth:', error);
    });

    // Subscribe to session updates
    Session.subscribeToSession();

    // Listen for session changes
    Session.onSessionChange(handleSessionChange);

    // Setup event listeners
    setupLoginForm();
    setupNavigation();
    setupSessionControls();
    setupUserListener();
  }

  // ==========================================================================
  // Authentication
  // ==========================================================================

  /**
   * Show login screen
   */
  function showLogin() {
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');
  }

  /**
   * Show admin dashboard
   */
  function showDashboard() {
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.remove('hidden');

    // Setup QR code
    setupQRCode();

    // Fetch initial session state
    Session.fetchSessionState();
  }

  /**
   * Setup login form submission
   */
  function setupLoginForm() {
    if (!loginForm) return;

    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();

      var password = passwordInput.value.trim();

      if (!password) {
        showLoginError('Please enter a password');
        return;
      }

      Auth.login(password).then(function(success) {
        if (success) {
          showDashboard();
        } else {
          showLoginError('Incorrect password. Please try again.');
        }
      }).catch(function(error) {
        console.error('Login error:', error);
        showLoginError('Login failed. Please try again.');
      });
    });
  }

  /**
   * Show login error message
   * @param {string} message - Error message to display
   */
  function showLoginError(message) {
    if (loginError) {
      loginError.textContent = message;
      loginError.classList.remove('hidden');
    }
  }

  // ==========================================================================
  // Navigation
  // ==========================================================================

  /**
   * Setup navigation - nav items to sections
   */
  function setupNavigation() {
    if (!navItems || !sections) return;

    navItems.forEach(function(item) {
      item.addEventListener('click', function() {
        var section = this.getAttribute('data-section');
        if (section) {
          navigateToSection(section);
        }
      });
    });
  }

  /**
   * Navigate to a specific section
   * @param {string} sectionName - Name of the section to show
   */
  function navigateToSection(sectionName) {
    // Update nav items
    navItems.forEach(function(item) {
      if (item.getAttribute('data-section') === sectionName) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update sections
    sections.forEach(function(section) {
      if (section.id === sectionName + 'Section') {
        section.classList.remove('hidden');
      } else {
        section.classList.add('hidden');
      }
    });

    currentSection = sectionName;
  }

  // ==========================================================================
  // Session Controls
  // ==========================================================================

  /**
   * Setup session control buttons
   */
  function setupSessionControls() {
    // Logout button
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        Auth.logout();
        showLogin();
      });
    }

    // Session controls
    if (startSessionBtn) {
      startSessionBtn.addEventListener('click', function() {
        Session.startSession().catch(function(error) {
          console.error('Failed to start session:', error);
        });
      });
    }

    if (closeSessionBtn) {
      closeSessionBtn.addEventListener('click', function() {
        Session.closeSession().catch(function(error) {
          console.error('Failed to close session:', error);
        });
      });
    }

    // Polling controls
    if (startPollingBtn) {
      startPollingBtn.addEventListener('click', function() {
        var prompt = pollingPrompt.value.trim();
        if (prompt) {
          Session.addPollingQuestion(prompt).then(function() {
            Session.switchToPolling();
          }).catch(function(error) {
            console.error('Failed to start polling:', error);
          });
        }
      });
    }

    if (stopPollingBtn) {
      stopPollingBtn.addEventListener('click', function() {
        Session.startSession().catch(function(error) {
          console.error('Failed to stop polling:', error);
        });
      });
    }

    // Quiz controls
    if (startQuizBtn) {
      startQuizBtn.addEventListener('click', function() {
        var question = quizQuestion.value.trim();
        var options = [
          quizOptions.A.value.trim(),
          quizOptions.B.value.trim(),
          quizOptions.C.value.trim(),
          quizOptions.D.value.trim()
        ];
        var correct = correctAnswer.value;
        var timer = parseInt(quizTimer.value, 10) || 30;

        // Validate inputs
        if (!question || options.some(function(o) { return !o; })) {
          alert('Please fill in all quiz fields');
          return;
        }

        var questionObj = {
          text: question,
          options: options,
          correctIndex: ['A', 'B', 'C', 'D'].indexOf(correct),
          timeLimit: timer
        };

        Session.addQuizQuestion(questionObj).then(function() {
          Session.switchToQuiz();
        }).catch(function(error) {
          console.error('Failed to start quiz:', error);
        });
      });
    }

    if (stopQuizBtn) {
      stopQuizBtn.addEventListener('click', function() {
        Session.endQuiz().then(function() {
          Session.startSession();
        }).catch(function(error) {
          console.error('Failed to stop quiz:', error);
        });
      });
    }

    if (showLeaderboardBtn) {
      showLeaderboardBtn.addEventListener('click', function() {
        Session.showLeaderboard();
      });
    }

    // Password update
    if (updatePasswordBtn) {
      updatePasswordBtn.addEventListener('click', function() {
        var newPass = adminPassword.value;
        var confirmPass = confirmPassword.value;

        if (newPass !== confirmPass) {
          alert('Passwords do not match');
          return;
        }

        if (newPass.length < 6) {
          alert('Password must be at least 6 characters');
          return;
        }

        // Get current password from input if needed, or use empty for default
        Auth.changePassword('', newPass).then(function(success) {
          if (success) {
            alert('Password updated successfully');
            adminPassword.value = '';
            confirmPassword.value = '';
          } else {
            alert('Failed to update password');
          }
        }).catch(function(error) {
          console.error('Password update error:', error);
          alert('Failed to update password');
        });
      });
    }
  }

  // ==========================================================================
  // QR Code Setup
  // ==========================================================================

  /**
   * Setup QR code for joining session
   */
  function setupQRCode() {
    var qrContainer = document.getElementById('qrContainer');
    var joinUrl = document.getElementById('joinUrl');

    if (!qrContainer) return;

    // Clear existing QR code
    qrContainer.innerHTML = '';

    // Get current URL for join page
    var baseUrl = window.location.origin + window.location.pathname.replace('admin.html', '');
    var fullUrl = baseUrl + 'join.html';

    // Update join URL text
    if (joinUrl) {
      joinUrl.textContent = fullUrl;
    }

    // Generate QR code
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: fullUrl,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }
  }

  // ==========================================================================
  // User Listener
  // ==========================================================================

  /**
   * Setup real-time user list listener
   */
  function setupUserListener() {
    if (usersUnsubscribe) {
      usersUnsubscribe();
    }

    usersUnsubscribe = usersRef.onSnapshot(function(snapshot) {
      var count = snapshot.size;
      if (userCount) {
        userCount.textContent = count;
      }
      renderUserTable(snapshot.docs);
    }, function(error) {
      console.error('User listener error:', error);
    });
  }

  /**
   * Render user table in the users section
   * @param {Array} userDocs - Array of Firestore document snapshots
   */
  function renderUserTable(userDocs) {
    var usersList = document.getElementById('usersList');
    if (!usersList) return;

    if (!userDocs || userDocs.length === 0) {
      usersList.innerHTML = '<p class="text-center text-muted">No users connected</p>';
      return;
    }

    var html = '<table class="users-table">';
    html += '<thead><tr><th>Name</th><th>Points</th><th>Status</th></tr></thead>';
    html += '<tbody>';

    userDocs.forEach(function(doc) {
      var user = doc.data();
      var name = user.name || 'Anonymous';
      var totalPoints = (user.points && user.points.total) || 0;

      html += '<tr>';
      html += '<td>' + escapeHtml(name) + '</td>';
      html += '<td>' + totalPoints + '</td>';
      html += '<td><span class="badge badge-success">Active</span></td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    usersList.innerHTML = html;
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

    updateSessionStatusBadge(state.status);
    updateSessionInfo(state);
    updateControlButtons(state);
    updatePollingUI(state);
    updateQuizUI(state);

    // Handle specific actions
    if (action === 'switchToPolling') {
      setupPollingListener();
    } else if (action === 'switchToQuiz') {
      setupQuizListener();
    } else if (action === 'showLeaderboard') {
      // Leaderboard is handled by display.js
    }
  }

  /**
   * Update session status badge
   * @param {string} status - Current session status
   */
  function updateSessionStatusBadge(status) {
    if (!sessionStatusBadge) return;

    var badge = sessionStatusBadge.querySelector('.badge');
    if (!badge) return;

    badge.className = 'badge';

    switch (status) {
      case 'waiting':
        badge.classList.add('badge-warning');
        badge.textContent = 'Waiting';
        break;
      case 'polling':
        badge.classList.add('badge-info');
        badge.textContent = 'Polling';
        break;
      case 'quiz':
        badge.classList.add('badge-primary');
        badge.textContent = 'Quiz';
        break;
      case 'leaderboard':
        badge.classList.add('badge-success');
        badge.textContent = 'Leaderboard';
        break;
      case 'closed':
        badge.classList.add('badge-closed');
        badge.textContent = 'Session Closed';
        break;
      default:
        badge.classList.add('badge-closed');
        badge.textContent = 'Session Closed';
    }
  }

  /**
   * Update session info display
   * @param {Object} state - Session state
   */
  function updateSessionInfo(state) {
    var sessionId = document.getElementById('sessionId');
    var sessionStatus = document.getElementById('sessionStatus');
    var currentView = document.getElementById('currentView');

    if (sessionId) {
      sessionId.textContent = state.sessionId || 'N/A';
    }

    if (sessionStatus) {
      sessionStatus.textContent = state.status || 'closed';
    }

    if (currentView) {
      currentView.textContent = state.status || 'Waiting';
    }
  }

  /**
   * Update control button states based on session status
   * @param {Object} state - Session state
   */
  function updateControlButtons(state) {
    var status = state.status;

    // Session controls
    if (startSessionBtn) {
      startSessionBtn.disabled = status !== 'closed';
    }
    if (closeSessionBtn) {
      closeSessionBtn.disabled = status === 'closed';
    }

    // Polling controls
    if (startPollingBtn) {
      startPollingBtn.disabled = status === 'polling' || status === 'quiz';
    }
    if (stopPollingBtn) {
      stopPollingBtn.disabled = status !== 'polling';
    }

    // Quiz controls
    if (startQuizBtn) {
      startQuizBtn.disabled = status === 'polling' || status === 'quiz';
    }
    if (stopQuizBtn) {
      stopQuizBtn.disabled = status !== 'quiz';
    }
    if (showLeaderboardBtn) {
      showLeaderboardBtn.disabled = status === 'quiz';
    }
  }

  /**
   * Update polling UI based on session state
   * @param {Object} state - Session state
   */
  function updatePollingUI(state) {
    // Polling UI updates are handled by the polling listener
  }

  /**
   * Update quiz UI based on session state
   * @param {Object} state - Session state
   */
  function updateQuizUI(state) {
    // Quiz UI updates are handled by the quiz listener
  }

  // ==========================================================================
  // Polling & Quiz Listeners
  // ==========================================================================

  /**
   * Setup real-time listener for polling answers
   */
  function setupPollingListener() {
    if (pollingAnswersUnsubscribe) {
      pollingAnswersUnsubscribe();
    }

    // Listen to polling answers collection
    pollingAnswersUnsubscribe = pollingAnswersRef.onSnapshot(function(snapshot) {
      var count = snapshot.size;
      renderPollingList(snapshot.docs);

      // Update response count display
      var pollingResponses = document.getElementById('pollingResponses');
      if (pollingResponses) {
        pollingResponses.textContent = count;
      }
    }, function(error) {
      console.error('Polling answers listener error:', error);
    });
  }

  /**
   * Render polling results list
   * @param {Array} answerDocs - Array of polling answer documents
   */
  function renderPollingList(answerDocs) {
    if (!pollingResultsContainer) return;

    if (!answerDocs || answerDocs.length === 0) {
      pollingResultsContainer.innerHTML = '<p class="text-muted">No responses yet</p>';
      return;
    }

    var html = '<div class="polling-list">';

    answerDocs.forEach(function(doc) {
      var answer = doc.data();
      html += '<div class="polling-item">';
      html += '<span class="polling-text">' + escapeHtml(answer.text || '') + '</span>';
      html += '<span class="polling-time">' + formatTime(answer.createdAt) + '</span>';
      html += '</div>';
    });

    html += '</div>';
    pollingResultsContainer.innerHTML = html;
  }

  /**
   * Setup real-time listener for quiz answers
   */
  function setupQuizListener() {
    if (quizAnswersUnsubscribe) {
      quizAnswersUnsubscribe();
    }

    // Listen to quiz answers collection
    quizAnswersUnsubscribe = quizAnswersRef.onSnapshot(function(snapshot) {
      // Count answers by option
      var counts = { A: 0, B: 0, C: 0, D: 0 };

      snapshot.docs.forEach(function(doc) {
        var answer = doc.data();
        if (typeof answer.selectedIndex === 'number') {
          var option = ['A', 'B', 'C', 'D'][answer.selectedIndex];
          if (option) {
            counts[option]++;
          }
        }
      });

      // Update result displays
      Object.keys(counts).forEach(function(option) {
        if (resultCounts[option]) {
          resultCounts[option].textContent = counts[option];
        }
      });

      renderQuizList(snapshot.docs);
    }, function(error) {
      console.error('Quiz answers listener error:', error);
    });
  }

  /**
   * Render quiz results list
   * @param {Array} answerDocs - Array of quiz answer documents
   */
  function renderQuizList(answerDocs) {
    var quizResultsContainer = document.getElementById('quizResultsContainer');
    if (!quizResultsContainer) return;

    if (!answerDocs || answerDocs.length === 0) {
      quizResultsContainer.innerHTML = '<p class="text-muted">No answers yet</p>';
      return;
    }

    var html = '<div class="quiz-list">';

    answerDocs.forEach(function(doc) {
      var answer = doc.data();
      var userName = answer.userId ? 'User' : 'Anonymous';
      var selectedOption = typeof answer.selectedIndex === 'number'
        ? ['A', 'B', 'C', 'D'][answer.selectedIndex]
        : '?';
      var isCorrect = answer.isCorrect;

      html += '<div class="quiz-item ' + (isCorrect ? 'correct' : 'incorrect') + '">';
      html += '<span class="quiz-user">' + escapeHtml(userName) + '</span>';
      html += '<span class="quiz-answer">' + selectedOption + '</span>';
      html += '<span class="quiz-result">' + (isCorrect ? 'Correct' : 'Wrong') + '</span>';
      html += '</div>';
    });

    html += '</div>';

    // Keep the grid but add list below
    var existingGrid = quizResultsContainer.querySelector('.quiz-results-grid');
    if (existingGrid) {
      var existingList = quizResultsContainer.querySelector('.quiz-list');
      if (existingList) {
        existingList.remove();
      }
      quizResultsContainer.insertAdjacentHTML('beforeend', html);
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

  /**
   * Format timestamp to readable time
   * @param {Object} timestamp - Firestore timestamp
   * @returns {string} Formatted time string
   */
  function formatTime(timestamp) {
    if (!timestamp) return '';
    var date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString();
  }

  // ==========================================================================
  // Cleanup on Unload
  // ==========================================================================

  window.addEventListener('beforeunload', function() {
    if (usersUnsubscribe) {
      usersUnsubscribe();
    }
    if (quizAnswersUnsubscribe) {
      quizAnswersUnsubscribe();
    }
    if (pollingAnswersUnsubscribe) {
      pollingAnswersUnsubscribe();
    }
  });

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
