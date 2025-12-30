const express = require('express');
const router = express.Router();
const databaseService = require('../services/databaseService');

const openaiService = require('../services/openaiService');

/**
 * API endpoint for Bridge to request signals
 * POST /api/signal/generate
 */
router.post('/generate', async (req, res) => {
    try {
        const { timeframe, balanceCategory } = req.body;

        // Validate API key (simple auth)
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== process.env.BRIDGE_API_KEY && apiKey !== 'development') {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        if (!timeframe || !balanceCategory) {
            return res.status(400).json({
                error: 'Missing required fields: timeframe and balanceCategory'
            });
        }

        console.log(`📡 Bridge API requesting signal: ${timeframe} ${balanceCategory}`);

        // 1️⃣ CACHE STRATEGY: Try to fetch latest signal from DB
        try {
            const cachedSignal = await databaseService.getLatestSignal(timeframe, balanceCategory);

            if (cachedSignal) {
                const signalTime = new Date(cachedSignal.createdAt).getTime();
                const ageMinutes = (Date.now() - signalTime) / (1000 * 60);

                // If signal is fresh (< 20 mins), serve it instantly!
                if (ageMinutes < 20) {
                    console.log(`🚀 Serving CACHED signal (Age: ${ageMinutes.toFixed(1)}m)`);
                    return res.json(cachedSignal);
                } else {
                    console.log(`⚠️ Cached signal is stale (${ageMinutes.toFixed(1)}m old). Regenerating...`);
                }
            }
        } catch (dbError) {
            console.error('Cache lookup failed:', dbError.message);
            // Continue to fallback generation...
        }

        // 2️⃣ FALLBACK: Generate real-time (Slow)
        // Only happens if Cron is dead or cache is empty
        console.log('🔄 Generating fresh signal (Fallback mode)...');

        const signal = await openaiService.generateTradingSignal(
            timeframe,
            null, // userContext
            balanceCategory
        );

        // Return signal data
        res.json(signal);

        console.log(`✅ Signal generated & sent: ${signal.signal} (${signal.confidence}%)`);

    } catch (error) {
        console.error('Signal API error:', error.message);
        res.status(500).json({
            error: 'Failed to generate signal',
            message: error.message
        });
    }
});

module.exports = router;
