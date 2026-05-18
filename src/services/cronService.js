const cron = require('node-cron');
const openaiService = require('./openaiService');
const databaseService = require('./databaseService');
const axios = require('axios');
const globalMt5WebhookService = require('./globalMt5WebhookService');

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

        try {
            // Check if broadcasting is enabled
            const config = await databaseService.getSystemConfig();
            if (config.broadcastEnabled === false) {
                console.log('🔇 SIGNAL BROADCAST IS DISABLED. Skipping Master Hourly Analysis...');
                this.isJobRunning = false;
                return;
            }

            console.log('================================================================================');
            console.log(`⏰ HOURLY MASTER ANALYSIS - ${new Date().toISOString()}`);
            console.log('================================================================================');

            console.log('   🔨 Compiling Multi-Timeframe Data (W1 -> M15)...');

            // The AI will receive the current market context and analyzed MTF data
            const masterSignal = await openaiService.generateMasterHourlySignal(['W1', 'D1', 'H4', 'H1', 'M15']);

            if (masterSignal && masterSignal.signal !== 'HOLD' && masterSignal.confidence >= 70) {
                // FOUND A GOOD SETUP
                const signalDoc = {
                    ...masterSignal,
                    source: 'CRON_MASTER_AUTO',
                    createdAt: new Date().toISOString(),
                    timestamp: new Date().toISOString()
                };

                await databaseService.createSignal(signalDoc);
                console.log(`   ✅ MASTER SETUP FOUND (${masterSignal.strategyGrade} - ${masterSignal.confidence}%): Broadcasting...`);

                // 1. Broadcast to Telegram users
                await this.broadcastToTelegram(masterSignal, { timeframe: masterSignal.timeframe, tier: 'Master Account' });

                // 2. Push to Bridge API for Master EA
                await this.pushToBridge(masterSignal);

                // 3. Push A+ setups to global MT5 webhook executor
                await globalMt5WebhookService.dispatchIfEligible(masterSignal, 'cron_master_hourly');
            } else {
                // NO CLEAR SETUP
                console.log('   🤫 NO CLEAR SETUP FOUND across timeframes. Sending update...');
                await this.broadcastNoSetupUpdate();
            }

        } catch (error) {
            console.error(`   ❌ Master Signal Generation Failed:`, error.message);
        }

        this.isJobRunning = false;
        console.log('🏁 Master Hourly Generation Complete.');
        console.log('================================================================================');
    }

    async broadcastNoSetupUpdate() {
        if (!this.bot) return;
        try {
            const users = await databaseService.getAllUsers();
            const activeUsers = users.filter(u => u.status === 'active' && u.telegramId);

            const message = `📊 <b>Master Market Update</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `⏰ <b>Status:</b> No professional setup found for this hour.\n` +
                `🔍 <b>Reason:</b> Market is currently unfresh or lacking "X" Confluence.\n\n` +
                `💡 <i>"The best trade is sometimes no trade. Preserve your capital."</i>\n\n` +
                `⏳ Monitoring next hour...`;

            for (const user of activeUsers) {
                try {
                    await this.bot.sendMessage(user.telegramId, message, { parse_mode: 'HTML' });
                } catch (e) { /* Silent fail */ }
            }
        } catch (e) { /* Silent fail */ }
    }

    async broadcastToTelegram(signal, config) {
        if (!this.bot) return;

        try {
            const users = await databaseService.getAllUsers();
            const activeUsers = users.filter(u => u.status === 'active' && u.telegramId);

            const signalEmoji = signal.signal.includes('BUY') ? '🔵 BUY' : '🟠 SELL';

            const message = `🚀 <b>NEW SETUP: Gold (${signal.signal})</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🏆 <b>GRADE:</b> ${signal.strategyGrade || 'A'}\n` +
                `⏰ <b>TF:</b> ${config.timeframe.toUpperCase()} | 📊 <b>CONF:</b> ${signal.confidence}%\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n\n` +

                `🎯 <b>LEVELS:</b>\n` +
                `📍 <b>Entry:</b> $${signal.entry}\n` +
                `🛑 <b>Stop:</b> $${signal.stopLoss}\n` +
                `🏁 <b>TP1:</b> $${signal.takeProfit1}\n` +
                `🏁 <b>TP2:</b> $${signal.takeProfit2}\n` +
                `🏁 <b>TP3:</b> $${signal.takeProfit3}\n` +
                `🏁 <b>FINAL:</b> $${signal.takeProfit4}\n\n` +

                `📈 <b>ANALYSIS:</b>\n` +
                `${signal.technicalAnalysis}\n\n` +

                `👀 <b>MARKET WATCH:</b>\n` +
                `${signal.marketWatch}\n\n` +

                `👨‍🏫 <b>MENTOR TIP:</b>\n` +
                `${signal.professionalRecommendation}\n\n` +

                `✅ <i>Verified by GoldAI Core</i>`;

            let successCount = 0;
            for (const user of activeUsers) {
                try {
                    await this.bot.sendMessage(user.telegramId, message, { parse_mode: 'HTML' });
                    successCount++;
                } catch (e) {
                    if (e.message.indexOf('blocked') === -1) {
                        console.error(`Failed to send to ${user.telegramId}:`, e.message);
                    }
                }
            }

            console.log(`   📱 Professional Broadcast sent to ${successCount} active users`);
        } catch (error) {
            console.error('Broadcast error:', error.message);
        }
    }

    async notifyNoTrade(signal, config) {
        // PER USER REQUEST: Do NOT broadcast/spam if signal is weak.
        console.log(`   🤫 Silencing weak broadcast for ${config.timeframe} ${config.tier} (Confidence: ${signal.confidence}%)`);
    }

    /**
     * Push signal to Bridge API
     * The Bridge will store it in watchlist for Master EA to pick up
     */
    async pushToBridge(signal) {
        try {
            const bridgeUrl = process.env.BRIDGE_API_URL || 'https://goldai-bridge-is7d.onrender.com/api/v1';

            // Format signal for Bridge API
            const bridgeSignal = {
                symbol: 'XAUUSD',
                type: signal.signal.replace('STRONG_', ''), // BUY or SELL
                entry: signal.entry,
                sl: signal.stopLoss,
                tp: signal.takeProfit1,
                tp2: signal.takeProfit2,
                tp3: signal.takeProfit3,
                tp4: signal.takeProfit4,
                timeframe: signal.timeframe || 'MASTER',
                confidence: signal.confidence,
                grade: signal.strategyGrade || 'A',
                timestamp: new Date().toISOString(),
                source: 'MENTOR_PRO_MASTER'
            };

            console.log(`   📡 Pushing signal to Bridge API: ${bridgeUrl}/signals`);

            const response = await axios.post(
                `${bridgeUrl}/signals`,
                bridgeSignal,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            if (response.status === 200 && response.data.success) {
                console.log(`   ✅ Signal pushed to Bridge successfully`);
                console.log(`      Signal ID: ${response.data.signalId}`);
                console.log(`      Quality Score: ${response.data.qualityScore}`);
                console.log(`      Distributed to: ${response.data.distributed} users`);
            } else {
                console.log(`   ⚠️  Bridge response: ${JSON.stringify(response.data)}`);
            }

        } catch (error) {
            console.error(`   ❌ Failed to push signal to Bridge:`, error.message);

            if (error.response) {
                console.error(`      Status: ${error.response.status}`);
                console.error(`      Data:`, error.response.data);
            } else if (error.request) {
                console.error(`      No response from Bridge API`);
                console.error(`      Check if Bridge is running at: ${process.env.BRIDGE_API_URL}`);
            }

            // Don't throw - we don't want to stop Telegram broadcast if Bridge fails
            console.log(`   ℹ️  Continuing with Telegram broadcast despite Bridge error...`);
        }
    }
}

module.exports = new CronService();
