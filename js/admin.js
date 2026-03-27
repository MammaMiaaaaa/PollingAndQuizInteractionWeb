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
  var resetSessionBtn = document.getElementById('resetSessionBtn');
  var logoutBtn = document.getElementById('logoutBtn');
  var userCount = document.getElementById('userCount');

  // Polling elements
  var newPollingQuestion = document.getElementById('newPollingQuestion');
  var addPollingQuestionBtn = document.getElementById('addPollingQuestionBtn');
  var startPollingBtn = document.getElementById('startPollingBtn');
  var stopPollingBtn = document.getElementById('stopPollingBtn');
  var toggleResultsBtn = document.getElementById('toggleResultsBtn');
  var prevPollingQBtn = document.getElementById('prevPollingQBtn');
  var nextPollingQBtn = document.getElementById('nextPollingQBtn');
  var activePollingQuestion = document.getElementById('activePollingQuestion');
  var pollingQIndex = document.getElementById('pollingQIndex');
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
  var addQuizQuestionBtn = document.getElementById('addQuizQuestionBtn');
  var startQuizBtn = document.getElementById('startQuizBtn');
  var revealAnswerBtn = document.getElementById('revealAnswerBtn');
  var showInterimLeaderboardBtn = document.getElementById('showInterimLeaderboardBtn');
  var nextQuizQBtn = document.getElementById('nextQuizQBtn');
  var stopQuizBtn = document.getElementById('stopQuizBtn');
  var showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
  var activeQuizQuestion = document.getElementById('activeQuizQuestion');
  var quizQIndex = document.getElementById('quizQIndex');
  var resultCounts = {
    A: document.getElementById('resultA'),
    B: document.getElementById('resultB'),
    C: document.getElementById('resultC'),
    D: document.getElementById('resultD')
  };

  // Settings elements
  var oldPassword = document.getElementById('oldPassword');
  var adminPassword = document.getElementById('adminPassword');
  var confirmPassword = document.getElementById('confirmPassword');
  var updatePasswordBtn = document.getElementById('updatePasswordBtn');

  // ==========================================================================
  // State
  // ==========================================================================

  var currentSection = 'session';
  var currentUser = null;
  var usersUnsubscribe = null;
  var pollingListenerActive = false;
  var pollResultsVisible = true;
  var quizListenerActive = false;
  var lastAdminPollQuestionIndex = -1;
  var lastAdminQuizQuestionIndex = -1;

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the admin panel
   */
   async function init() {
    try {
      await Auth.initAuth();
      console.log('Auth initialized successfully');
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }

    if (Auth.isLoggedIn()) {
      showDashboard();
    } else {
      showLogin();
    }

    Session.subscribeToSession();

    Session.fetchSessionState().then(function() {
      renderPollingQuestionList();
      renderQuizQuestionList();
      var state = Session.getState();
      updateActivePollingQuestion(state);
      updateActiveQuizQuestion(state);
    });

    Session.onSessionChange(handleSessionChange);

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
    if (!loginForm) {
      console.error('Login form not found');
      return;
    }

    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      console.log('Login form submitted');

      var password = passwordInput.value.trim();
      console.log('Password entered:', password ? 'yes' : 'no');

      if (!password) {
        showLoginError('Please enter a password');
        return;
      }

      try {
        console.log('Calling Auth.login...');
        var success = await Auth.login(password);
        console.log('Login result:', success);

        if (success) {
          showDashboard();
        } else {
          showLoginError('Incorrect password. Please try again.');
        }
      } catch (error) {
        console.error('Login error:', error);
        showLoginError('Login failed: ' + error.message);
      }
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

    if (resetSessionBtn) {
      resetSessionBtn.addEventListener('click', function() {
        if (confirm('Reset session? This will clear all questions, answers, and user data.')) {
          Session.resetSession().then(function() {
            pollingAnswersRef.remove();
            quizAnswersRef.remove();
            reactionsRef.remove();
            console.log('Session reset complete');
          }).catch(function(error) {
            console.error('Failed to reset session:', error);
          });
        }
      });
    }

    // Polling controls
    if (addPollingQuestionBtn) {
      addPollingQuestionBtn.addEventListener('click', function() {
        var text = newPollingQuestion.value.trim();
        if (!text) return;
        Session.addPollingQuestion(text).then(function() {
          newPollingQuestion.value = '';
          renderPollingQuestionList();
        });
      });
    }

    if (startPollingBtn) {
      startPollingBtn.addEventListener('click', function() {
        var state = Session.getState();
        var questions = (state.pollingConfig || {}).questions || [];
        if (questions.length === 0) {
          alert('Add at least one question first');
          return;
        }
        Session.switchToPolling();
      });
    }

    if (stopPollingBtn) {
      stopPollingBtn.addEventListener('click', function() {
        Session.startSession().catch(function(error) {
          console.error('Failed to stop polling:', error);
        });
      });
    }

    if (toggleResultsBtn) {
      toggleResultsBtn.addEventListener('click', function() {
        pollResultsVisible = !pollResultsVisible;
        toggleResultsBtn.textContent = pollResultsVisible ? 'Hide Results' : 'Show Results';
        if (pollResultsVisible) {
          Session.showPollingResults();
        } else {
          Session.hidePollingResults();
        }
      });
    }

    if (prevPollingQBtn) {
      prevPollingQBtn.addEventListener('click', function() {
        var state = Session.getState();
        var idx = (state.pollingConfig || {}).currentIndex || 0;
        if (idx > 0) {
          Session.setActivePollingQuestion(idx - 1);
        }
      });
    }

    if (nextPollingQBtn) {
      nextPollingQBtn.addEventListener('click', function() {
        var state = Session.getState();
        var config = state.pollingConfig || {};
        var idx = config.currentIndex || 0;
        var questions = config.questions || [];
        if (idx < questions.length - 1) {
          Session.setActivePollingQuestion(idx + 1);
        }
      });
    }

    // Quiz controls
    if (addQuizQuestionBtn) {
      addQuizQuestionBtn.addEventListener('click', function() {
        var question = quizQuestion.value.trim();
        var options = [
          quizOptions.A.value.trim(),
          quizOptions.B.value.trim(),
          quizOptions.C.value.trim(),
          quizOptions.D.value.trim()
        ];
        var correct = correctAnswer.value;
        var timer = parseInt(quizTimer.value, 10) || 20;

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
          quizQuestion.value = '';
          quizOptions.A.value = '';
          quizOptions.B.value = '';
          quizOptions.C.value = '';
          quizOptions.D.value = '';
          quizTimer.value = '20';
          renderQuizQuestionList();
        });
      });
    }

    if (startQuizBtn) {
      startQuizBtn.addEventListener('click', function() {
        var state = Session.getState();
        var questions = (state.quizConfig || {}).questions || [];
        if (questions.length === 0) {
          alert('Add at least one question first');
          return;
        }
        Session.switchToQuiz();
      });
    }

    if (revealAnswerBtn) {
      revealAnswerBtn.addEventListener('click', function() {
        Session.revealQuizAnswer();
      });
    }

    var downloadQrBtn = document.getElementById('downloadQrBtn');
    if (downloadQrBtn) {
      downloadQrBtn.addEventListener('click', function() {
        var qrCanvas = document.querySelector('#qrContainer canvas');
        if (!qrCanvas) {
          var qrImg = document.querySelector('#qrContainer img');
          if (qrImg) {
            var link = document.createElement('a');
            link.download = 'anxietytalk-qr.png';
            link.href = qrImg.src;
            link.click();
          }
          return;
        }
        var link = document.createElement('a');
        link.download = 'anxietytalk-qr.png';
        link.href = qrCanvas.toDataURL('image/png');
        link.click();
      });
    }

    if (showInterimLeaderboardBtn) {
      showInterimLeaderboardBtn.addEventListener('click', function() {
        Session.showInterimLeaderboard();
      });
    }

    if (nextQuizQBtn) {
      nextQuizQBtn.addEventListener('click', function() {
        var state = Session.getState();
        var config = state.quizConfig || {};
        var idx = config.currentIndex || 0;
        var questions = config.questions || [];
        if (idx < questions.length - 1) {
          Session.startQuizQuestion(idx + 1);
        }
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
        var oldPass = oldPassword ? oldPassword.value.trim() : '';
        var newPass = adminPassword.value;
        var confirmPass = confirmPassword.value;

        if (!oldPass) {
          alert('Please enter your current password');
          return;
        }

        if (newPass !== confirmPass) {
          alert('Passwords do not match');
          return;
        }

        if (newPass.length < 6) {
          alert('Password must be at least 6 characters');
          return;
        }

        Auth.changePassword(oldPass, newPass).then(function(success) {
          if (success) {
            alert('Password updated successfully');
            if (oldPassword) oldPassword.value = '';
            adminPassword.value = '';
            confirmPassword.value = '';
          } else {
            alert('Current password is incorrect');
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
    html += '<thead><tr><th>Name</th><th>Points</th><th>Status</th><th>Actions</th></tr></thead>';
    html += '<tbody>';

    userDocs.forEach(function(doc) {
      var user = doc.data();
      var name = user.name || 'Anonymous';
      var totalPoints = (user.points && user.points.total) || 0;

      html += '<tr>';
      html += '<td>' + escapeHtml(name) + '</td>';
      html += '<td>' + totalPoints + '</td>';
      html += '<td><span class="badge badge-success">Active</span></td>';
      html += '<td><button class="btn btn-danger btn-sm kick-user-btn" data-user-id="' + doc.id + '">Kick</button></td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    usersList.innerHTML = html;

    usersList.querySelectorAll('.kick-user-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var userId = this.getAttribute('data-user-id');
        if (confirm('Kick this user? They will be removed from the session.')) {
          usersRef.doc(userId).delete().then(function() {
            console.log('User kicked:', userId);
          }).catch(function(error) {
            console.error('Failed to kick user:', error);
          });
        }
      });
    });
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
    renderPollingQuestionList();
    renderQuizQuestionList();
    updateActivePollingQuestion(state);
    updateActiveQuizQuestion(state);

    if (action === 'switchToPolling' || action === 'setActivePollingQuestion' || (state.status === 'polling' && (state.pollingConfig || {}).currentIndex !== lastAdminPollQuestionIndex)) {
      lastAdminPollQuestionIndex = -1;
      setupPollingListener();
    } else if (action === 'switchToQuiz' || action === 'startQuizQuestion' || (state.status === 'quiz' && (state.quizConfig || {}).currentIndex !== lastAdminQuizQuestionIndex)) {
      lastAdminQuizQuestionIndex = -1;
      setupQuizListener();
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

    if (startSessionBtn) {
      startSessionBtn.disabled = status !== 'closed';
    }
    if (closeSessionBtn) {
      closeSessionBtn.disabled = status === 'closed';
    }

    if (startPollingBtn) {
      startPollingBtn.disabled = status === 'polling' || status === 'quiz' || status === 'leaderboard';
    }
    if (stopPollingBtn) {
      stopPollingBtn.disabled = status !== 'polling';
    }
    if (toggleResultsBtn) {
      toggleResultsBtn.disabled = status !== 'polling';
    }

    if (startQuizBtn) {
      startQuizBtn.disabled = status === 'polling' || status === 'quiz' || status === 'leaderboard';
    }
    if (revealAnswerBtn) {
      revealAnswerBtn.disabled = status !== 'quiz';
    }
    if (showInterimLeaderboardBtn) {
      showInterimLeaderboardBtn.disabled = status !== 'quiz';
    }
    if (nextQuizQBtn) {
      nextQuizQBtn.disabled = status !== 'quiz';
    }
    if (stopQuizBtn) {
      stopQuizBtn.disabled = status !== 'quiz';
    }
    if (showLeaderboardBtn) {
      showLeaderboardBtn.disabled = status === 'quiz' || status === 'leaderboard';
    }
  }

  // ==========================================================================
  // Polling Question Management
  // ==========================================================================

  function renderPollingQuestionList() {
    var listEl = document.getElementById('pollingQuestionList');
    if (!listEl) return;

    var state = Session.getState();
    var questions = (state.pollingConfig || {}).questions || [];
    var currentIndex = (state.pollingConfig || {}).currentIndex || 0;

    if (questions.length === 0) {
      listEl.innerHTML = '<p class="text-center text-muted">No questions added yet</p>';
      return;
    }

    var html = '';
    questions.forEach(function(q, i) {
      var activeClass = i === currentIndex ? ' active' : '';
      html += '<div class="question-list-item' + activeClass + '">';
      html += '<span class="question-index">' + (i + 1) + '</span>';
      html += '<span class="question-text">' + escapeHtml(q) + '</span>';
      html += '<button class="question-delete" data-index="' + i + '">X</button>';
      html += '</div>';
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.question-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-index'));
        Session.deletePollingQuestion(idx).then(function() {
          renderPollingQuestionList();
        });
      });
    });

    if (prevPollingQBtn) prevPollingQBtn.disabled = currentIndex <= 0;
    if (nextPollingQBtn) nextPollingQBtn.disabled = currentIndex >= questions.length - 1;
    if (pollingQIndex) pollingQIndex.textContent = (currentIndex + 1) + ' / ' + questions.length;
  }

  function updateActivePollingQuestion(state) {
    var config = state.pollingConfig || {};
    var questions = config.questions || [];
    var currentIndex = config.currentIndex || 0;

    if (activePollingQuestion) {
      activePollingQuestion.textContent = questions[currentIndex] || 'No questions yet';
    }
  }

  // ==========================================================================
  // Quiz Question Management
  // ==========================================================================

  function renderQuizQuestionList() {
    var listEl = document.getElementById('quizQuestionList');
    if (!listEl) return;

    var state = Session.getState();
    var questions = (state.quizConfig || {}).questions || [];
    var currentIndex = (state.quizConfig || {}).currentIndex || 0;

    if (questions.length === 0) {
      listEl.innerHTML = '<p class="text-center text-muted">No questions added yet</p>';
      return;
    }

    var html = '';
    questions.forEach(function(q, i) {
      var activeClass = i === currentIndex ? ' active' : '';
      var letters = ['A', 'B', 'C', 'D'];
      var correctLetter = letters[q.correctIndex] || '?';
      html += '<div class="question-list-item' + activeClass + '">';
      html += '<span class="question-index">' + (i + 1) + '</span>';
      html += '<span class="question-text">' + escapeHtml(q.text) + ' (Answer: ' + correctLetter + ', ' + (q.timeLimit || 20) + 's)</span>';
      html += '<button class="question-delete" data-index="' + i + '">X</button>';
      html += '</div>';
    });
    listEl.innerHTML = html;

    listEl.querySelectorAll('.question-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var idx = parseInt(this.getAttribute('data-index'));
        Session.deleteQuizQuestion(idx).then(function() {
          renderQuizQuestionList();
        });
      });
    });

    if (quizQIndex) quizQIndex.textContent = (currentIndex + 1) + ' / ' + questions.length;
    if (nextQuizQBtn) nextQuizQBtn.disabled = currentIndex >= questions.length - 1;
  }

  function updateActiveQuizQuestion(state) {
    var config = state.quizConfig || {};
    var questions = config.questions || [];
    var currentIndex = config.currentIndex || 0;

    if (activeQuizQuestion) {
      var q = questions[currentIndex];
      activeQuizQuestion.textContent = q ? q.text : 'No questions yet';
    }
  }

  // ==========================================================================
  // Polling & Quiz Listeners
  // ==========================================================================

  /**
   * Setup real-time listener for polling answers
   */
  function setupPollingListener() {
    var state = Session.getState();
    var currentIndex = (state.pollingConfig || {}).currentIndex || 0;

    if (currentIndex === lastAdminPollQuestionIndex) return;

    if (pollingListenerActive) {
      pollingAnswersRef.off();
    }

    lastAdminPollQuestionIndex = currentIndex;
    pollingListenerActive = true;

    pollingAnswersRef.on('value', function(snapshot) {
      var count = 0;

      if (pollingResultsContainer) {
        pollingResultsContainer.innerHTML = '';
      }

      if (!snapshot.exists()) {
        if (pollingResultsContainer) {
          pollingResultsContainer.innerHTML = '<p class="text-muted">No responses yet</p>';
        }
        if (document.getElementById('pollingResponses')) {
          document.getElementById('pollingResponses').textContent = '0';
        }
        return;
      }

      snapshot.forEach(function(childSnapshot) {
        var answer = childSnapshot.val();
        if (!answer) return;
        if ((answer.questionIndex || 0) !== currentIndex) return;
        count++;
        renderPollingAnswer(answer);
      });

      if (document.getElementById('pollingResponses')) {
        document.getElementById('pollingResponses').textContent = count;
      }
    }, function(error) {
      console.error('[Admin] Polling answers listener error:', error);
    });
  }

  function renderPollingAnswer(answer) {
    if (!pollingResultsContainer) return;

    var item = document.createElement('div');
    item.className = 'polling-item';
    item.innerHTML = '<span class="polling-text">' + escapeHtml(answer.text || '') + '</span>'
      + '<span class="polling-time">' + formatTime(answer.createdAt) + '</span>';
    pollingResultsContainer.appendChild(item);
  }

  /**
   * Setup real-time listener for quiz answers
   */
  function setupQuizListener() {
    var state = Session.getState();
    var currentIndex = (state.quizConfig || {}).currentIndex || 0;

    if (currentIndex === lastAdminQuizQuestionIndex) return;

    if (quizListenerActive) {
      quizAnswersRef.off();
    }

    lastAdminQuizQuestionIndex = currentIndex;
    quizListenerActive = true;
    var counts = { A: 0, B: 0, C: 0, D: 0 };

    Object.keys(counts).forEach(function(opt) {
      if (resultCounts[opt]) resultCounts[opt].textContent = '0';
    });

    var existingList = document.querySelector('#quizResultsContainer .quiz-list');
    if (existingList) existingList.remove();

    quizAnswersRef.on('child_added', function(snapshot) {
      var answer = snapshot.val();
      if (!answer) return;
      if ((answer.questionIndex || 0) !== currentIndex) return;

        if (typeof answer.selectedIndex === 'number') {
          var option = ['A', 'B', 'C', 'D'][answer.selectedIndex];
          if (option && counts.hasOwnProperty(option)) {
            counts[option]++;
          }
        }

        Object.keys(counts).forEach(function(opt) {
          if (resultCounts[opt]) {
            resultCounts[opt].textContent = counts[opt];
          }
        });

        renderQuizAnswer(answer);
      }, function(error) {
        console.error('Quiz answers listener error:', error);
      });
  }

  function renderQuizAnswer(answer) {
    var quizResultsContainer = document.getElementById('quizResultsContainer');
    if (!quizResultsContainer) return;

    var existingGrid = quizResultsContainer.querySelector('.quiz-results-grid');
    if (!existingGrid) return;

    var existingList = quizResultsContainer.querySelector('.quiz-list');
    if (!existingList) {
      existingList = document.createElement('div');
      existingList.className = 'quiz-list';
      quizResultsContainer.appendChild(existingList);
    }

    var userName = answer.userId ? 'User' : 'Anonymous';
    var selectedOption = typeof answer.selectedIndex === 'number'
      ? ['A', 'B', 'C', 'D'][answer.selectedIndex]
      : '?';
    var isCorrect = answer.isCorrect;

    var item = document.createElement('div');
    item.className = 'quiz-item ' + (isCorrect ? 'correct' : 'incorrect');
    item.innerHTML = '<span class="quiz-user">' + escapeHtml(userName) + '</span>'
      + '<span class="quiz-answer">' + selectedOption + '</span>'
      + '<span class="quiz-result">' + (isCorrect ? 'Correct' : 'Wrong') + '</span>';
    existingList.appendChild(item);
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
    if (pollingListenerActive) {
      pollingAnswersRef.off();
    }
    if (quizListenerActive) {
      quizAnswersRef.off();
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
