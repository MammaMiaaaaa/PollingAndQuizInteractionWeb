/**
 * AnxietyTalk Quiz Module
 * Handles quiz logic, speed-based scoring, and UI displays
 */

(function(window) {
    'use strict';

    // ==========================================================================
    // QuizManager Class - Core Quiz Logic
    // ==========================================================================

    class QuizManager {
        constructor() {
            this.listeners = {};
            this.currentQuestion = null;
            this.currentDuration = 0;
            this.startTime = 0;
            this.timerId = null;
            this.isActive = false;
            this.questionIndex = 0;
            this.totalQuestions = 0;
            this.score = 0;
            this.answeredCount = 0;
        }

        /**
         * Subscribe to an event
         * @param {string} event - Event name
         * @param {Function} callback - Event handler
         */
        on(event, callback) {
            if (!this.listeners[event]) {
                this.listeners[event] = [];
            }
            this.listeners[event].push(callback);
        }

        /**
         * Trigger an event
         * @param {string} event - Event name
         * @param {*} data - Event data
         */
        emit(event, data) {
            if (this.listeners[event]) {
                this.listeners[event].forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Error in event handler for ${event}:`, error);
                    }
                });
            }
        }

        /**
         * Start a question with timer
         * @param {Object} question - Question object
         * @param {number} duration - Duration in seconds
         */
        startQuestion(question, duration) {
            this.currentQuestion = question;
            this.currentDuration = duration;
            this.startTime = Date.now();
            this.isActive = true;

            // Emit question start event
            this.emit('questionStart', {
                question: question,
                duration: duration,
                index: this.questionIndex,
                total: this.totalQuestions
            });

            // Start countdown timer
            this._startTimer(duration);
        }

        /**
         * Internal timer logic
         * @private
         */
        _startTimer(duration) {
            let remaining = duration;

            this.timerId = setInterval(() => {
                remaining--;

                this.emit('timerTick', {
                    timeRemaining: remaining,
                    totalTime: this.currentDuration
                });

                if (remaining <= 0) {
                    this._clearTimer();
                    this.endQuestion();
                }
            }, 1000);
        }

        /**
         * Clear the timer interval
         * @private
         */
        _clearTimer() {
            if (this.timerId) {
                clearInterval(this.timerId);
                this.timerId = null;
            }
        }

        /**
         * Submit an answer and calculate points
         * @param {number} optionIndex - Selected option index (0-3)
         * @returns {Object} Result with points and correctness
         */
        submitAnswer(optionIndex) {
            if (!this.isActive || !this.currentQuestion) {
                return { success: false, error: 'No active question' };
            }

            this._clearTimer();
            this.isActive = false;

            const timeRemaining = this.currentDuration - this._getElapsedSeconds();
            const isCorrect = optionIndex === this.currentQuestion.correctIndex;
            const points = this._calculateScore(timeRemaining);

            this.score += points;
            this.answeredCount++;

            const result = {
                isCorrect: isCorrect,
                points: points,
                timeRemaining: timeRemaining,
                duration: this.currentDuration,
                selectedIndex: optionIndex,
                correctIndex: this.currentQuestion.correctIndex,
                totalScore: this.score,
                answeredCount: this.answeredCount
            };

            this.emit('answerSubmit', result);

            return result;
        }

        /**
         * Get elapsed seconds since question started
         * @private
         */
        _getElapsedSeconds() {
            return Math.floor((Date.now() - this.startTime) / 1000);
        }

        /**
         * Calculate speed-based score
         * Base score = 1000 points
         * Speed bonus = 500 × (time_remaining / duration)
         * Total max = 1500 points per question
         * @private
         */
        _calculateScore(timeRemaining) {
            const baseScore = 1000;
            const maxBonus = 500;
            const speedRatio = Math.max(0, timeRemaining / this.currentDuration);
            const speedBonus = Math.floor(maxBonus * speedRatio);

            return baseScore + speedBonus;
        }

        /**
         * End question without answering (time up)
         */
        endQuestion() {
            if (!this.isActive || !this.currentQuestion) {
                return;
            }

            this._clearTimer();
            this.isActive = false;

            const result = {
                timedOut: true,
                correctIndex: this.currentQuestion.correctIndex,
                points: 0,
                answeredCount: this.answeredCount,
                totalScore: this.score
            };

            this.emit('questionEnd', result);

            return result;
        }

        /**
         * Set total number of questions
         * @param {number} total
         */
        setTotalQuestions(total) {
            this.totalQuestions = total;
        }

        /**
         * Get current score
         * @returns {number}
         */
        getScore() {
            return this.score;
        }

        /**
         * Get current question number (1-indexed)
         * @returns {number}
         */
        getCurrentQuestionNumber() {
            return this.questionIndex + 1;
        }

        /**
         * Move to next question
         */
        nextQuestion() {
            this.questionIndex++;
            this.currentQuestion = null;
        }

        /**
         * Reset the quiz state
         */
        reset() {
            this._clearTimer();
            this.currentQuestion = null;
            this.currentDuration = 0;
            this.startTime = 0;
            this.isActive = false;
            this.questionIndex = 0;
            this.score = 0;
            this.answeredCount = 0;
        }
    }

    // ==========================================================================
    // QuizDisplay Class - Main Screen Display
    // ==========================================================================

    class QuizDisplay {
        constructor() {
            this.container = null;
            this.currentQuestionId = null;
            this.answerCountCallback = null;
            this.onOptionClick = null;
        }

        /**
         * Initialize the display
         * @param {HTMLElement|string} container - Container element or selector
         */
        init(container) {
            if (typeof container === 'string') {
                this.container = document.querySelector(container);
            } else {
                this.container = container;
            }

            if (!this.container) {
                console.error('QuizDisplay: Container not found');
                return;
            }

            this._injectStyles();
        }

        /**
         * Inject required CSS styles
         * @private
         */
        _injectStyles() {
            if (document.getElementById('quiz-display-styles')) {
                return;
            }

            const styles = document.createElement('style');
            styles.id = 'quiz-display-styles';
            styles.textContent = `
                .quiz-display {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    text-align: center;
                    padding: 20px;
                    color: white;
                }

                .quiz-header {
                    margin-bottom: 30px;
                }

                .quiz-progress {
                    font-size: 18px;
                    color: rgba(255, 255, 255, 0.8);
                    margin-bottom: 10px;
                }

                .quiz-timer {
                    font-size: 48px;
                    font-weight: bold;
                    color: #FFE500;
                    margin: 20px 0;
                }

                .quiz-timer.warning {
                    color: #FF2D2D;
                    animation: pulse 0.5s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                .quiz-question {
                    font-size: 28px;
                    font-weight: 600;
                    margin: 30px 0;
                    line-height: 1.4;
                }

                .quiz-options {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .quiz-option {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    padding: 25px;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 20px;
                    font-weight: 600;
                    color: rgba(0, 0, 0, 0.8);
                }

                .quiz-option:hover {
                    transform: scale(1.02);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
                }

                .quiz-option.disabled {
                    pointer-events: none;
                    opacity: 0.6;
                }

                .quiz-option.correct {
                    box-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
                    transform: scale(1.05);
                }

                .quiz-option-a {
                    background: #FF2D2D;
                }

                .quiz-option-b {
                    background: #2D6AFF;
                }

                .quiz-option-c {
                    background: #B5FF4D;
                }

                .quiz-option-d {
                    background: #FFE500;
                }

                .quiz-option-icon {
                    font-size: 28px;
                    font-weight: bold;
                }

                .quiz-option-a .quiz-option-icon {
                    color: white;
                }

                .quiz-option-b .quiz-option-icon {
                    color: white;
                }

                .quiz-option-c .quiz-option-icon {
                    color: rgba(0, 0, 0, 0.8);
                }

                .quiz-option-d .quiz-option-icon {
                    color: rgba(0, 0, 0, 0.8);
                }

                .quiz-result-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .quiz-result-points {
                    font-size: 72px;
                    font-weight: bold;
                    color: #FFE500;
                    margin: 20px 0;
                }

                .quiz-result-points.correct {
                    color: #B5FF4D;
                }

                .quiz-result-points.incorrect {
                    color: #FF2D2D;
                }

                .quiz-result-label {
                    font-size: 24px;
                    color: rgba(255, 255, 255, 0.8);
                }

                .quiz-answer-count {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: rgba(0, 0, 0, 0.6);
                    padding: 10px 20px;
                    border-radius: 20px;
                    font-size: 16px;
                    color: white;
                }
            `;
            document.head.appendChild(styles);
        }

        /**
         * Render a question with timer
         * @param {Object} question - Question object
         * @param {number} index - Current question index (0-based)
         * @param {number} total - Total questions
         * @param {number} timeRemaining - Seconds remaining
         * @param {number} totalTime - Total time for question
         */
        renderQuestion(question, index, total, timeRemaining, totalTime) {
            if (!this.container) return;

            this.currentQuestionId = `quiz-question-${Date.now()}`;

            const timerClass = timeRemaining <= 5 ? 'quiz-timer warning' : 'quiz-timer';

            const html = `
                <div class="quiz-display">
                    <div class="quiz-header">
                        <div class="quiz-progress">Question ${index + 1} of ${total}</div>
                        <div class="quiz-timer ${timerClass}">${this.formatTime(timeRemaining)}</div>
                    </div>
                    <div class="quiz-question">${this._escapeHtml(question.text)}</div>
                    <div class="quiz-options" id="${this.currentQuestionId}">
                        ${question.options.map((option, i) => this.renderOption(i, option)).join('')}
                    </div>
                </div>
            `;

            this.container.innerHTML = html;
            this._attachOptionListeners();
        }

        /**
         * Render a single option
         * @param {number} index - Option index (0-3)
         * @param {string} text - Option text
         * @returns {string} HTML string
         */
        renderOption(index, text) {
            const letters = ['A', 'B', 'C', 'D'];
            const icons = ['&#9650;', '&#9670;', '&#9675;', '&#9632;']; // Triangle, Diamond, Circle, Square
            const classes = ['quiz-option-a', 'quiz-option-b', 'quiz-option-c', 'quiz-option-d'];

            return `
                <div class="quiz-option ${classes[index]}" data-index="${index}">
                    <span class="quiz-option-icon">${icons[index]}</span>
                    <span class="quiz-option-text">${this._escapeHtml(text)}</span>
                </div>
            `;
        }

        /**
         * Attach click listeners to options
         * @private
         */
        _attachOptionListeners() {
            const options = this.container.querySelectorAll('.quiz-option');
            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    if (this.onOptionClick) {
                        this.onOptionClick(index);
                    }
                });
            });
        }

        /**
         * Format time as 00:XX
         * @param {number} seconds - Seconds to format
         * @returns {string} Formatted time
         */
        formatTime(seconds) {
            const secs = Math.max(0, Math.floor(seconds));
            return `00:${secs.toString().padStart(2, '0')}`;
        }

        /**
         * Update the timer display
         * @param {number} timeRemaining - Seconds remaining
         */
        updateTimer(timeRemaining) {
            if (!this.container) return;

            const timerEl = this.container.querySelector('.quiz-timer');
            if (timerEl) {
                timerEl.textContent = this.formatTime(timeRemaining);
                if (timeRemaining <= 5) {
                    timerEl.classList.add('warning');
                }
            }
        }

        /**
         * Subscribe to answer count updates
         * @param {Function} callback - Callback receiving count
         */
        listenForAnswers(callback) {
            this.answerCountCallback = callback;
        }

        /**
         * Unsubscribe from answer updates
         */
        stopListening() {
            this.answerCountCallback = null;
        }

        /**
         * Update answer count display
         * @param {number} count - Current answer count
         */
        updateAnswerCount(count) {
            if (this.answerCountCallback) {
                this.answerCountCallback(count);
            }
        }

        /**
         * Show the correct answer with glow effect
         * @param {number} correctIndex - Index of correct answer
         */
        revealAnswer(correctIndex) {
            if (!this.container) return;

            // Disable all options
            const options = this.container.querySelectorAll('.quiz-option');
            options.forEach(option => {
                option.classList.add('disabled');
            });

            // Highlight correct answer
            const correctOption = this.container.querySelector(`[data-index="${correctIndex}"]`);
            if (correctOption) {
                correctOption.classList.remove('disabled');
                correctOption.classList.add('correct');
            }
        }

        /**
         * Show result overlay
         * @param {Object} result - Result data
         */
        showResult(result) {
            const overlay = document.createElement('div');
            overlay.className = 'quiz-result-overlay';

            const pointsClass = result.isCorrect ? 'correct' : 'incorrect';
            const label = result.isCorrect ? 'Correct!' : 'Wrong!';

            overlay.innerHTML = `
                <div class="quiz-result-label">${label}</div>
                <div class="quiz-result-points ${pointsClass}">+${result.points}</div>
                ${result.isCorrect ? '' : `<div class="quiz-result-label">The answer was ${['A', 'B', 'C', 'D'][result.correctIndex]}</div>`}
            `;

            document.body.appendChild(overlay);

            // Auto-remove after delay
            setTimeout(() => {
                overlay.remove();
            }, 2000);
        }

        /**
         * Show waiting state
         * @param {Function} callback - Callback when ready
         */
        showWaiting(callback) {
            if (!this.container) return;

            let count = 3;
            this.container.innerHTML = `
                <div class="quiz-display">
                    <div class="quiz-timer">${count}</div>
                    <div class="quiz-question">Get Ready!</div>
                </div>
            `;

            const interval = setInterval(() => {
                count--;
                const timerEl = this.container.querySelector('.quiz-timer');
                if (timerEl) {
                    timerEl.textContent = count;
                }
                if (count <= 0) {
                    clearInterval(interval);
                    if (callback) callback();
                }
            }, 1000);
        }

        /**
         * Show final score
         * @param {number} score - Total score
         * @param {number} answered - Questions answered
         * @param {number} total - Total questions
         */
        showFinalScore(score, answered, total) {
            if (!this.container) return;

            this.container.innerHTML = `
                <div class="quiz-display">
                    <div class="quiz-header">
                        <div class="quiz-progress">Quiz Complete!</div>
                    </div>
                    <div class="quiz-result-points">${score}</div>
                    <div class="quiz-result-label">Total Points</div>
                    <div class="quiz-question" style="margin-top: 30px;">
                        ${answered} of ${total} questions answered
                    </div>
                </div>
            `;
        }

        /**
         * Escape HTML to prevent XSS
         * @private
         */
        _escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // ==========================================================================
    // QuizUser Class - Mobile User Display
    // ==========================================================================

    class QuizUser {
        constructor() {
            this.container = null;
            this.onAnswerSelect = null;
        }

        /**
         * Initialize the user display
         * @param {HTMLElement|string} container - Container element or selector
         */
        init(container) {
            if (typeof container === 'string') {
                this.container = document.querySelector(container);
            } else {
                this.container = container;
            }

            if (!this.container) {
                console.error('QuizUser: Container not found');
                return;
            }

            this._injectStyles();
        }

        /**
         * Inject required CSS styles
         * @private
         */
        _injectStyles() {
            if (document.getElementById('quiz-user-styles')) {
                return;
            }

            const styles = document.createElement('style');
            styles.id = 'quiz-user-styles';
            styles.textContent = `
                .quiz-user {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    text-align: center;
                    padding: 20px;
                    min-height: 100vh;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: white;
                }

                .quiz-user-header {
                    margin-bottom: 30px;
                }

                .quiz-user-question {
                    font-size: 22px;
                    font-weight: 500;
                    margin: 20px 0 40px;
                    line-height: 1.4;
                    padding: 0 10px;
                }

                .quiz-user-options {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    padding: 0 15px;
                }

                .quiz-user-option {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    padding: 20px;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 18px;
                    font-weight: 600;
                    color: rgba(0, 0, 0, 0.8);
                    border: none;
                    width: 100%;
                }

                .quiz-user-option:active {
                    transform: scale(0.98);
                }

                .quiz-user-option.selected {
                    opacity: 0.7;
                    pointer-events: none;
                }

                .quiz-user-option.correct {
                    box-shadow: 0 0 25px rgba(255, 255, 255, 0.7);
                }

                .quiz-user-option.incorrect {
                    opacity: 0.5;
                }

                .quiz-user-option-a {
                    background: #FF2D2D;
                }

                .quiz-user-option-b {
                    background: #2D6AFF;
                }

                .quiz-user-option-c {
                    background: #B5FF4D;
                }

                .quiz-user-option-d {
                    background: #FFE500;
                }

                .quiz-user-option-icon {
                    font-size: 24px;
                    font-weight: bold;
                }

                .quiz-user-option-a .quiz-user-option-icon,
                .quiz-user-option-b .quiz-user-option-icon {
                    color: white;
                }

                .quiz-user-option-c .quiz-user-option-icon,
                .quiz-user-option-d .quiz-user-option-icon {
                    color: rgba(0, 0, 0, 0.8);
                }

                .quiz-user-timer {
                    font-size: 36px;
                    font-weight: bold;
                    color: #FFE500;
                    margin-bottom: 20px;
                }

                .quiz-user-timer.warning {
                    color: #FF2D2D;
                    animation: pulse 0.5s infinite;
                }

                .quiz-user-waiting {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 80vh;
                }

                .quiz-user-countdown {
                    font-size: 120px;
                    font-weight: bold;
                    color: #FFE500;
                    animation: countPulse 1s ease-in-out;
                }

                @keyframes countPulse {
                    0% { transform: scale(1.2); opacity: 0; }
                    50% { transform: scale(1); opacity: 1; }
                    100% { transform: scale(0.8); opacity: 0.5; }
                }

                .quiz-user-result {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 80vh;
                }

                .quiz-user-result-points {
                    font-size: 64px;
                    font-weight: bold;
                    margin: 20px 0;
                }

                .quiz-user-result-points.correct {
                    color: #B5FF4D;
                }

                .quiz-user-result-points.incorrect {
                    color: #FF2D2D;
                }

                .quiz-user-result-points.timeup {
                    color: #FFE500;
                }

                .quiz-user-result-label {
                    font-size: 20px;
                    color: rgba(255, 255, 255, 0.8);
                    margin-bottom: 10px;
                }

                .quiz-user-correct-answer {
                    margin-top: 20px;
                    padding: 15px 25px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                }
            `;
            document.head.appendChild(styles);
        }

        /**
         * Show waiting countdown (3-2-1)
         * @returns {Promise} Resolves when countdown complete
         */
        showWaiting() {
            return new Promise((resolve) => {
                if (!this.container) {
                    resolve();
                    return;
                }

                let count = 3;
                this.container.innerHTML = `
                    <div class="quiz-user">
                        <div class="quiz-user-waiting">
                            <div class="quiz-user-countdown" id="countdown">${count}</div>
                            <div class="quiz-user-result-label">Get Ready!</div>
                        </div>
                    </div>
                `;

                const countdownEl = this.container.querySelector('#countdown');

                const interval = setInterval(() => {
                    count--;
                    if (countdownEl) {
                        if (count > 0) {
                            countdownEl.textContent = count;
                            // Re-trigger animation
                            countdownEl.style.animation = 'none';
                            countdownEl.offsetHeight; // Trigger reflow
                            countdownEl.style.animation = 'countPulse 1s ease-in-out';
                        } else {
                            countdownEl.textContent = '!';
                        }
                    }
                    if (count <= 0) {
                        clearInterval(interval);
                        setTimeout(() => resolve(), 500);
                    }
                }, 1000);
            });
        }

        /**
         * Show question with answer buttons
         * @param {Object} question - Question object
         * @param {number} timeRemaining - Seconds remaining
         * @param {number} totalTime - Total time for question
         */
        showQuestion(question, timeRemaining, totalTime) {
            if (!this.container) return;

            const timerClass = timeRemaining <= 5 ? 'quiz-user-timer warning' : 'quiz-user-timer';
            const letters = ['A', 'B', 'C', 'D'];
            const icons = ['&#9650;', '&#9670;', '&#9675;', '&#9632;'];
            const classes = ['quiz-user-option-a', 'quiz-user-option-b', 'quiz-user-option-c', 'quiz-user-option-d'];

            const optionsHtml = question.options.map((option, i) => `
                <button class="quiz-user-option ${classes[i]}" data-index="${i}">
                    <span class="quiz-user-option-icon">${icons[i]}</span>
                    <span class="quiz-user-option-text">${this._escapeHtml(option)}</span>
                </button>
            `).join('');

            this.container.innerHTML = `
                <div class="quiz-user">
                    <div class="quiz-user-header">
                        <div class="${timerClass}" id="quiz-timer">${this.formatTime(timeRemaining)}</div>
                    </div>
                    <div class="quiz-user-question">${this._escapeHtml(question.text)}</div>
                    <div class="quiz-user-options" id="quiz-options">
                        ${optionsHtml}
                    </div>
                </div>
            `;

            // Attach click listeners
            const options = this.container.querySelectorAll('.quiz-user-option');
            options.forEach(option => {
                option.addEventListener('click', (e) => {
                    const index = parseInt(e.currentTarget.dataset.index);
                    e.currentTarget.classList.add('selected');
                    if (this.onAnswerSelect) {
                        this.onAnswerSelect(index);
                    }
                });
            });
        }

        /**
         * Update the timer display
         * @param {number} timeRemaining - Seconds remaining
         */
        updateTimer(timeRemaining) {
            if (!this.container) return;

            const timerEl = this.container.querySelector('.quiz-user-timer');
            if (timerEl) {
                timerEl.textContent = this.formatTime(timeRemaining);
                if (timeRemaining <= 5) {
                    timerEl.classList.add('warning');
                }
            }
        }

        /**
         * Show result after answering
         * @param {boolean} isCorrect - Whether answer was correct
         * @param {number} pointsEarned - Points earned
         * @param {number} correctIndex - Index of correct answer
         * @param {string[]} options - Array of option texts
         */
        showResult(isCorrect, pointsEarned, correctIndex, options) {
            if (!this.container) return;

            const pointsClass = isCorrect ? 'correct' : 'incorrect';
            const label = isCorrect ? 'Correct!' : 'Wrong!';
            const letters = ['A', 'B', 'C', 'D'];

            // Highlight correct/incorrect options
            const optionsHtml = options.map((option, i) => {
                let extraClass = '';
                if (i === correctIndex) {
                    extraClass = 'correct';
                } else if (i !== correctIndex && !isCorrect) {
                    extraClass = 'incorrect';
                }
                return `
                    <button class="quiz-user-option quiz-user-option-${['a', 'b', 'c', 'd'][i]} ${extraClass}" disabled>
                        <span class="quiz-user-option-icon">${['&#9650;', '&#9670;', '&#9675;', '&#9632;'][i]}</span>
                        <span class="quiz-user-option-text">${this._escapeHtml(option)}</span>
                    </button>
                `;
            }).join('');

            this.container.innerHTML = `
                <div class="quiz-user">
                    <div class="quiz-user-result">
                        <div class="quiz-user-result-label">${label}</div>
                        <div class="quiz-user-result-points ${pointsClass}">+${pointsEarned}</div>
                        <div class="quiz-user-options">
                            ${optionsHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Show time's up message
         * @param {number} correctIndex - Index of correct answer
         * @param {string[]} options - Array of option texts
         */
        showTimeUp(correctIndex, options) {
            if (!this.container) return;

            const letters = ['A', 'B', 'C', 'D'];

            const optionsHtml = options.map((option, i) => {
                let extraClass = '';
                if (i === correctIndex) {
                    extraClass = 'correct';
                }
                return `
                    <button class="quiz-user-option quiz-user-option-${['a', 'b', 'c', 'd'][i]} ${extraClass}" disabled>
                        <span class="quiz-user-option-icon">${['&#9650;', '&#9670;', '&#9675;', '&#9632;'][i]}</span>
                        <span class="quiz-user-option-text">${this._escapeHtml(option)}</span>
                    </button>
                `;
            }).join('');

            this.container.innerHTML = `
                <div class="quiz-user">
                    <div class="quiz-user-result">
                        <div class="quiz-user-result-label">Time's Up!</div>
                        <div class="quiz-user-result-points timeup">+0</div>
                        <div class="quiz-user-options">
                            ${optionsHtml}
                        </div>
                    </div>
                </div>
            `;
        }

        /**
         * Format time as 00:XX
         * @param {number} seconds - Seconds to format
         * @returns {string} Formatted time
         */
        formatTime(seconds) {
            const secs = Math.max(0, Math.floor(seconds));
            return `00:${secs.toString().padStart(2, '0')}`;
        }

        /**
         * Escape HTML to prevent XSS
         * @private
         */
        _escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    }

    // ==========================================================================
    // Export to window
    // ==========================================================================

    window.QuizManager = QuizManager;
    window.QuizDisplay = QuizDisplay;
    window.QuizUser = QuizUser;

})(window);
