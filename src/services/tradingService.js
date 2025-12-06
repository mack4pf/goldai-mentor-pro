const crypto = require('crypto');
const databaseService = require('./databaseService');

class TradingService {
    constructor() {
        this.DEFAULT_CONFIG = {
            isEnabled: false,
            mode: 'consistent', // 'consistent' or 'aggressive'
            lotSize: 0.01,
            maxDailyLoss: 20, // USD
            maxDailyWin: 50,  // USD (Target)
            autoSecureProfit: true,
            pyramiding: false,
            apiToken: null
        };
    }

    /**
     * Get user's trading config or create a default one if not exists.
     * @param {string} userId 
     */
    async getOrCreateConfig(userId) {
        let config = await databaseService.getTradingConfig(userId);

        if (!config) {
            const token = this.generateToken();
            config = await databaseService.createTradingConfig(userId, {
                ...this.DEFAULT_CONFIG,
                apiToken: token
            });
        }

        return config;
    }

    /**
     * Update user's trading configuration with validation.
     * @param {string} userId 
     * @param {object} updates 
     */
    async updateConfig(userId, updates) {
        // Validation Logic
        if (updates.mode === 'aggressive') {
            // Ensure user acknowledges risk (handled in UI, but good to check here if possible)
            updates.pyramiding = true;
        } else if (updates.mode === 'consistent') {
            updates.pyramiding = false;
        }

        // Safety Checks for Lot Size
        if (updates.lotSize && updates.lotSize > 1.0 && updates.mode !== 'aggressive') {
            throw new Error('Lot size > 1.0 is restricted to Aggressive Mode.');
        }

        return await databaseService.updateTradingConfig(userId, updates);
    }

    /**
     * Generate a secure random token for the EA.
     */
    generateToken() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Regenerate token for a user (in case of compromise).
     * @param {string} userId 
     */
    async regenerateToken(userId) {
        const newToken = this.generateToken();
        await databaseService.updateTradingConfig(userId, { apiToken: newToken });
        return newToken;
    }

    /**
     * Validate EA Token and return the user's config.
     * Used by the EA Authentication Endpoint.
     * @param {string} token 
     */
    async validateEAToken(token) {
        // In a real production app with millions of users, we'd index this field.
        // For now, we might need a way to lookup user by token efficiently.
        // Since Firestore doesn't support easy reverse lookup without index, 
        // we might need to store a separate 'tokens' collection or iterate (slow).

        // OPTIMIZATION: For this MVP, we will assume the EA sends { userId, token } 
        // OR we query the collection where apiToken == token.

        // Let's try the query approach (requires Firestore Index potentially, but works for small scale)
        const snapshot = await require('../firebaseConfig').db.collection('trading_configs')
            .where('apiToken', '==', token)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        return { userId: doc.id, ...doc.data() };
    }
}

module.exports = new TradingService();
