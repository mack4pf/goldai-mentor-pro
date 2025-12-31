require('dotenv').config();
const openaiService = require('./src/services/openaiService');

async function testMasterSignal() {
    console.log("🚀 Testing Master Hourly Signal (MTF)...");
    try {
        const signal = await openaiService.generateMasterHourlySignal(['W1', 'D1', 'H4', 'H1', 'M15']);

        console.log("\n✅ Master Signal Result:");
        console.log("------------------------------------------");
        console.log("Signal:", signal.signal);
        console.log("Grade:", signal.strategyGrade);
        console.log("Confidence:", signal.confidence + "%");
        console.log("Timeframe:", signal.timeframe);
        console.log("Entry:", signal.entry);
        console.log("SL:", signal.stopLoss);
        console.log("TP1:", signal.takeProfit1);
        console.log("------------------------------------------");
        console.log("Rationale:", signal.technicalAnalysis);
        console.log("------------------------------------------");
        console.log("Mentor Tip:", signal.professionalRecommendation);
        console.log("------------------------------------------");

    } catch (error) {
        console.error("❌ Test Failed:", error.message);
    }
}

testMasterSignal();
