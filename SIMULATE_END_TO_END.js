const axios = require('axios');

// Test Configuration
const BRIDGE_URL = 'http://localhost:3001/api/v1'; // Assuming local dev port 3001 based on server.js
// If local fails, we can try the production one if needed, but local is better for testing changes.

async function testSignalRelay() {
    console.log('🧪 Starting End-to-End Signal Relay Test...');

    // 1. Mock Signal Data (Professional Grade A+)
    const mockSignal = {
        symbol: 'XAUUSD',
        type: 'BUY',
        entry: 2655.50,
        sl: 2645.00,
        tp: 2675.00,
        timeframe: 'H1',
        confidence: 85,
        grade: 'A+',
        timestamp: new Date().toISOString(),
        source: 'TEST_SIMULATOR'
    };

    console.log(`📡 Step 1: Pushing mock signal to Bridge at ${BRIDGE_URL}/signals...`);

    try {
        const pushResponse = await axios.post(`${BRIDGE_URL}/signals`, mockSignal);

        if (pushResponse.status === 200 && pushResponse.data.success) {
            console.log('✅ Signal pushed successfully!');
            console.log(`   Signal ID: ${pushResponse.data.signalId}`);

            // 2. Verify Watchlist (What the EA sees)
            console.log('\n📡 Step 2: Verifying signal is in MASTER_VPS watchlist...');
            const watchlistResponse = await axios.get(`${BRIDGE_URL}/watchlist`);

            if (watchlistResponse.status === 200 && watchlistResponse.data.success) {
                const watchlist = watchlistResponse.data.watchlist;
                const found = watchlist.find(item => item.signalId === pushResponse.data.signalId);

                if (found) {
                    console.log('✅ Success! Signal found in Watchlist.');
                    console.log(`   Watchlist Entry Status: ${found.status}`);
                    console.log('🚀 END-TO-END FLOW VERIFIED: Mentor -> Bridge -> Watchlist (EA)');
                } else {
                    console.error('❌ Error: Signal NOT found in Watchlist.');
                }
            } else {
                console.error('❌ Error: Failed to fetch Watchlist.');
            }
        } else {
            console.error('❌ Error: Failed to push signal.');
        }
    } catch (error) {
        console.error('❌ Connection Error:', error.message);
        console.log('💡 TIP: Make sure the Bridge server is running locally on port 3001.');
    }
}

testSignalRelay();
