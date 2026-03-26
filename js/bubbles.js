/**
 * Bubble Physics Module for AnxietyTalk
 *
 * Provides Matter.js-based bubble physics for word cloud animation.
 * Bubbles bounce around the canvas with realistic physics and animated pop-in effects.
 *
 * Dependencies:
 * - Matter.js (loaded via CDN in display.html)
 */

/**
 * Available bubble colors for variety
 * @type {string[]}
 */
const BUBBLE_COLORS = [
  '#FF6B2B', // Orange
  '#FFE500', // Yellow
  '#FF3CAC', // Hot Pink
  '#B5FF4D', // Lime Green
  '#2D6AFF', // Blue
  '#FF2D2D'  // Red
];

/**
 * Bubble configuration constants
 * @type {Object}
 */
const BUBBLE_CONFIG = {
  radius: 50,
  borderWidth: 3,
  borderColor: '#000000',
  lineHeight: 16,
  maxVelocity: 3,
  minVelocity: 0.5,
  popInDuration: 300 // ms
};

(function(window) {
  'use strict';

  /**
   * BubbleCloud class for managing animated bubbles with Matter.js physics
   *
   * @param {string} containerId - The ID of the container element
   */
  function BubbleCloud(containerId) {
    // Get container element
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('BubbleCloud: Container element not found:', containerId);
      return;
    }

    // Create canvas element
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Physics objects
    this.engine = null;
    this.runner = null;
    this.walls = [];
    this.bubbles = []; // Array of { body, text, color, scale, createdAt }

    // Track colors used per user for variety
    this.userColors = {};

    // Animation state
    this.animationId = null;
    this.isRunning = false;

    // Initialize physics
    this.initPhysics();

    // Handle resize
    this.resize();
    window.addEventListener('resize', this.resize.bind(this));
  }

  /**
   * Initialize Matter.js physics engine with no gravity
   */
  BubbleCloud.prototype.initPhysics = function() {
    // Create engine with no gravity
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: 0 }
    });

    // Create runner
    this.runner = Matter.Runner.create();

    // Start the runner
    Matter.Runner.run(this.runner, this.engine);

    // Start animation loop
    this.startAnimation();
  };

  /**
   * Handle window resize - update canvas and wall positions
   */
  BubbleCloud.prototype.resize = function() {
    // Get container dimensions
    var rect = this.container.getBoundingClientRect();
    var width = rect.width;
    var height = rect.height;

    // Update canvas dimensions with device pixel ratio for sharpness
    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.scale(dpr, dpr);

    // Store logical dimensions
    this.width = width;
    this.height = height;

    // Recreate walls
    this.createWalls();
  };

  /**
   * Create static walls at the edges of the canvas
   */
  BubbleCloud.prototype.createWalls = function() {
    var self = this;

    // Remove existing walls
    if (this.walls.length > 0) {
      Matter.Composite.remove(this.engine.world, this.walls);
      this.walls = [];
    }

    var wallThickness = 50;
    var wallOptions = {
      isStatic: true,
      restitution: 1, // Perfect bouncing
      friction: 0,     // No friction
      frictionAir: 0,  // No air resistance
      label: 'wall'
    };

    // Create walls: top, bottom, left, right
    var walls = [
      // Top
      Matter.Bodies.rectangle(
        this.width / 2,
        -wallThickness / 2,
        this.width + wallThickness * 2,
        wallThickness,
        wallOptions
      ),
      // Bottom
      Matter.Bodies.rectangle(
        this.width / 2,
        this.height + wallThickness / 2,
        this.width + wallThickness * 2,
        wallThickness,
        wallOptions
      ),
      // Left
      Matter.Bodies.rectangle(
        -wallThickness / 2,
        this.height / 2,
        wallThickness,
        this.height + wallThickness * 2,
        wallOptions
      ),
      // Right
      Matter.Bodies.rectangle(
        this.width + wallThickness / 2,
        this.height / 2,
        wallThickness,
        this.height + wallThickness * 2,
        wallOptions
      )
    ];

    // Add walls to world
    Matter.Composite.add(this.engine.world, walls);
    this.walls = walls;

    // Reposition existing bubbles that are outside bounds
    this.bubbles.forEach(function(bubble) {
      var body = bubble.body;
      var radius = BUBBLE_CONFIG.radius;

      // Clamp position to within bounds
      if (body.position.x < radius) {
        Matter.Body.setPosition(body, { x: radius, y: body.position.y });
      }
      if (body.position.x > self.width - radius) {
        Matter.Body.setPosition(body, { x: self.width - radius, y: body.position.y });
      }
      if (body.position.y < radius) {
        Matter.Body.setPosition(body, { x: body.position.x, y: radius });
      }
      if (body.position.y > self.height - radius) {
        Matter.Body.setPosition(body, { x: body.position.x, y: self.height - radius });
      }
    });
  };

  /**
   * Pick a random color that hasn't been used recently by the user
   * @param {string} userId - The user identifier
   * @param {string[]} previousColors - Colors to avoid
   * @returns {string} A color from BUBBLE_COLORS
   */
  BubbleCloud.prototype.pickColor = function(userId, previousColors) {
    // Get user's recent colors
    var recentColors = this.userColors[userId] || [];

    // Combine previous colors and recent colors to avoid
    var avoidColors = recentColors.concat(previousColors || []);

    // Filter out colors to avoid
    var availableColors = BUBBLE_COLORS.filter(function(color) {
      return avoidColors.indexOf(color) === -1;
    });

    // If all colors are used, fall back to all colors
    if (availableColors.length === 0) {
      availableColors = BUBBLE_COLORS.slice();
    }

    // Pick random color
    var color = availableColors[Math.floor(Math.random() * availableColors.length)];

    // Update user's recent colors (keep last 3)
    this.userColors[userId] = recentColors.concat([color]).slice(-3);

    return color;
  };

  /**
   * Add a new bubble to the cloud
   * @param {string} text - The text to display in the bubble
   * @param {string} userId - The user identifier (for color tracking)
   * @param {string[]} [previousColors] - Colors to avoid using
   */
  BubbleCloud.prototype.addBubble = function(text, userId, previousColors) {
    var self = this;
    var radius = BUBBLE_CONFIG.radius;

    // Pick a color
    var color = this.pickColor(userId, previousColors);

    // Random position within bounds (with padding)
    var padding = radius * 2;
    var x = padding + Math.random() * (this.width - padding * 2);
    var y = padding + Math.random() * (this.height - padding * 2);

    // Random initial velocity
    var angle = Math.random() * Math.PI * 2;
    var speed = BUBBLE_CONFIG.minVelocity + Math.random() * (BUBBLE_CONFIG.maxVelocity - BUBBLE_CONFIG.minVelocity);
    var vx = Math.cos(angle) * speed;
    var vy = Math.sin(angle) * speed;

    // Create physics body
    var body = Matter.Bodies.circle(x, y, radius, {
      restitution: 1,  // Perfect bouncing
      friction: 0,      // No friction
      frictionAir: 0,  // No air resistance
      label: 'bubble'
    });

    // Set initial velocity
    Matter.Body.setVelocity(body, { x: vx, y: vy });

    // Add to physics world
    Matter.Composite.add(this.engine.world, body);

    // Create bubble object with scale animation starting at 0
    var bubble = {
      body: body,
      text: text,
      color: color,
      scale: 0,
      createdAt: Date.now(),
      rotation: (Math.random() - 0.5) * 0.5 // Random rotation: -0.25 to 0.25 radians
    };

    this.bubbles.push(bubble);

    // Animate scale from 0 to 1 (pop-in effect)
    this.animatePopIn(bubble);
  };

  /**
   * Animate the pop-in effect for a bubble
   * @param {Object} bubble - The bubble object
   */
  BubbleCloud.prototype.animatePopIn = function(bubble) {
    var self = this;
    var startTime = Date.now();
    var duration = BUBBLE_CONFIG.popInDuration;

    function animate() {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(elapsed / duration, 1);

      // Ease out cubic for bounce effect
      bubble.scale = 1 - Math.pow(1 - progress, 3);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        bubble.scale = 1;
      }
    }

    animate();
  };

  /**
   * Start the animation loop
   */
  BubbleCloud.prototype.startAnimation = function() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.animate();
  };

  /**
   * Stop the animation loop
   */
  BubbleCloud.prototype.stopAnimation = function() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  };

  /**
   * Main animation loop - clear canvas and draw bubbles
   */
  BubbleCloud.prototype.animate = function() {
    var self = this;

    if (!this.isRunning) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw each bubble
    this.bubbles.forEach(function(bubble) {
      self.drawBubble(bubble);
    });

    // Continue loop
    this.animationId = requestAnimationFrame(function() {
      self.animate();
    });
  };

  /**
   * Draw a single bubble
   * @param {Object} bubble - The bubble object
   */
  BubbleCloud.prototype.drawBubble = function(bubble) {
    var body = bubble.body;
    var x = body.position.x;
    var y = body.position.y;
    var radius = BUBBLE_CONFIG.radius * bubble.scale;
    var color = bubble.color;

    if (radius <= 0) return;

    var ctx = this.ctx;

    // Save context state
    ctx.save();

    // Move to bubble center for rotation
    ctx.translate(x, y);
    ctx.rotate(bubble.rotation);
    ctx.translate(-x, -y);

    // Draw filled circle
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Draw border
    ctx.strokeStyle = BUBBLE_CONFIG.borderColor;
    ctx.lineWidth = BUBBLE_CONFIG.borderWidth;
    ctx.stroke();

    // Draw text with word wrap
    this.drawText(x, y, radius, bubble.text);

    // Restore context state
    ctx.restore();
  };

  /**
   * Draw wrapped text inside a bubble
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} radius - Bubble radius (for scaling)
   * @param {string} text - Text to draw
   */
  BubbleCloud.prototype.drawText = function(x, y, radius, text) {
    var ctx = this.ctx;
    var lineHeight = BUBBLE_CONFIG.lineHeight;
    var maxWidth = radius * 1.5; // Text wrap width

    // Font settings
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';

    // Word wrap algorithm
    var words = text.split(' ');
    var lines = [];
    var currentLine = '';

    words.forEach(function(word) {
      var testLine = currentLine ? currentLine + ' ' + word : word;
      var metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    // Calculate starting Y position (centered vertically)
    var totalHeight = lines.length * lineHeight;
    var startY = y - totalHeight / 2 + lineHeight / 2;

    // Draw each line
    lines.forEach(function(line, index) {
      ctx.fillText(line, x, startY + index * lineHeight);
    });
  };

  /**
   * Remove all bubbles from the cloud
   */
  BubbleCloud.prototype.clear = function() {
    var self = this;

    // Remove all bubble bodies from physics world
    this.bubbles.forEach(function(bubble) {
      Matter.Composite.remove(self.engine.world, bubble.body);
    });

    // Clear bubbles array
    this.bubbles = [];

    // Clear user colors tracking
    this.userColors = {};
  };

  /**
   * Destroy the BubbleCloud - clean up all resources
   */
  BubbleCloud.prototype.destroy = function() {
    // Stop animation
    this.stopAnimation();

    // Clear bubbles
    this.clear();

    // Stop and clear runner
    if (this.runner) {
      Matter.Runner.stop(this.runner);
      this.runner = null;
    }

    // Remove walls from world
    if (this.walls.length > 0) {
      Matter.Composite.remove(this.engine.world, this.walls);
      this.walls = [];
    }

    // Clear engine
    if (this.engine) {
      Matter.Engine.clear(this.engine);
      this.engine = null;
    }

    // Remove canvas from DOM
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }

    // Remove resize listener
    window.removeEventListener('resize', this.resize.bind(this));

    // Clear references
    this.container = null;
    this.canvas = null;
    this.ctx = null;
  };

  // Expose BubbleCloud globally
  window.BubbleCloud = BubbleCloud;

})(window);
