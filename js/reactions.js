/**
 * Reactions Module for AnxietyTalk
 *
 * Provides floating emoji reaction system for display screens
 * and reaction button bar for user screens.
 *
 * Dependencies:
 * - firebase/firebase-config.js (provides rtdb reference)
 * - css/display.css (provides floating-reaction animation styles)
 */

/**
 * Available emoji pool for reactions
 * @type {string[]}
 */
var EMOJI_POOL = ['😰', '😤', '😢', '😅', '🙏', '👏', '❤️', '🎉', '💪', '🤔'];

/**
 * Default emojis to display in reaction bar
 * @type {string[]}
 */
var DEFAULT_EMOJIS = ['😰', '😤', '😢', '😅', '🙏'];

/**
 * Points awarded per reaction
 * @type {number}
 */
var REACTION_POINTS = 10;

/**
 * Animation duration in milliseconds
 * @type {number}
 */
var ANIMATION_DURATION = 3000;

/**
 * Realtime Database path for reactions
 * @type {string}
 */
var REACTIONS_PATH = 'reactions';

/**
 * Points awarded per reaction sent
 * @type {number}
 */
var POINTS_PER_REACTION = 10;

(function(window) {
  'use strict';

  // ==========================================================================
  // ReactionSystem Class (Display Side)
  // ==========================================================================

  /**
   * ReactionSystem class for displaying floating emoji reactions
   *
   * @param {string} containerId - The ID of the container element
   */
  function ReactionSystem(containerId) {
    // Get container element
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('ReactionSystem: Container element not found:', containerId);
      return;
    }

    // Initialize emoji pool
    this.emojiPool = EMOJI_POOL.slice();

    // Maximum number of emojis on screen at once
    this.maxEmojis = 50;

    // Track active emoji elements
    this.activeEmojis = [];

    // Database listener reference for cleanup
    this.unsubscribe = null;
  }

  /**
   * Start listening for reactions from Realtime Database
   */
  ReactionSystem.prototype.startListening = function() {
    var self = this;

    // Clean up existing listener
    if (this.unsubscribe) {
      this.stopListening();
    }

    // Subscribe to reactions in Realtime Database
    var reactionsRefPath = rtdb.ref(REACTIONS_PATH);

    // Use 'child_added' to listen for new reactions
    this.unsubscribe = reactionsRefPath.on('child_added', function(snapshot) {
      var reactionData = snapshot.val();

      if (reactionData && reactionData.emoji) {
        // Add the emoji to the display
        self.addEmoji(reactionData.emoji);

        // Optionally remove the reaction from DB after processing
        // This prevents duplicate displays on reconnect
        snapshot.ref.remove().catch(function(error) {
          console.warn('Could not remove processed reaction:', error);
        });
      }
    }, function(error) {
      console.error('Error listening to reactions:', error);
    });
  };

  /**
   * Stop listening for reactions from Realtime Database
   */
  ReactionSystem.prototype.stopListening = function() {
    if (this.unsubscribe) {
      rtdb.ref(REACTIONS_PATH).off('child_added', this.unsubscribe);
      this.unsubscribe = null;
    }
  };

  /**
   * Add a floating emoji to the display
   * @param {string} emoji - The emoji to display
   */
  ReactionSystem.prototype.addEmoji = function(emoji) {
    var self = this;

    // If at max, remove oldest emoji
    if (this.activeEmojis.length >= this.maxEmojis) {
      var oldest = this.activeEmojis.shift();
      if (oldest && oldest.parentNode) {
        oldest.parentNode.removeChild(oldest);
      }
    }

    // Create div element with emoji text
    var emojiEl = document.createElement('div');
    emojiEl.className = 'floating-reaction';
    emojiEl.textContent = emoji;

    // Random position at bottom of screen (10-90% from left)
    var leftPos = 10 + Math.random() * 80;
    emojiEl.style.left = leftPos + '%';
    emojiEl.style.bottom = '0';

    // Random horizontal wobble for animation
    var wobble = (Math.random() - 0.5) * 100; // -50px to +50px
    emojiEl.style.setProperty('--wobble', wobble + 'px');

    // Random animation duration variation (2.5s to 3.5s)
    var duration = 2500 + Math.random() * 1000;
    emojiEl.style.animationDuration = duration + 'ms';

    // Random delay (0-500ms)
    var delay = Math.random() * 500;
    emojiEl.style.animationDelay = delay + 'ms';

    // Random scale (0.8 to 1.2)
    var scale = 0.8 + Math.random() * 0.4;
    emojiEl.style.fontSize = (2 * scale) + 'rem';

    // Add to container
    this.container.appendChild(emojiEl);

    // Track this emoji
    this.activeEmojis.push(emojiEl);

    // Remove element after animation completes
    setTimeout(function() {
      var index = self.activeEmojis.indexOf(emojiEl);
      if (index > -1) {
        self.activeEmojis.splice(index, 1);
      }
      if (emojiEl.parentNode) {
        emojiEl.parentNode.removeChild(emojiEl);
      }
    }, delay + duration);
  };

  /**
   * Send a reaction to the database and update user points
   * @param {string} emoji - The emoji to send
   * @param {string} [userId] - Optional user ID for points tracking
   * @returns {Promise<void>}
   */
  ReactionSystem.prototype.sendReaction = function(emoji, userId) {
    var self = this;

    // Validate emoji
    if (!emoji || this.emojiPool.indexOf(emoji) === -1) {
      console.warn('Invalid emoji:', emoji);
      emoji = this.emojiPool[Math.floor(Math.random() * this.emojiPool.length)];
    }

    // Create reaction data
    var reactionData = {
      emoji: emoji,
      timestamp: Date.now()
    };

    // Add userId if provided
    if (userId) {
      reactionData.userId = userId;
    }

    // Push to Realtime Database
    return rtdb.ref(REACTIONS_PATH).push(reactionData)
      .then(function() {
        // Also update user points if userId provided
        if (userId && window.User) {
          window.User.updateUserPoints(userId, 'reaction', POINTS_PER_REACTION)
            .catch(function(error) {
              console.warn('Could not update reaction points:', error);
            });
        }
      })
      .catch(function(error) {
        console.error('Error sending reaction:', error);
        throw error;
      });
  };

  /**
   * Destroy the ReactionSystem - clean up all resources
   */
  ReactionSystem.prototype.destroy = function() {
    // Stop listening
    this.stopListening();

    // Remove all active emoji elements
    var self = this;
    this.activeEmojis.forEach(function(emojiEl) {
      if (emojiEl.parentNode) {
        emojiEl.parentNode.removeChild(emojiEl);
      }
    });
    this.activeEmojis = [];

    // Clear references
    this.container = null;
    this.emojiPool = null;
  };

  // ==========================================================================
  // ReactionBar Class (User Side)
  // ==========================================================================

  /**
   * ReactionBar class for rendering reaction emoji buttons
   *
   * @param {string} containerId - The ID of the container element
   * @param {string[]} [emojis] - Array of emoji strings to display
   * @param {Function} [onReaction] - Callback when a reaction is clicked
   */
  function ReactionBar(containerId, emojis, onReaction) {
    // Get container element
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('ReactionBar: Container element not found:', containerId);
      return;
    }

    // Store emojis array (use default if not provided)
    this.emojis = emojis || DEFAULT_EMOJIS.slice();

    // Store callback
    this.onReaction = onReaction || null;

    // Track button elements for animations
    this.buttons = [];

    // Render the bar
    this.render();
  }

  /**
   * Render the reaction bar with emoji buttons
   */
  ReactionBar.prototype.render = function() {
    var self = this;

    // Clear container
    this.container.innerHTML = '';
    this.buttons = [];

    // Create wrapper for styling
    var wrapper = document.createElement('div');
    wrapper.className = 'reaction-bar';
    wrapper.style.display = 'flex';
    wrapper.style.gap = '0.75rem';
    wrapper.style.padding = '0.5rem';
    wrapper.style.justifyContent = 'center';

    // Create button for each emoji
    this.emojis.forEach(function(emoji) {
      var btn = document.createElement('button');
      btn.className = 'reaction-btn';
      btn.type = 'button';
      btn.setAttribute('data-emoji', emoji);
      btn.style.cssText = [
        'font-size: 1.75rem',
        'width: 48px',
        'height: 48px',
        'border: 2px solid rgba(255, 255, 255, 0.3)',
        'border-radius: 12px',
        'background: rgba(255, 255, 255, 0.1)',
        'cursor: pointer',
        'transition: transform 0.15s ease, background 0.15s ease',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'backdrop-filter: blur(4px)'
      ].join(';');

      // Set emoji content
      btn.textContent = emoji;

      // Add click handler
      btn.addEventListener('click', function() {
        self.handleClick(emoji, btn);
      });

      // Add hover effects
      btn.addEventListener('mouseenter', function() {
        btn.style.background = 'rgba(255, 255, 255, 0.2)';
        btn.style.transform = 'scale(1.1)';
      });

      btn.addEventListener('mouseleave', function() {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
        btn.style.transform = 'scale(1)';
      });

      // Add active/pressed state
      btn.addEventListener('mousedown', function() {
        btn.style.transform = 'scale(0.95)';
      });

      btn.addEventListener('mouseup', function() {
        btn.style.transform = 'scale(1.1)';
      });

      wrapper.appendChild(btn);
      self.buttons.push(btn);
    });

    // Add wrapper to container
    this.container.appendChild(wrapper);

    // Add keyframes for button press animation (if not already defined)
    self.injectButtonStyles();
  };

  /**
   * Inject button press animation styles
   */
  ReactionBar.prototype.injectButtonStyles = function() {
    if (document.getElementById('reaction-bar-styles')) return;

    var style = document.createElement('style');
    style.id = 'reaction-bar-styles';
    style.textContent = [
      '@keyframes reactionPop {',
      '  0% { transform: scale(0.95); }',
      '  50% { transform: scale(1.3); }',
      '  100% { transform: scale(1); }',
      '}',
      '.reaction-btn.animating {',
      '  animation: reactionPop 0.3s ease-out;',
      '  background: rgba(255, 255, 255, 0.3) !important;',
      '}'
    ].join('\n');

    document.head.appendChild(style);
  };

  /**
   * Handle click on an emoji button
   * @param {string} emoji - The emoji that was clicked
   * @param {HTMLElement} btn - The button element
   */
  ReactionBar.prototype.handleClick = function(emoji, btn) {
    var self = this;

    // Visual feedback - add animation class
    btn.classList.add('animating');

    // Remove animation class after animation completes
    setTimeout(function() {
      btn.classList.remove('animating');
    }, 300);

    // Call onReaction callback if provided
    if (typeof this.onReaction === 'function') {
      this.onReaction(emoji);
    }
  };

  /**
   * Update the emojis displayed in the bar
   * @param {string[]} emojis - New array of emojis
   */
  ReactionBar.prototype.updateEmojis = function(emojis) {
    if (emojis && Array.isArray(emojis) && emojis.length > 0) {
      this.emojis = emojis.slice();
      this.render();
    }
  };

  /**
   * Update the reaction callback
   * @param {Function} callback - New callback function
   */
  ReactionBar.prototype.setCallback = function(callback) {
    if (typeof callback === 'function') {
      this.onReaction = callback;
    }
  };

  /**
   * Destroy the ReactionBar - clean up
   */
  ReactionBar.prototype.destroy = function() {
    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Clear references
    this.container = null;
    this.emojis = null;
    this.onReaction = null;
    this.buttons = [];
  };

  // ==========================================================================
  // Export to Window
  // ==========================================================================

  // Expose ReactionSystem and ReactionBar globally
  window.ReactionSystem = ReactionSystem;
  window.ReactionBar = ReactionBar;

})(window);
