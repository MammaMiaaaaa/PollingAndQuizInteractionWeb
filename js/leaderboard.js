/**
 * Leaderboard Module for AnxietyTalk
 *
 * Provides Kahoot-style leaderboard animations and rankings for both
 * display screens and mobile users.
 *
 * Dependencies:
 * - firebase/firebase-config.js (provides db, rtdb, usersRef references)
 * - css/display.css (provides leaderboard animation styles)
 */

(function(window) {
  'use strict';

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Confetti colors matching the design palette
   * @type {string[]}
   */
  var CONFETTI_COLORS = [
    '#FF6B2B',  // Primary orange
    '#FF3CAC',  // Hot pink
    '#FFE500',  // Lemon yellow
    '#B5FF4D',  // Success green
    '#2D6AFF',  // Quiz blue
    '#FF2D2D',  // Quiz red
    '#FFD700',  // Gold (for #1)
    '#C0C0C0',  // Silver (for #2)
    '#CD7F32'   // Bronze (for #3)
  ];

  /**
   * Number of confetti pieces to generate
   * @type {number}
   */
  var CONFETTI_COUNT = 100;

  /**
   * Medal emojis for top 3 positions
   * @type {string[]}
   */
  var MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

  /**
   * Animation delay between each leaderboard entry reveal (ms)
   * @type {number}
   */
  var REVEAL_DELAY = 300;

  /**
   * Duration of the slide-in animation (ms)
   * @type {number}
   */
  var SLIDE_IN_DURATION = 500;

  /**
   * Duration of confetti animation (ms)
   * @type {number}
   */
  var CONFETTI_DURATION = 3000;

  /**
   * Point calculation weights
   */
  var POINTS = {
    QUIZ_MAX: 1500,      // Max points per quiz question (fast answer)
    QUIZ_MIN: 1000,      // Min points per quiz question (slow answer)
    POLLING: 50,         // Points per polling answer
    REACTION: 10         // Points per reaction tap (10 per tap in reactions.js)
  };

  // ==========================================================================
  // LeaderboardDisplay Class (Display Screen)
  // ==========================================================================

  /**
   * LeaderboardDisplay class for rendering leaderboards on the display screen
   *
   * @param {string} containerId - The ID of the container element for the leaderboard
   */
  function LeaderboardDisplay(containerId) {
    // Get container element
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('LeaderboardDisplay: Container element not found:', containerId);
      return;
    }

    // Track current animation state
    this.isAnimating = false;

    // Inject additional animation styles
    this.injectStyles();
  }

  /**
   * Inject custom animation styles for leaderboard
   */
  LeaderboardDisplay.prototype.injectStyles = function() {
    if (document.getElementById('leaderboard-animations')) return;

    var style = document.createElement('style');
    style.id = 'leaderboard-animations';
    style.textContent = [
      '@keyframes slideIn {',
      '  from {',
      '    opacity: 0;',
      '    transform: translateY(50px);',
      '  }',
      '  to {',
      '    opacity: 1;',
      '    transform: translateY(0);',
      '  }',
      '}',
      '@keyframes confettiFall {',
      '  0% {',
      '    transform: translateY(-100%) rotate(0deg);',
      '    opacity: 1;',
      '  }',
      '  100% {',
      '    transform: translateY(100vh) rotate(720deg);',
      '    opacity: 0;',
      '  }',
      '}',
      '@keyframes scaleIn {',
      '  0% {',
      '    transform: scale(0.8);',
      '    opacity: 0;',
      '  }',
      '  50% {',
      '    transform: scale(1.1);',
      '  }',
      '  100% {',
      '    transform: scale(1);',
      '    opacity: 1;',
      '  }',
      '}',
      '@keyframes pulse {',
      '  0%, 100% { transform: scale(1); }',
      '  50% { transform: scale(1.05); }',
      '}',
      '.leaderboard-entry {',
      '  opacity: 0;',
      '  animation: slideIn ' + SLIDE_IN_DURATION + 'ms ease-out forwards;',
      '}',
      '.leaderboard-entry.rank-1 {',
      '  animation: scaleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;',
      '}',
      '.confetti {',
      '  position: absolute;',
      '  width: 10px;',
      '  height: 10px;',
      '  animation: confettiFall ' + CONFETTI_DURATION + 'ms ease-out forwards;',
      '}',
      '.interim-header {',
      '  animation: pulse 1s ease-in-out infinite;',
      '}'
    ].join('\n');

    document.head.appendChild(style);
  };

  /**
   * Sort users by total points descending
   * @param {Array} users - Array of user objects
   * @returns {Array} Sorted users array
   */
  LeaderboardDisplay.prototype.sortUsers = function(users) {
    return users.slice().sort(function(a, b) {
      var pointsA = (a.points && a.points.total) || 0;
      var pointsB = (b.points && b.points.total) || 0;
      return pointsB - pointsA;
    });
  };

  /**
   * Get medal emoji for rank
   * @param {number} rank - 1-based rank
   * @returns {string} Medal emoji or rank number
   */
  LeaderboardDisplay.prototype.getMedalEmoji = function(rank) {
    if (rank >= 1 && rank <= 3) {
      return MEDAL_EMOJIS[rank - 1];
    }
    return rank.toString();
  };

  /**
   * Get rank-specific CSS class
   * @param {number} rank - 1-based rank
   * @returns {string} CSS class name
   */
  LeaderboardDisplay.prototype.getRankClass = function(rank) {
    if (rank === 1) return 'rank-1';
    if (rank === 2) return 'rank-2';
    if (rank === 3) return 'rank-3';
    return '';
  };

  /**
   * Create a single leaderboard entry element
   * @param {Object} user - User object
   * @param {number} rank - User's rank (1-based)
   * @returns {HTMLElement} The entry element
   */
  LeaderboardDisplay.prototype.createEntryElement = function(user, rank) {
    var entry = document.createElement('div');
    entry.className = 'leaderboard-entry ' + this.getRankClass(rank);

    // Calculate animation delay based on rank (bottom to top reveal)
    var totalUsers = this.sortedUsers ? this.sortedUsers.length : 1;
    var delay = (totalUsers - rank) * REVEAL_DELAY;
    entry.style.animationDelay = delay + 'ms';

    // Get user name
    var name = user.name || 'Anonymous';

    // Get total points
    var points = user.points || {};
    var totalPoints = points.total || 0;

    // Create avatar initial
    var initial = name.charAt(0).toUpperCase();

    entry.innerHTML = [
      '<span class="leaderboard-rank">' + this.getMedalEmoji(rank) + '</span>',
      '<div class="leaderboard-avatar" style="background-color: ' + this.getAvatarColor(rank) + ';">' + initial + '</div>',
      '<div class="leaderboard-info">',
      '  <div class="leaderboard-name">' + this.escapeHtml(name) + '</div>',
      '</div>',
      '<span class="leaderboard-score">' + this.formatNumber(totalPoints) + ' poin</span>'
    ].join('');

    return entry;
  };

  /**
   * Get avatar color based on rank
   * @param {number} rank - User's rank
   * @returns {string} Hex color code
   */
  LeaderboardDisplay.prototype.getAvatarColor = function(rank) {
    if (rank === 1) return '#FFD700';  // Gold
    if (rank === 2) return '#C0C0C0';   // Silver
    if (rank === 3) return '#CD7F32';  // Bronze
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'); // Random color
  };

  /**
   * Format number with thousand separators
   * @param {number} num - Number to format
   * @returns {string} Formatted number string
   */
  LeaderboardDisplay.prototype.formatNumber = function(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  LeaderboardDisplay.prototype.escapeHtml = function(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Show final rankings with animated reveal from bottom to top
   * Winner gets confetti burst
   * @param {Array} users - Array of user objects with points
   * @returns {Promise<void>}
   */
  LeaderboardDisplay.prototype.showFinal = function(users) {
    var self = this;

    return new Promise(function(resolve) {
      // Clear container
      self.container.innerHTML = '';

      // Create header
      var header = document.createElement('div');
      header.className = 'leaderboard-header';
      header.innerHTML = '<h1 class="leaderboard-title">SKOR AKHIR</h1>';
      self.container.appendChild(header);

      // Create body container
      var body = document.createElement('div');
      body.className = 'leaderboard-body';
      self.container.appendChild(body);

      // Create list container
      var list = document.createElement('div');
      list.className = 'leaderboard-list';
      body.appendChild(list);

      // Sort users by points
      self.sortedUsers = self.sortUsers(users);

      // Create entry for each user
      self.sortedUsers.forEach(function(user, index) {
        var rank = index + 1;
        var entry = self.createEntryElement(user, rank);
        list.appendChild(entry);
      });

      // Trigger confetti for winner after a short delay
      setTimeout(function() {
        if (self.sortedUsers.length > 0) {
          self.createConfetti();
        }
        resolve();
      }, self.sortedUsers.length * REVEAL_DELAY + 500);
    });
  };

  /**
   * Show interim leaderboard (top N after each quiz question)
   * Shows "SEMENATARA..." header with slide-in animation
   * @param {Array} users - Array of user objects with points
   * @param {number} [topN=5] - Number of top users to show
   */
  LeaderboardDisplay.prototype.showInterim = function(users, topN) {
    topN = topN || 5;
    var self = this;

    // Clear container
    this.container.innerHTML = '';

    // Create header with "SEMENATARA" animation
    var header = document.createElement('div');
    header.className = 'leaderboard-header';
    header.innerHTML = '<h1 class="leaderboard-title interim-header">SEMENATARA...</h1>';
    this.container.appendChild(header);

    // Create body container
    var body = document.createElement('div');
    body.className = 'leaderboard-body';
    this.container.appendChild(body);

    // Create list container
    var list = document.createElement('div');
    list.className = 'leaderboard-list';
    body.appendChild(list);

    // Sort and slice users
    var sortedUsers = this.sortUsers(users);
    var topUsers = sortedUsers.slice(0, topN);

    // Create entry for each top user
    topUsers.forEach(function(user, index) {
      var rank = index + 1;
      var entry = self.createEntryElement(user, rank);
      list.appendChild(entry);
    });

    // Trigger small confetti for #1 if they're significantly ahead
    if (topUsers.length > 1 && topUsers[0].points && topUsers[1].points) {
      var pointsDiff = (topUsers[0].points.total || 0) - (topUsers[1].points.total || 0);
      if (pointsDiff > 1000) {
        setTimeout(function() {
          self.createConfetti(50); // Smaller confetti burst
        }, 500);
      }
    }
  };

  /**
   * Create confetti animation with 100+ pieces
   * Random colors from palette, fall animation, auto-remove
   * @param {number} [count] - Number of confetti pieces (default: 100)
   */
  LeaderboardDisplay.prototype.createConfetti = function(count) {
    count = count || CONFETTI_COUNT;

    // Create confetti container if it doesn't exist
    var confettiContainer = document.getElementById('confetti-container');
    if (!confettiContainer) {
      confettiContainer = document.createElement('div');
      confettiContainer.id = 'confetti-container';
      confettiContainer.className = 'confetti-container';
      document.body.appendChild(confettiContainer);
    }

    // Create confetti pieces
    for (var i = 0; i < count; i++) {
      this.createConfettiPiece(confettiContainer);
    }

    // Auto-remove after animation completes
    var self = this;
    setTimeout(function() {
      if (confettiContainer.parentNode) {
        confettiContainer.parentNode.removeChild(confettiContainer);
      }
    }, CONFETTI_DURATION + 500);
  };

  /**
   * Create a single confetti piece
   * @param {HTMLElement} container - Container element
   */
  LeaderboardDisplay.prototype.createConfettiPiece = function(container) {
    var confetti = document.createElement('div');
    confetti.className = 'confetti';

    // Random position across the top of the screen
    var leftPos = Math.random() * 100;
    confetti.style.left = leftPos + '%';
    confetti.style.top = '-10px';

    // Random color from palette
    var color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    confetti.style.backgroundColor = color;

    // Random size variation
    var size = 5 + Math.random() * 10;
    confetti.style.width = size + 'px';
    confetti.style.height = size + 'px';

    // Random shape (circle or square)
    if (Math.random() > 0.5) {
      confetti.style.borderRadius = '50%';
    }

    // Random animation duration variation
    var duration = CONFETTI_DURATION + (Math.random() - 0.5) * 1000;
    confetti.style.animationDuration = duration + 'ms';

    // Random horizontal drift
    var drift = (Math.random() - 0.5) * 200;
    confetti.style.setProperty('--drift', drift + 'px');

    // Random rotation speed
    var rotation = 360 + Math.random() * 720;
    confetti.style.setProperty('--rotation', rotation + 'deg');

    container.appendChild(confetti);
  };

  /**
   * Clear the leaderboard display
   */
  LeaderboardDisplay.prototype.clear = function() {
    this.container.innerHTML = '';
    this.sortedUsers = null;
    this.isAnimating = false;

    // Remove confetti container
    var confettiContainer = document.getElementById('confetti-container');
    if (confettiContainer && confettiContainer.parentNode) {
      confettiContainer.parentNode.removeChild(confettiContainer);
    }
  };

  /**
   * Destroy the LeaderboardDisplay instance
   */
  LeaderboardDisplay.prototype.destroy = function() {
    this.clear();
    this.container = null;
  };

  // ==========================================================================
  // LeaderboardUser Class (Mobile User View)
  // ==========================================================================

  /**
   * LeaderboardUser class for displaying personal rank to mobile users
   *
   * @param {string} containerId - The ID of the container element
   */
  function LeaderboardUser(containerId) {
    // Get container element
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('LeaderboardUser: Container element not found:', containerId);
      return;
    }

    // Inject styles
    this.injectStyles();
  }

  /**
   * Inject personal leaderboard styles
   */
  LeaderboardUser.prototype.injectStyles = function() {
    if (document.getElementById('leaderboard-user-styles')) return;

    var style = document.createElement('style');
    style.id = 'leaderboard-user-styles';
    style.textContent = [
      '.user-rank-card {',
      '  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%);',
      '  border: 2px solid rgba(255, 255, 255, 0.2);',
      '  border-radius: 16px;',
      '  padding: 24px;',
      '  text-align: center;',
      '  backdrop-filter: blur(10px);',
      '  animation: slideIn 0.5s ease-out forwards;',
      '}',
      '.user-rank-position {',
      '  font-family: var(--font-display);',
      '  font-size: 5rem;',
      '  line-height: 1;',
      '  margin-bottom: 8px;',
      '}',
      '.user-rank-position.gold { color: #FFD700; }',
      '.user-rank-position.silver { color: #C0C0C0; }',
      '.user-rank-position.bronze { color: #CD7F32; }',
      '.user-rank-position.top-three { animation: pulse 1s ease-in-out infinite; }',
      '.user-rank-label {',
      '  font-family: var(--font-body);',
      '  font-size: 1rem;',
      '  color: rgba(255, 255, 255, 0.7);',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.1em;',
      '  margin-bottom: 16px;',
      '}',
      '.user-rank-name {',
      '  font-family: var(--font-display);',
      '  font-size: 2rem;',
      '  color: #fff;',
      '  margin-bottom: 8px;',
      '}',
      '.user-rank-points {',
      '  font-family: var(--font-display);',
      '  font-size: 3rem;',
      '  color: var(--color-lemon);',
      '  margin-bottom: 24px;',
      '}',
      '.user-points-breakdown {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '  margin-top: 24px;',
      '  padding-top: 24px;',
      '  border-top: 1px solid rgba(255, 255, 255, 0.2);',
      '}',
      '.breakdown-item {',
      '  display: flex;',
      '  justify-content: space-between;',
      '  align-items: center;',
      '  padding: 8px 12px;',
      '  background: rgba(0, 0, 0, 0.2);',
      '  border-radius: 8px;',
      '}',
      '.breakdown-label {',
      '  font-family: var(--font-body);',
      '  font-size: 0.875rem;',
      '  color: rgba(255, 255, 255, 0.7);',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 8px;',
      '}',
      '.breakdown-value {',
      '  font-family: var(--font-display);',
      '  font-size: 1.25rem;',
      '  color: #fff;',
      '}',
      '.breakdown-icon {',
      '  width: 24px;',
      '  height: 24px;',
      '  border-radius: 4px;',
      '  display: inline-flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  font-size: 14px;',
      '}',
      '.breakdown-icon.quiz { background: rgba(255, 45, 45, 0.3); }',
      '.breakdown-icon.polling { background: rgba(255, 107, 43, 0.3); }',
      '.breakdown-icon.reaction { background: rgba(181, 255, 77, 0.3); }'
    ].join('\n');

    document.head.appendChild(style);
  };

  /**
   * Sort users by total points descending
   * @param {Array} users - Array of user objects
   * @returns {Array} Sorted users array
   */
  LeaderboardUser.prototype.sortUsers = function(users) {
    return users.slice().sort(function(a, b) {
      var pointsA = (a.points && a.points.total) || 0;
      var pointsB = (b.points && b.points.total) || 0;
      return pointsB - pointsA;
    });
  };

  /**
   * Find user's rank in the sorted list
   * @param {string} userId - User ID to find
   * @param {Array} sortedUsers - Sorted users array
   * @returns {number} User's rank (1-based), or -1 if not found
   */
  LeaderboardUser.prototype.findUserRank = function(userId, sortedUsers) {
    for (var i = 0; i < sortedUsers.length; i++) {
      if (sortedUsers[i].id === userId) {
        return i + 1;
      }
    }
    return -1;
  };

  /**
   * Get medal emoji for rank
   * @param {number} rank - 1-based rank
   * @returns {string} Medal emoji or rank number
   */
  LeaderboardUser.prototype.getMedalEmoji = function(rank) {
    if (rank >= 1 && rank <= 3) {
      return MEDAL_EMOJIS[rank - 1];
    }
    return rank.toString();
  };

  /**
   * Get rank-specific CSS class
   * @param {number} rank - 1-based rank
   * @returns {string} CSS class name
   */
  LeaderboardUser.prototype.getRankClass = function(rank) {
    if (rank === 1) return 'gold';
    if (rank === 2) return 'silver';
    if (rank === 3) return 'bronze';
    return '';
  };

  /**
   * Format number with thousand separators
   * @param {number} num - Number to format
   * @returns {string} Formatted number string
   */
  LeaderboardUser.prototype.formatNumber = function(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  /**
   * Show user's personal rank with point breakdown
   * @param {string} userId - Current user's ID
   * @param {Array} users - Array of all user objects
   */
  LeaderboardUser.prototype.showPersonalRank = function(userId, users) {
    // Clear container
    this.container.innerHTML = '';

    // Sort users
    var sortedUsers = this.sortUsers(users);

    // Find user's rank
    var rank = this.findUserRank(userId, sortedUsers);

    // Find user's data
    var userData = null;
    for (var i = 0; i < sortedUsers.length; i++) {
      if (sortedUsers[i].id === userId) {
        userData = sortedUsers[i];
        break;
      }
    }

    if (!userData) {
      this.container.innerHTML = '<p class="text-center" style="color: #fff;">User not found</p>';
      return;
    }

    // Get points breakdown
    var points = userData.points || {};
    var quizPoints = points.quiz || 0;
    var pollingPoints = points.polling || 0;
    var reactionPoints = points.reaction || 0;
    var totalPoints = points.total || 0;

    // Create rank card
    var card = document.createElement('div');
    card.className = 'user-rank-card';

    // Determine rank classes
    var rankClass = this.getRankClass(rank);
    var topThreeClass = rank <= 3 ? ' top-three' : '';

    card.innerHTML = [
      '<div class="user-rank-position ' + rankClass + topThreeClass + '">',
      this.getMedalEmoji(rank),
      '</div>',
      '<div class="user-rank-label">Posisi Kamu</div>',
      '<div class="user-rank-name">' + this.escapeHtml(userData.name || 'Anonymous') + '</div>',
      '<div class="user-rank-points">' + this.formatNumber(totalPoints) + '</div>',
      '<div class="user-points-breakdown">',
      '  <div class="breakdown-item">',
      '    <span class="breakdown-label">',
      '      <span class="breakdown-icon quiz">Q</span>',
      '      Quiz',
      '    </span>',
      '    <span class="breakdown-value">' + this.formatNumber(quizPoints) + '</span>',
      '  </div>',
      '  <div class="breakdown-item">',
      '    <span class="breakdown-label">',
      '      <span class="breakdown-icon polling">P</span>',
      '      Polling',
      '    </span>',
      '    <span class="breakdown-value">' + this.formatNumber(pollingPoints) + '</span>',
      '  </div>',
      '  <div class="breakdown-item">',
      '    <span class="breakdown-label">',
      '      <span class="breakdown-icon reaction">R</span>',
      '      Reaction',
      '    </span>',
      '    <span class="breakdown-value">' + this.formatNumber(reactionPoints) + '</span>',
      '  </div>',
      '</div>'
    ].join('');

    this.container.appendChild(card);

    // Trigger confetti for top 3
    if (rank <= 3) {
      this.createConfetti();
    }
  };

  /**
   * Create confetti animation for user
   */
  LeaderboardUser.prototype.createConfetti = function() {
    var count = 50; // Smaller confetti for user view

    // Create confetti container
    var confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti-container';
    confettiContainer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; overflow: hidden; z-index: 1000;';
    document.body.appendChild(confettiContainer);

    // Create confetti pieces
    for (var i = 0; i < count; i++) {
      this.createConfettiPiece(confettiContainer);
    }

    // Auto-remove after animation
    var self = this;
    setTimeout(function() {
      if (confettiContainer.parentNode) {
        confettiContainer.parentNode.removeChild(confettiContainer);
      }
    }, CONFETTI_DURATION + 500);
  };

  /**
   * Create a single confetti piece
   * @param {HTMLElement} container - Container element
   */
  LeaderboardUser.prototype.createConfettiPiece = function(container) {
    var confetti = document.createElement('div');
    confetti.className = 'confetti';

    // Random position
    var leftPos = Math.random() * 100;
    confetti.style.left = leftPos + '%';
    confetti.style.top = '-10px';

    // Random color from palette
    var color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    confetti.style.backgroundColor = color;

    // Random size
    var size = 5 + Math.random() * 10;
    confetti.style.width = size + 'px';
    confetti.style.height = size + 'px';

    // Random shape
    if (Math.random() > 0.5) {
      confetti.style.borderRadius = '50%';
    }

    // Animation
    var duration = CONFETTI_DURATION + (Math.random() - 0.5) * 1000;
    confetti.style.animation = 'confettiFall ' + duration + 'ms ease-out forwards';

    container.appendChild(confetti);
  };

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  LeaderboardUser.prototype.escapeHtml = function(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * Clear the user leaderboard view
   */
  LeaderboardUser.prototype.clear = function() {
    this.container.innerHTML = '';
  };

  /**
   * Destroy the LeaderboardUser instance
   */
  LeaderboardUser.prototype.destroy = function() {
    this.clear();
    this.container = null;
  };

  // ==========================================================================
  // Export to Window
  // ==========================================================================

  // Expose classes globally
  window.LeaderboardDisplay = LeaderboardDisplay;
  window.LeaderboardUser = LeaderboardUser;

  // Also expose point constants for external use
  window.LEADERBOARD_POINTS = POINTS;

})(window);
