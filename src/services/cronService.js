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

            const signalEmoji = signal.signal.includes('BUY') ? '🔵 BUY' : '🟠 SELL';

            const message = `🚀 <b>NEW PRO SETUP: ${signalEmoji} Gold</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `⏰ <b>TIMEFRAME:</b> ${config.timeframe.toUpperCase()}\n` +
                `📊 <b>CONFIDENCE:</b> ${signal.confidence}%\n` +
                `💰 <b>LOT SIZE:</b> <b>${signal.positionSizing?.lots || '0.01'}</b> (Safe Risk Control)\n\n` +

                `🎯 <b>TRADE SETUP:</b>\n` +
                `📍 <b>Entry:</b> $${signal.entry}\n` +
                `🛑 <b>Stop Loss:</b> $${signal.stopLoss}\n` +
                `🏁 <b>TP1:</b> $${signal.takeProfit1}\n\n` +

                `👨‍🏫 <b>MENTOR ADVICE (Candle Patterns):</b>\n` +
                `${signal.professionalRecommendation}\n\n` +

                `📊 <b>WHY THIS TRADE? (Educational):</b>\n` +
                `${signal.technicalAnalysis}\n\n` +

                `💡 <b>EXECUTION TIPS:</b>\n` +
                `• Watch for <b>Pin Bars or Engulfing</b> candles at $${signal.entry} for extra confirmation.\n` +
                `• Never enter a trade if price has already moved 20+ pips away from Entry.\n` +
                `• Set your lot size exactly to <b>${signal.positionSizing?.lots || '0.01'}</b> to protect your capital.\n\n` +

                `⚠️ <b>WATCH OUT FOR:</b>\n` +
                `• ${signal.marketContext?.split('.')[0] || 'Market volatility and spread'}.\n` +
                `• Stay patient. If SL is hit, the pattern changed; stay professional and wait.\n\n` +
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
