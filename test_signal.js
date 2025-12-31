
require('dotenv').config();
const openAIService = require('./src/services/openaiService');

async function testSignal() {
    try {
        console.log("🚀 Starting AI Signal Generation Test...");
        const signal = await openAIService.generateTradingSignal('1h', { balance: 50000, riskTier: 'standard' }, '1k_plus');
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
        console.error("❌ Test Failed:", error.message);
    }
}

testSignal();
