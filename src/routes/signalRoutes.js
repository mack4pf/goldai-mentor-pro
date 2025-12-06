const express = require('express');
const router = express.Router();
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

        // Generate signal using existing OpenAI service
        const signal = await openaiService.generateTradingSignal(
            timeframe,
            null, // userContext
            balanceCategory
        );

        // Return signal data
        res.json(signal);

        console.log(`✅ Signal sent to Bridge: ${signal.signal} (${signal.confidence}%)`);

    } catch (error) {
        console.error('Signal API error:', error.message);
        res.status(500).json({
            error: 'Failed to generate signal',
            message: error.message
        });
    }
});

module.exports = router;
