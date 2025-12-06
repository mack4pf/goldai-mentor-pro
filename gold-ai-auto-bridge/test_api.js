/**
 * API Testing Script
 * Quick tests for the Gold AI Auto-Trading Bridge API
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001/api/v1';
const TEST_USER_ID = 'test_user_123';
const TEST_LICENSE = 'GOLDAI-TEST-2024';

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function test(name, fn) {
    try {
        log(`\n🧪 Testing: ${name}`, 'blue');
        await fn();
        log(`✅ PASSED: ${name}`, 'green');
    } catch (error) {
        log(`❌ FAILED: ${name}`, 'red');
        log(`   Error: ${error.message}`, 'red');
    }
}

async function runTests() {
    log('\n═══════════════════════════════════════', 'yellow');
    log('  Gold AI Auto-Bridge API Tests', 'yellow');
    log('═══════════════════════════════════════', 'yellow');

    // 1. Test Health Check
    await test('Health Check', async () => {
        const response = await axios.get('http://localhost:3001/');
        if (response.data.status !== 'online') throw new Error('Server not online');
        log(`   System: ${response.data.system}`);
        log(`   Version: ${response.data.version}`);
    });

    // 2. Test License Activation (Test License)
    let licenseData;
    await test('Activate Test License', async () => {
        const response = await axios.post(`${API_URL}/license/activate`, {
            userId: TEST_USER_ID,
            licenseKey: TEST_LICENSE
        });

        if (!response.data.success) throw new Error('Activation failed');
        licenseData = response.data;
        log(`   License ID: ${licenseData.licenseId}`);
        log(`   Expires: ${licenseData.expiresAt}`);
        log(`   Days Remaining: ${licenseData.daysRemaining}`);
        log(`   Test License: ${licenseData.isTestLicense}`);
    });

    // 3. Test License Check
    await test('Check License Status', async () => {
        const response = await axios.get(`${API_URL}/license/check`, {
            params: { license: TEST_LICENSE }
        });

        if (!response.data.valid) throw new Error('License not valid');
        log(`   Valid: ${response.data.valid}`);
        log(`   Days Remaining: ${response.data.daysRemaining}`);
    });

    // 4. Test Advanced Signal
    let signalId;
    await test('Send Advanced Signal', async () => {
        const signal = {
            signalId: `TEST_SIGNAL_${Date.now()}`,
            timestamp: new Date().toISOString(),
            timeframe: '1H',
            symbol: 'XAUUSD',
            direction: 'SELL',
            confidence: 85,
            entry: {
                price: 4212,
                zone: { min: 4210, max: 4215 }
            },
            stopLoss: 4225,
            takeProfits: [
                { level: 1, price: 4190, percentage: 50 },
                { level: 2, price: 4170, percentage: 50 }
            ],
            confluence: {
                rsi: {
                    period: 14,
                    currentValue: 68,
                    condition: 'ABOVE_60_TURNING_DOWN',
                    description: 'RSI at 68, showing bearish divergence'
                },
                candlestick: {
                    required: 'SHOOTING_STAR_OR_ENGULFING',
                    description: 'Wait for shooting star'
                },
                wickRejection: {
                    required: true,
                    direction: 'UPPER_WICK',
                    minSize: 15,
                    description: 'Strong rejection expected'
                },
                marketContext: {
                    level: 'SUPPLY_ZONE',
                    levelPrice: 4215,
                    description: 'Major supply zone at 4215',
                    confluenceScore: 85
                }
            },
            riskManagement: {
                recommendedRisk: 6,
                maxRisk: 8,
                slPips: 130,
                tpPips: [220, 420]
            },
            validity: {
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                maxWaitTime: 120
            }
        };

        const response = await axios.post(`${API_URL}/signals/advanced`, signal);

        if (!response.data.success) throw new Error('Signal not accepted');
        signalId = response.data.signalId;
        log(`   Signal ID: ${signalId}`);
        log(`   Quality Score: ${response.data.qualityScore}/100`);
        log(`   Distributed To: ${response.data.addedToWatchlist} users`);
    });

    // 5. Test Get Watchlist
    await test('Get Watchlist', async () => {
        const response = await axios.get(`${API_URL}/watchlist`, {
            headers: { 'x-license-key': TEST_LICENSE }
        });

        log(`   Watchlist Count: ${response.data.count}`);
        if (response.data.count > 0) {
            log(`   Latest Signal: ${response.data.watchlist[0].signalId}`);
        }
    });

    // 6. Test Daily Stats
    await test('Get Daily Stats', async () => {
        const response = await axios.get(`${API_URL}/stats/daily`, {
            headers: { 'x-license-key': TEST_LICENSE }
        });

        log(`   Start Balance: $${response.data.startBalance}`);
        log(`   Current Balance: $${response.data.currentBalance}`);
        log(`   Profit Target: $${response.data.profitTarget}`);
        log(`   Max Loss: $${response.data.maxLoss}`);
        log(`   Can Trade: ${response.data.canTrade}`);
    });

    // 7. Test Update Stats
    await test('Update Daily Stats', async () => {
        const response = await axios.post(`${API_URL}/stats/update`, {
            tradeProfit: 50,
            balance: 1050
        }, {
            headers: { 'x-license-key': TEST_LICENSE }
        });

        log(`   Profit Today: $${response.data.profitToday}`);
        log(`   Trades Executed: ${response.data.tradesExecuted}`);
        log(`   Can Continue: ${response.data.canContinue}`);
    });

    // 8. Test Watchlist Update
    if (signalId) {
        await test('Update Watchlist (Scrap Signal)', async () => {
            const response = await axios.post(`${API_URL}/watchlist/scrap`, {
                signalId: signalId,
                reason: 'NO_WICK_REJECTION'
            }, {
                headers: { 'x-license-key': TEST_LICENSE }
            });

            if (!response.data.success) throw new Error('Watchlist update failed');
            log(`   Signal scrapped successfully`);
        });
    }

    // Summary
    log('\n═══════════════════════════════════════', 'yellow');
    log('  All Tests Complete! ', 'green');
    log('═══════════════════════════════════════', 'yellow');
    log('\n📋 Next Steps:', 'blue');
    log('   1. Test with MT5 EA');
    log('   2. Send real signals from Telegram bot');
    log('   3. Monitor watchlist and execution');
    log('\n');
}

// Run tests
runTests().catch(error => {
    log(`\n💥 Test Suite Failed: ${error.message}`, 'red');
    process.exit(1);
});
