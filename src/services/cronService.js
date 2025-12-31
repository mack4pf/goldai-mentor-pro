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
        console.log(`⏰ HOURLY MASTER ANALYSIS - ${new Date().toISOString()}`);
        console.log('================================================================================');

        try {
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

                // Broadcast the winner
                await this.broadcastToTelegram(masterSignal, { timeframe: masterSignal.timeframe, tier: 'Master Account' });
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

            const message = `🚀 <b>NEW PRO SETUP: ${signalEmoji} Gold</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `🏆 <b>SETUP GRADE:</b> ${signal.strategyGrade || 'A'}\n` +
                `⏰ <b>TIMEFRAME:</b> ${config.timeframe.toUpperCase()}\n` +
                `📊 <b>CONFIDENCE:</b> ${signal.confidence}%\n` +
                `💰 <b>LOT SIZE:</b> <b>${signal.positionSizing?.lots || '0.01'}</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n\n` +

                `🎯 <b>TRADE SETUP:</b>\n` +
                `📍 <b>Entry:</b> $${signal.entry}\n` +
                `🛑 <b>Stop Loss:</b> $${signal.stopLoss}\n` +
                `🏁 <b>Target (TP):</b> $${signal.takeProfit1}\n\n` +

                `👨‍🏫 <b>MENTOR ADVICE (Action Pattern):</b>\n` +
                `${signal.professionalRecommendation}\n\n` +

                `📈 <b>WHY THIS TRADE? (Storyline):</b>\n` +
                `${signal.technicalAnalysis}\n\n` +

                `💡 <b>EXECUTION TIPS:</b>\n` +
                `• Use <b>Line Chart</b> to find the Fresh Entry Point.\n` +
                `• Wait for a <b>rejection wick</b> on the candle close before entering.\n\n` +

                `⚠️ <b>RISK NOTE:</b>\n` +
                `• Maintain strict ${signal.positionSizing?.lots || '0.01'} lots. Protect your equity.\n\n` +
                `✅ <i>Signal verified by GoldAI Mentor Pro Core.</i>`;

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
}

module.exports = new CronService();
