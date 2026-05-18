/**
 * Signal Quality Scorer
 * Evaluates signal quality based on confluence, confidence, and risk/reward
 */
class SignalScorer {
    static toNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    static normalizeSignal(signal) {
        const direction = (signal.direction || signal.type || '').toString().replace('STRONG_', '').toUpperCase();

        const entryPrice = this.toNumber(signal.entry?.price ?? signal.entry);
        const stopLoss = this.toNumber(signal.stopLoss ?? signal.sl);
        const tp1Price = this.toNumber(signal.takeProfits?.[0]?.price ?? signal.takeProfit1 ?? signal.tp);
        const confidence = this.toNumber(signal.confidence);

        return {
            direction,
            confidence,
            entry: { price: entryPrice },
            stopLoss,
            takeProfits: [{ price: tp1Price }],
            confluence: signal.confluence || null
        };
    }

    static validateStructure(signal) {
        const hardFails = [];
        const minRR = this.toNumber(process.env.MIN_SIGNAL_RR || 1.2);

        if (!['BUY', 'SELL'].includes(signal.direction)) {
            hardFails.push('invalid_direction');
        }

        if (!signal.entry?.price || !signal.stopLoss || !signal.takeProfits?.[0]?.price) {
            hardFails.push('missing_core_levels');
            return {
                hardFails,
                riskReward: 0,
                minRR,
                passed: false
            };
        }

        const risk = Math.abs(signal.entry.price - signal.stopLoss);
        const reward = Math.abs(signal.takeProfits[0].price - signal.entry.price);
        const riskReward = risk > 0 ? reward / risk : 0;

        if (risk <= 0 || reward <= 0) {
            hardFails.push('invalid_risk_reward_geometry');
        }

        if (riskReward < minRR) {
            hardFails.push('rr_below_threshold');
        }

        return {
            hardFails,
            riskReward,
            minRR,
            passed: hardFails.length === 0
        };
    }

    /**
     * Calculate overall signal quality score (0-100)
     */
    static calculateScore(signal) {
        return this.calculateDetailedScore(signal).score;
    }

    /**
     * Calculate score with detailed breakdown for logs and audits.
     */
    static calculateDetailedScore(rawSignal) {
        const signal = this.normalizeSignal(rawSignal);
        let totalScore = 0;
        const weights = {
            confidence: 0.30,      // 30%
            confluenceScore: 0.25, // 25%
            riskReward: 0.20,      // 20%
            rsiAlignment: 0.15,    // 15%
            marketContext: 0.10    // 10%
        };

        const structureValidation = this.validateStructure(signal);

        // 1. Confidence Score (0-100)
        const confidenceScore = signal.confidence || 0;
        totalScore += confidenceScore * weights.confidence;

        // 2. Confluence Score (from signal)
        const confluenceScore = signal.confluence?.marketContext?.confluenceScore || 50;
        totalScore += confluenceScore * weights.confluenceScore;

        // 3. Risk/Reward Ratio
        const rrRatio = this.calculateRiskReward(signal);
        const rrScore = Math.min(rrRatio * 20, 100); // 5:1 RR = 100 points
        totalScore += rrScore * weights.riskReward;

        // 4. RSI Alignment
        const rsiScore = this.evaluateRSI(signal);
        totalScore += rsiScore * weights.rsiAlignment;

        // 5. Market Context
        const contextScore = this.evaluateMarketContext(signal);
        totalScore += contextScore * weights.marketContext;

        // Apply hard penalties if structure checks fail.
        if (!structureValidation.passed) {
            totalScore = Math.min(totalScore, 59);
        }

        return {
            score: Math.round(totalScore),
            passed: structureValidation.passed,
            riskReward: Number(structureValidation.riskReward.toFixed(2)),
            minRR: structureValidation.minRR,
            hardFails: structureValidation.hardFails,
            components: {
                confidenceScore,
                confluenceScore,
                rrScore,
                rsiScore,
                contextScore
            }
        };
    }

    /**
     * Calculate risk/reward ratio
     */
    static calculateRiskReward(signal) {
        try {
            const entry = this.toNumber(signal.entry?.price ?? signal.entry);
            const sl = this.toNumber(signal.stopLoss ?? signal.sl);
            const tp = this.toNumber(signal.takeProfits?.[0]?.price ?? signal.takeProfit1 ?? signal.tp);

            if (!entry || !sl || !tp) return 0;

            const risk = Math.abs(entry - sl);
            const reward = Math.abs(tp - entry);

            return reward / risk;
        } catch {
            return 0;
        }
    }

    /**
     * Evaluate RSI alignment
     */
    static evaluateRSI(signal) {
        try {
            const rsi = signal.confluence?.rsi;
            if (!rsi) return 50; // Neutral if no RSI

            const { currentValue, condition } = rsi;

            // Check if RSI is in optimal range
            if (signal.direction === 'SELL') {
                if (currentValue > 70) return 100; // Overbought - excellent
                if (currentValue > 60) return 80;  // Good
                if (currentValue > 50) return 60;  // Average
                return 30; // Poor
            } else { // BUY
                if (currentValue < 30) return 100; // Oversold - excellent
                if (currentValue < 40) return 80;  // Good
                if (currentValue < 50) return 60;  // Average
                return 30; // Poor
            }
        } catch {
            return 50;
        }
    }

    /**
     * Evaluate market context
     */
    static evaluateMarketContext(signal) {
        try {
            const context = signal.confluence?.marketContext;
            if (!context) return 50;

            let score = 50;

            // Strong level types
            const strongLevels = ['SUPPLY_ZONE', 'DEMAND_ZONE', 'KEY_RESISTANCE', 'KEY_SUPPORT'];
            if (strongLevels.includes(context.level)) {
                score += 30;
            }

            // Description quality (longer = more detailed)
            if (context.description?.length > 50) {
                score += 20;
            }

            return Math.min(score, 100);
        } catch {
            return 50;
        }
    }

    /**
     * Determine if signal should be added to watchlist
     * Changed threshold: >= 65 (not 70)
     */
    static shouldMonitor(signal) {
        const threshold = this.toNumber(process.env.SIGNAL_MIN_SCORE || 65);
        const details = this.calculateDetailedScore(signal);
        return details.passed && details.score >= threshold;
    }
}

module.exports = SignalScorer;
