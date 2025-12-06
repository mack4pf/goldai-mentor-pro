// src/services/databaseService.js

// 🚨 CRITICAL: This line initializes Firebase and gets the 'db' connection
// src/services/databaseService.js

// 🚨 CRITICAL: This line initializes Firebase and gets the 'db' connection
const { db } = require('../firebaseConfig');

// Collection names
const USER_COLLECTION = 'users';
const SIGNAL_COLLECTION = 'signals';
const TRADING_CONFIG_COLLECTION = 'trading_configs';

class DatabaseService {
  constructor() {
    console.log('✅ Firestore Database Service Initialized');
    // All local file logic (fs, path, ensureDatabaseExists) is removed!
  }

  // --- USER METHODS (Firestore Implementation) ---

  async findUserById(userId) {
    const doc = await db.collection(USER_COLLECTION).doc(userId).get();
    return doc.exists ? { id: doc.id, ...doc.data() } : null;
  }

  async findUserByTelegramId(telegramId) {
    const snapshot = await db.collection(USER_COLLECTION)
      .where('telegramId', '==', telegramId.toString())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async findUserByPassword(password) {
    const snapshot = await db.collection(USER_COLLECTION)
      .where('password', '==', password)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  async createUser(user) {
    const userRef = db.collection(USER_COLLECTION).doc();
    const newUser = {
      ...user,
      id: userRef.id,
      createdAt: new Date().toISOString(),
    };
    await userRef.set(newUser);
    return newUser;
  }

  async updateUser(userId, data) {
    const userRef = db.collection(USER_COLLECTION).doc(userId);
    await userRef.update(data);
    return true;
  }

  async updateUserTelegramId(userId, telegramId) {
    return this.updateUser(userId, { telegramId, activatedAt: new Date().toISOString() });
  }

  async getAllUsers() {
    const snapshot = await db.collection(USER_COLLECTION).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // --- AUTO-TRADING CONFIG METHODS (Firestore) ---

  async getTradingConfig(userId) {
    // We use the User's Document ID as the key for their config to keep 1:1 relationship easy
    const doc = await db.collection(TRADING_CONFIG_COLLECTION).doc(userId).get();
    return doc.exists ? { userId: doc.id, ...doc.data() } : null;
  }

  async createTradingConfig(userId, configData) {
    const configRef = db.collection(TRADING_CONFIG_COLLECTION).doc(userId);
    const newConfig = {
      ...configData,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    await configRef.set(newConfig);
    return { userId, ...newConfig };
  }

  async createSignal(signal) {
    const signalRef = db.collection(SIGNAL_COLLECTION).doc();
    const newSignal = {
      ...signal,
      createdAt: new Date().toISOString(),
      id: signalRef.id,
    };
    await signalRef.set(newSignal);
    return newSignal;
  }

  async getRecentSignals(limit = 10) {
    const snapshot = await db.collection(SIGNAL_COLLECTION)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // --- STATS/ADMIN METHOD (Simplified for Firestore) ---

  async getDatabaseStats() {
    const [userSnapshot, signalSnapshot] = await Promise.all([
      db.collection(USER_COLLECTION).get(),
      db.collection(SIGNAL_COLLECTION).get()
    ]);

    const users = userSnapshot.docs.map(doc => doc.data());

    const activeUsers = users.filter(user =>
      user.status === 'active' &&
      user.telegramId &&
      (!user.expiresAt || new Date(user.expiresAt) > new Date())
    ).length;

    const today = new Date().toDateString();
    const todaySignals = signalSnapshot.docs.filter(doc => {
      const signalDate = new Date(doc.data().createdAt);
      return signalDate.toDateString() === today;
    }).length;

    return {
      totalUsers: userSnapshot.size,
      activeUsers: activeUsers,
      totalSignals: signalSnapshot.size,
      todaySignals: todaySignals,
      databaseCreated: 'N/A (Firestore)'
    };
  }
}

module.exports = new DatabaseService();