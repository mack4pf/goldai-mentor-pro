const cron = require('node-cron');
const openaiService = require('./openaiService');
const databaseService = require('./databaseService');

class CronService {
    constructor() {
        this.isJobRunning = false;
    }

    start() {
        console.log('🕰️ Cron Service Started: Scheduling auto-signal generation...');

        // Schedule task to run every 15 minutes
        // Runs at minute 0, 15, 30, 45
        cron.schedule('0,15,30,45 * * * *', async () => {
            await this.generateAllSignals();
        });

        // Run once immediately on startup to allow testing
        console.log('🚀 Triggering initial signal generation...');
        this.generateAllSignals();
    }

    async generateAllSignals() {
        if (this.isJobRunning) {
            console.log('⚠️ Signal generation already in progress. Skipping...');
            return;
        }

        this.isJobRunning = true;
        console.log('🔄 Starting Scheduled Signal Generation...');

        const configs = [
            { timeframe: '5m', balanceCategory: '10_50' },
            { timeframe: '5m', balanceCategory: '200_500' },
            { timeframe: '15m', balanceCategory: '10_50' },
            { timeframe: '15m', balanceCategory: '200_500' }
        ];

        for (const config of configs) {
            try {
                console.log(`   🔨 Generating ${config.timeframe} signal for ${config.balanceCategory}...`);

                // Generate Signal
                const signal = await openaiService.generateTradingSignal(
                    config.timeframe,
                    { balance: 1000 }, // Mock user context for consistent analysis
                    config.balanceCategory
                );

                // Enhance with metadata
                const signalDoc = {
                    ...signal,
                    timeframe: config.timeframe,
                    balanceCategory: config.balanceCategory,
                    source: 'CRON_AUTO',
                    createdAt: new Date().toISOString(),
                    timestamp: new Date().toISOString()
                };

                // Save to Database
                await databaseService.createSignal(signalDoc);
                console.log(`   ✅ Saved ${config.timeframe}/${config.balanceCategory} signal to DB.`);

                // Wait 5s between calls to be nice to APIs
                await new Promise(r => setTimeout(r, 5000));

            } catch (error) {
                console.error(`   ❌ Failed to generate ${config.timeframe}/${config.balanceCategory}:`, error.message);
            }
        }

        this.isJobRunning = false;
        console.log('🏁 Scheduled Generation Complete.');
    }
}

module.exports = new CronService();
