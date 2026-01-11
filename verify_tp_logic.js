
const openaiService = require('./src/services/openaiService');

async function testTPCalculation() {
    console.log("🚀 Testing Four-Target TP, forced SL, and Market Watch Logic...");

    // Scenario 1: BUY Signal with VALID SL (20 pips) - Should PERSIST
    const mockAnalysisBuyValid = `
SIGNAL: BUY
ENTRY: 2600.00
STOP LOSS: 2598.00
TAKE PROFIT 1: 2603.00
TAKE PROFIT 2: 2605.00
TAKE PROFIT 3: 2610.00
TAKE PROFIT 4: 2615.00
MARKET WATCH: Wait for M15 candle rejection.
`;

    // Scenario 2: SELL Signal with INVALID SL (80 pips) - Should be OVERRIDDEN to 40 pips
    const mockAnalysisSellInvalid = `
SIGNAL: SELL
ENTRY: 2600.00
STOP LOSS: 2608.00
TAKE PROFIT 1: 2597.00
TAKE PROFIT 2: 2595.00
TAKE PROFIT 3: 2590.00
TAKE PROFIT 4: 2585.00
MARKET WATCH: Watch for Hammer on H1.
`;

    const marketData = { goldPrice: { price: 2600 } };
    const userContext = { balance: 1000, riskTier: 'standard' };

    console.log("\n--- Scenario 1: BUY (Valid 20 pip SL) ---");
    const result1 = openaiService.parseProfessionalSignal(mockAnalysisBuyValid, marketData, '1h', userContext);
    console.log("SL: ", result1.stopLoss, "(Expected 2598 - Persisted)");
    console.log("TP1:", result1.takeProfit1, "(Expected 2603 - Forced)");
    console.log("TP2:", result1.takeProfit2, "(Expected 2605 - Forced)");
    console.log("TP3:", result1.takeProfit3, "(Expected 2610 - Forced)");
    console.log("TP4:", result1.takeProfit4, "(Expected 2615 - Forced)");

    console.log("\n--- Scenario 2: SELL (Invalid 80 pip SL) ---");
    const result2 = openaiService.parseProfessionalSignal(mockAnalysisSellInvalid, marketData, '1h', userContext);
    console.log("SL: ", result2.stopLoss, "(Expected 2604 - Overridden to 40 pips)");
    console.log("TP1:", result2.takeProfit1, "(Expected 2597 - Forced)");
    console.log("TP2:", result2.takeProfit2, "(Expected 2595 - Forced)");
    console.log("TP3:", result2.takeProfit3, "(Expected 2590 - Forced)");
    console.log("TP4:", result2.takeProfit4, "(Expected 2585 - Forced)");

    const success1 = result1.stopLoss === 2598 && result1.takeProfit1 === 2603 && result1.takeProfit2 === 2605 && result1.takeProfit3 === 2610 && result1.takeProfit4 === 2615;
    const success2 = result2.stopLoss === 2604 && result2.takeProfit1 === 2597 && result2.takeProfit2 === 2595 && result2.takeProfit3 === 2590 && result2.takeProfit4 === 2585;

    if (success1 && success2) {
        console.log("\n✅ ALL CALCULATIONS CORRECT!");
    } else {
        console.error("\n❌ CALCULATION ERROR DETECTED!");
        process.exit(1);
    }
}

testTPCalculation();
