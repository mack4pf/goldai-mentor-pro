
const openaiService = require('./src/services/openaiService');

async function testTPCalculation() {
    console.log("🚀 Testing Two-Step TP and BE Logic...");

    // Mock analysis string with BUY signal
    const mockAnalysisBuy = `
SIGNAL: BUY
CONFIDENCE: 85%
STRATEGY GRADE: A
ENTRY: 2600.00
STOP LOSS: 2590.00
TAKE PROFIT 1: 2610.00
TAKE PROFIT 2: 2620.00
TECHNICAL RATIONALE: Support at 2600.
LEVEL EXPLANATION: Fresh SNR.
MARKET CONTEXT & FUNDAMENTALS: Clear sky.
RISK MANAGEMENT: 1% risk.
PROFESSIONAL RECOMMENDATION: Wait for rejection.
`;

    // Mock analysis string with SELL signal and slight deviation in TP
    const mockAnalysisSell = `
SIGNAL: SELL
CONFIDENCE: 80%
STRATEGY GRADE: A
ENTRY: 2600.00
STOP LOSS: 2610.00
TAKE PROFIT 1: 2592.00 (Slightly off)
TAKE PROFIT 2: 2585.00 (Slightly off)
TECHNICAL RATIONALE: Resistance at 2600.
LEVEL EXPLANATION: Fresh SNR.
MARKET CONTEXT & FUNDAMENTALS: Clear sky.
RISK MANAGEMENT: 1% risk.
PROFESSIONAL RECOMMENDATION: Wait for rejection.
`;

    const marketData = { goldPrice: { price: 2600 } };
    const userContext = { balance: 1000, riskTier: 'standard' };

    console.log("\nTesting BUY Signal (Expected: TP1=2610, TP2=2620, BE in Rec)");
    const resultBuy = openaiService.parseProfessionalSignal(mockAnalysisBuy, marketData, '1h', userContext);
    console.log("TP1:", resultBuy.takeProfit1, "(Expected 2610)");
    console.log("TP2:", resultBuy.takeProfit2, "(Expected 2620)");
    console.log("Recommendation Includes BE:", resultBuy.professionalRecommendation.includes("BE"));

    console.log("\nTesting SELL Signal (Expected: TP1=2590, TP2=2580, BE in Rec)");
    const resultSell = openaiService.parseProfessionalSignal(mockAnalysisSell, marketData, '1h', userContext);
    console.log("TP1:", resultSell.takeProfit1, "(Expected 2590)");
    console.log("TP2:", resultSell.takeProfit2, "(Expected 2580)");
    console.log("Recommendation Includes BE:", resultSell.professionalRecommendation.includes("BE"));

    if (resultBuy.takeProfit1 === 2610 && resultBuy.takeProfit2 === 2620 && resultSell.takeProfit1 === 2590 && resultSell.takeProfit2 === 2580) {
        console.log("\n✅ ALL CALCULATIONS CORRECT!");
    } else {
        console.error("\n❌ CALCULATION ERROR DETECTED!");
    }
}

testTPCalculation();
