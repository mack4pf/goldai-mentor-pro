
const { OpenAI } = require('openai');
require('dotenv').config();
const openaiService = require('./src/services/openaiService');

async function testSignalGeneration() {
    console.log("🚀 Starting AI Signal Generation Test...");

    try {
        // Mock user context
        const userContext = {
            id: 'test_user',
            balance: 50000,
            riskTier: 'standard'
        };

        // Generate Signal
        const signal = await openaiService.generateTradingSignal('1h', userContext, '1k_plus');

        console.log("\n✅ Test Result:");
        console.log("------------------------------------------");
        console.log("Signal:", signal.signal);
        console.log("Confidence:", signal.confidence + "%");
        console.log("Entry:", signal.entry);
        console.log("Stop Loss:", signal.stopLoss);
        console.log("------------------------------------------");
        console.log("💰 RISK MANAGEMENT (CRITICAL FIX CHECK):");
        console.log("Lots:", signal.positionSizing?.lots);
        console.log("Risk Amount:", signal.positionSizing?.riskAmount);
        console.log("Calculation:", signal.positionSizing?.calculation);
        console.log("------------------------------------------");
        console.log("Context:", signal.marketContext);
        console.log("------------------------------------------");

    } catch (error) {
        console.error("\n❌ Test Failed:", error.message);
    }
}

testSignalGeneration();
