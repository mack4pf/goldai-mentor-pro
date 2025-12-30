const cron = require('node-cron');
const openaiService = require('./openaiService');
const databaseService = require('./databaseService');

class CronService {
    constructor() {
        this.isJobRunning = false;
        this.bot = null; // Will be injected from server.js
    }

    setBotInstance(botInstance) {
        this.bot = botInstance;
        console.log('📱 Telegram bot instance linked to CronService');
    }

    start() {
        console.log('🕰️ Cron Service Started: Scheduling auto-signal generation...');

        // ✅ Run EVERY 1 HOUR (at minute 0)
        cron.schedule('0 * * * *', async () => {
            await this.generateAllSignals();
        });

        // Run once on startup (delayed 30s)
        console.log('🚀 Triggering initial signal generation in 30 seconds...');
        setTimeout(() => this.generateAllSignals(), 30000);
    }

    async generateAllSignals() {
        if (this.isJobRunning) {
            console.log('⚠️ Signal generation already in progress. Skipping...');
            return;
        }

        this.isJobRunning = true;
        console.log('================================================================================');
        console.log(`⏰ HOURLY SIGNAL GENERATION - ${new Date().toISOString()}`);
        console.log('================================================================================');

        const configs = [
            { timeframe: '5m', balanceCategory: '10_50', tier: '$50' },
            { timeframe: '5m', balanceCategory: '200_500', tier: '$200' },
            { timeframe: '15m', balanceCategory: '10_50', tier: '$50' },
            { timeframe: '15m', balanceCategory: '200_500', tier: '$200' }
        ];

        const results = [];

        for (const config of configs) {
            try {
                console.log(`   🔨 Generating ${config.timeframe} signal for ${config.tier} tier...`);

                const signal = await openaiService.generateTradingSignal(
                    config.timeframe,
                    { balance: config.tier === '$50' ? 50 : 200 },
                    config.balanceCategory
                );

                const confidence = signal.confidence || 0;

                // ✅ CONFIDENCE FILTERING
                if (confidence >= 70) {
                    // HIGH CONFIDENCE: Save to DB and broadcast
                    const signalDoc = {
                        ...signal,
                        timeframe: config.timeframe,
                        balanceCategory: config.balanceCategory,
                        source: 'CRON_AUTO',
                        createdAt: new Date().toISOString(),
                        timestamp: new Date().toISOString()
                    };

                    await databaseService.createSignal(signalDoc);
                    console.log(`   ✅ STRONG SIGNAL (${confidence}%): Saved to DB & Broadcasting`);

                    results.push({
                        config,
                        signal: signal.signal,
                        confidence,
                        status: 'BROADCAST'
                    });

                    await this.broadcastToTelegram(signal, config);

                } else {
                    // LOW CONFIDENCE: Just notify users, don't save to DB
                    console.log(`   ⚠️ WEAK SIGNAL (${confidence}%): Not saved. Notifying only.`);

                    results.push({
                        config,
                        signal: signal.signal,
                        confidence,
                        status: 'WEAK_HOLD'
                    });

                    await this.notifyNoTrade(signal, config);
                }

                // Wait 3s between calls
                await new Promise(r => setTimeout(r, 3000));

            } catch (error) {
                console.error(`   ❌ Failed ${config.timeframe}/${config.tier}:`, error.message);
                results.push({ config, status: 'ERROR', error: error.message });
            }
        }

        this.isJobRunning = false;
        console.log('🏁 Hourly Generation Complete.');
        console.log(`📊 Summary: ${results.filter(r => r.status === 'BROADCAST').length} tradeable, ${results.filter(r => r.status === 'WEAK_HOLD').length} weak`);
        console.log('================================================================================');
    }

    async broadcastToTelegram(signal, config) {
        if (!this.bot) return;

        try {
            const users = await databaseService.getAllUsers();
            const activeUsers = users.filter(u => u.status === 'active' && u.telegramId);

            const message = `🔥 <b>NEW ${signal.signal} SETUP</b>\n\n` +
                `⏰ Timeframe: ${config.timeframe.toUpperCase()}\n` +
                `💰 Tier: ${config.tier}\n` +
                `📊 Confidence: ${signal.confidence}%\n` +
                `📍 Entry: $${signal.entry}\n` +
                `🛑 SL: $${signal.stopLoss}\n` +
                `🎯 TP1: $${signal.takeProfit1}\n\n` +
                `✅ This signal has been sent to your trading system!`;

            for (const user of activeUsers) {
                try {
                    await this.bot.sendMessage(user.telegramId, message, { parse_mode: 'HTML' });
                } catch (e) {
                    console.error(`Failed to send to ${user.telegramId}:`, e.message);
                }
            }

            console.log(`   📱 Broadcast sent to ${activeUsers.length} users`);
        } catch (error) {
            console.error('Broadcast error:', error.message);
        }
    }

    async notifyNoTrade(signal, config) {
        if (!this.bot) return;

        try {
            const users = await databaseService.getAllUsers();
            const activeUsers = users.filter(u => u.status === 'active' && u.telegramId);

            const message = `⚠️ <b>Market Update</b>\n\n` +
                `⏰ ${config.timeframe.toUpperCase()} / ${config.tier}\n` +
                `📊 Signal: ${signal.signal} (${signal.confidence}%)\n\n` +
                `🔍 <i>Confidence below 70%. No trade recommended.</i>\n` +
                `⏳ Waiting for stronger setup...`;

            for (const user of activeUsers) {
                try {
                    await this.bot.sendMessage(user.telegramId, message, { parse_mode: 'HTML' });
                } catch (e) {
                    // Silent fail
                }
            }
        } catch (error) {
            // Silent fail
        }
    }
}

module.exports = new CronService();
