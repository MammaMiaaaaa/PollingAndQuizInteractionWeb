/**
 * User Management Module for AnxietyTalk
 *
 * Handles device ID management, user join flow, point management,
 * and session interactions.
 */

(function() {
  'use strict';

  // ============================================================================
  // Device ID Management
  // ============================================================================

  /**
   * Generate a UUID v4
   * @returns {string} UUID v4 string
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Get device ID from localStorage or generate and store a new one
   * @returns {string} Device ID (UUID v4)
   */
  function getDeviceId() {
    let deviceId = localStorage.getItem('anxietyTalk_deviceId');

    if (!deviceId) {
      deviceId = generateUUID();
      localStorage.setItem('anxietyTalk_deviceId', deviceId);
    }

    return deviceId;
  }

  // ============================================================================
  // User Join Flow
  // ============================================================================

  /**
   * Check if a name is unique among active users
   * @param {string} name - Name to check
   * @returns {Promise<boolean>} True if name is unique
   */
  async function isNameUnique(name) {
    const normalizedName = name.trim().toLowerCase();

    const snapshot = await usersRef
      .where('name', '==', normalizedName)
      .limit(1)
      .get();

    return snapshot.empty;
  }

  /**
   * Make a name unique by appending a number if needed
   * @param {string} baseName - Base name to make unique
   * @returns {Promise<string>} Unique name
   */
  async function makeNameUnique(baseName) {
    let name = baseName.trim();
    let counter = 1;
    let isUnique = false;
    let finalName = name;

    while (!isUnique) {
      isUnique = await isNameUnique(finalName);

      if (!isUnique) {
        counter++;
        finalName = `${name} ${counter}`;
      }
    }

    return finalName;
  }

  /**
   * Check if device already has an associated user
   * @param {string} deviceId - Device ID
   * @returns {Promise<Object|null>} User document if exists, null otherwise
   */
  async function getUserByDeviceId(deviceId) {
    const snapshot = await usersRef
      .where('deviceId', '==', deviceId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }

    return null;
  }

  /**
   * Join the session with a display name
   * @param {string} name - Display name for the user
   * @returns {Promise<{userId: string, name: string, isNewUser: boolean}>}
   */
  async function joinSession(name) {
    const deviceId = getDeviceId();

    // Check if device already has a user
    const existingUser = await getUserByDeviceId(deviceId);

    if (existingUser) {
      // Restore existing user
      localStorage.setItem('anxietyTalk_userId', existingUser.id);

      return {
        userId: existingUser.id,
        name: existingUser.name,
        isNewUser: false
      };
    }

    // Ensure name is unique
    const uniqueName = await makeNameUnique(name);

    // Create new user document
    const userDoc = {
      name: uniqueName,
      deviceId: deviceId,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastActive: firebase.firestore.FieldValue.serverTimestamp(),
      points: {
        quiz: 0,
        polling: 0,
        reaction: 0,
        total: 0
      },
      answers: {
        polling: [],
        quiz: []
      }
    };

    const docRef = await usersRef.add(userDoc);
    localStorage.setItem('anxietyTalk_userId', docRef.id);

    return {
      userId: docRef.id,
      name: uniqueName,
      isNewUser: true
    };
  }

  /**
   * Get the current user from Firestore
   * @returns {Promise<Object|null>} User document or null if not found
   */
  async function getCurrentUser() {
    const userId = localStorage.getItem('anxietyTalk_userId');

    if (!userId) {
      return null;
    }

    try {
      const doc = await usersRef.doc(userId).get();

      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }

      return null;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }

  // ============================================================================
  // Point Management
  // ============================================================================

  /**
   * Update user's points
   * @param {string} userId - User document ID
   * @param {string} source - Source of points ('quiz', 'polling', 'reaction')
   * @param {number} points - Points to add (can be negative)
   */
  async function updateUserPoints(userId, source, points) {
    if (!['quiz', 'polling', 'reaction'].includes(source)) {
      console.error('Invalid point source:', source);
      return;
    }

    const userRef = usersRef.doc(userId);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User document does not exist');
      }

      const userData = userDoc.data();
      const currentSourcePoints = userData.points[source] || 0;
      const currentTotal = userData.points.total || 0;

      const newSourcePoints = currentSourcePoints + points;
      const newTotal = currentTotal + points;

      transaction.update(userRef, {
        [`points.${source}`]: newSourcePoints,
        'points.total': newTotal,
        lastActive: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
  }

  /**
   * Add a polling answer for a user
   * @param {string} userId - User document ID
   * @param {string} questionId - Question/Answer document ID
   * @param {string} text - Answer text
   * @returns {Promise<Object>} Created polling answer document
   */
  async function addPollingAnswer(userId, questionId, text) {
    // Add to pollingAnswers collection
    const answerDoc = {
      userId: userId,
      questionId: questionId,
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await pollingAnswersRef.add(answerDoc);

    // Update user points (+50 for polling)
    await updateUserPoints(userId, 'polling', 50);

    // Track in user's answers array
    await usersRef.doc(userId).update({
      'answers.polling': firebase.firestore.FieldValue.arrayUnion(questionId),
      lastActive: firebase.firestore.FieldValue.serverTimestamp()
    });

    return { id: docRef.id, ...answerDoc };
  }

  /**
   * Get the count of polling answers for a user
   * @param {string} userId - User document ID
   * @returns {Promise<number>} Count of polling answers
   */
  async function getUserPollAnswersCount(userId) {
    const snapshot = await pollingAnswersRef
      .where('userId', '==', userId)
      .get();

    return snapshot.size;
  }

  // ============================================================================
  // Session Settings & Status
  // ============================================================================

  /**
   * Get session settings
   * @returns {Promise<Object|null>} Session settings or null if not found
   */
  async function getSessionSettings() {
    try {
      const doc = await sessionRef.get();

      if (doc.exists) {
        return doc.data();
      }

      return null;
    } catch (error) {
      console.error('Error fetching session settings:', error);
      return null;
    }
  }

  /**
   * Get current session status
   * @returns {Promise<{isActive: boolean, status: string}|null>}
   */
  async function getSessionStatus() {
    try {
      const doc = await sessionRef.get();

      if (doc.exists) {
        const data = doc.data();
        return {
          isActive: data.isActive || false,
          status: data.status || 'unknown'
        };
      }

      return { isActive: false, status: 'no_session' };
    } catch (error) {
      console.error('Error fetching session status:', error);
      return null;
    }
  }

  // ============================================================================
  // Initialize Module
  // ============================================================================

  // Expose to window
  window.User = {
    // Device ID
    generateUUID: generateUUID,
    getDeviceId: getDeviceId,

    // User Join
    joinSession: joinSession,
    getCurrentUser: getCurrentUser,

    // Point Management
    updateUserPoints: updateUserPoints,
    addPollingAnswer: addPollingAnswer,
    getUserPollAnswersCount: getUserPollAnswersCount,

    // Session
    getSessionSettings: getSessionSettings,
    getSessionStatus: getSessionStatus
  };

})();
