const axios = require('axios');

async function testSystem() {
    console.log('🧪 Starting System Test...');

    const API_URL = 'http://localhost:3001/api/v1';

    // 1. Simulate Sending a Signal
    try {
        console.log('\n1️⃣ Sending Test Signal...');
        const signalResponse = await axios.post(`${API_URL}/signals`, {
            symbol: 'XAUUSD',
            type: 'BUY',
            entry: 2050.00,
            sl: 2045.00,
            tp: 2060.00,
            timeframe: '1h'
        });
        console.log('✅ Signal Sent:', signalResponse.data);
    } catch (error) {
        console.error('❌ Signal Failed:', error.message);
        if (error.response) console.error('   Server says:', error.response.data);
    }

    // 2. Simulate EA Polling (Requires a valid token, which we might not have yet)
    // We'll skip this or mock it if we had a token.
    console.log('\n⚠️ Note: To test EA polling, you need a valid User Token from the Bot.');
    console.log('   Use: curl "http://localhost:3001/api/v1/commands?token=YOUR_TOKEN"');

    console.log('\n🎉 Test Script Complete.');
}

testSystem();
