const express = require('express');
const router = express.Router();
const tradingService = require('../services/tradingService');
// const signalBroadcaster = require('../services/autoTrading/signalBroadcaster'); // Will be implemented next

// Middleware to validate EA Token
const requireEAToken = async (req, res, next) => {
    const token = req.headers['x-ea-token'] || req.body.token;

    if (!token) {
        return res.status(401).json({ error: 'Missing EA Token' });
    }

    try {
        const userConfig = await tradingService.validateEAToken(token);
        if (!userConfig) {
            return res.status(403).json({ error: 'Invalid Token' });
        }
        req.userConfig = userConfig; // Attach config to request
        next();
    } catch (error) {
        console.error('EA Auth Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// POST /api/ea/auth
// EA sends Token, Server returns Settings (Lot Size, Risk Mode, etc.)
router.post('/auth', requireEAToken, async (req, res) => {
    try {
        const config = req.userConfig;

        res.json({
            status: 'authorized',
            settings: {
                mode: config.mode, // 'consistent' or 'aggressive'
                lotSize: config.lotSize,
                maxDailyLoss: config.maxDailyLoss,
                maxDailyWin: config.maxDailyWin,
                autoSecureProfit: config.autoSecureProfit,
                pyramiding: config.pyramiding
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ea/signals
// EA polls this to check for new signals
router.get('/signals', requireEAToken, async (req, res) => {
    // TODO: Implement Signal Broadcaster logic to fetch pending signals for this user
    // const signal = await signalBroadcaster.getPendingSignal(req.userConfig.userId);

    res.json({
        hasSignal: false, // Placeholder
        signal: null
    });
});

// POST /api/ea/report
// EA reports trade results or daily stats
router.post('/report', requireEAToken, async (req, res) => {
    // TODO: Update user's daily profit/loss stats in Firestore
    res.json({ status: 'received' });
});

module.exports = router;
