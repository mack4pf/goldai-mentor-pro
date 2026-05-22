const databaseService = require('./databaseService');

class SignalModelService {
  constructor() {
    this.modelVersion = 'edge-v1';
    this.learningInProgress = false;
    this.lastAdaptiveRefreshAt = null;
    this.adaptiveState = {
      holdThreshold: Number(process.env.MODEL_HOLD_THRESHOLD || 0.58),
      strongThreshold: Number(process.env.MODEL_STRONG_THRESHOLD || 0.78),
      confidenceBoost: 0,
      sampledTrades: 0,
      recentWinRate: null
    };

    this.weights = {
      bias: 0.02,
      momentum: 0.42,
      mtfAlignment: 0.37,
      usdPressure: 0.26,
      sentiment: 0.24,
      volatilityPenalty: 0.31,
      sessionEdge: 0.14,
      newsShock: 0.23
    };
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-x));
  }

  mapSentiment(sentiment) {
    const s = String(sentiment || '').toLowerCase();
    if (s.includes('very_bullish')) return 1;
    if (s.includes('bullish')) return 0.6;
    if (s.includes('very_bearish')) return -1;
    if (s.includes('bearish')) return -0.6;
    return 0;
  }

  mapUsdStrength(usdStrength) {
    const s = String(usdStrength || '').toLowerCase();
    if (s.includes('strong')) return -0.7;
    if (s.includes('weak')) return 0.7;
    return 0;
  }

  normalizeDirection(direction) {
    const d = String(direction || '').toLowerCase();
    if (d.includes('bull')) return 1;
    if (d.includes('bear')) return -1;
    return 0;
  }

  getSessionEdge() {
    const hour = new Date().getUTCHours();
    if ((hour >= 7 && hour <= 11) || (hour >= 12 && hour <= 16)) return 0.35;
    if (hour >= 17 && hour <= 20) return 0.05;
    return -0.2;
  }

  buildFeatures(marketData = {}) {
    const gold = marketData.goldPrice || {};
    const news = marketData.news || {};

    const momentum = this.clamp(Number(gold.changePercent || 0) / 2.5, -1, 1);
    const volatilityPct = Number(gold.volatility?.volatilityPercent || 0);
    const volatilityNorm = this.clamp((volatilityPct - 0.9) / 1.6, -1, 1);

    const predictions = gold.predictions || {};
    const mtfVotes = [
      this.normalizeDirection(predictions?.shortTerm?.direction),
      this.normalizeDirection(predictions?.mediumTerm?.direction),
      this.normalizeDirection(predictions?.longTerm?.direction)
    ];
    const mtfAlignment = this.clamp(mtfVotes.reduce((sum, v) => sum + v, 0) / 3, -1, 1);

    const usdPressure = this.mapUsdStrength(news?.usdAnalysis?.strength);
    const sentiment = this.mapSentiment(news?.overallSentiment);
    const sessionEdge = this.getSessionEdge();

    const highImpact = Number(news?.marketSummary?.highImpactNews || 0);
    const mediumImpact = Number(news?.marketSummary?.mediumImpactNews || 0);
    const newsShock = this.clamp((highImpact * 0.6) + (mediumImpact * 0.2), 0, 2);

    return {
      momentum,
      volatilityNorm,
      mtfAlignment,
      usdPressure,
      sentiment,
      sessionEdge,
      newsShock,
      raw: {
        changePercent: Number(gold.changePercent || 0),
        volatilityPercent: volatilityPct,
        highImpact,
        mediumImpact
      }
    };
  }

  computeDirectionalScore(features) {
    const w = this.weights;
    return (
      w.bias +
      (w.momentum * features.momentum) +
      (w.mtfAlignment * features.mtfAlignment) +
      (w.usdPressure * features.usdPressure) +
      (w.sentiment * features.sentiment) +
      (w.sessionEdge * features.sessionEdge)
    );
  }

  pickPrimaryRr(edgeProbability, volatilityNorm) {
    if (edgeProbability >= 0.84 && volatilityNorm <= 0.65) return 5;
    if (edgeProbability >= 0.74) return 3;
    if (edgeProbability >= 0.64) return 2;
    return 1;
  }

  pickStopLossPips(features, primaryRr) {
    const volatilityLift = Math.max(0, features.volatilityNorm) * 22;
    const eventLift = Math.min(features.newsShock, 1.5) * 5;
    const rrCompression = primaryRr >= 3 ? 6 : 0;
    const sl = 38 + volatilityLift + eventLift - rrCompression;
    return this.clamp(Math.round(sl), 30, 80);
  }

  classifyRegime(features) {
    if (features.newsShock >= 1.2) return 'event_driven';
    if (features.volatilityNorm >= 0.75) return 'high_volatility';
    if (Math.abs(features.momentum) < 0.12 && Math.abs(features.mtfAlignment) < 0.2) return 'range';
    return 'trend';
  }

  predictSignalPlan(marketData = {}, timeframe = '1h') {
    const features = this.buildFeatures(marketData);
    const directionalScore = this.computeDirectionalScore(features);

    const noisePenalty = (Math.abs(features.volatilityNorm) * 0.22) + (features.newsShock * 0.08);
    const edgeRaw = Math.max(0, Math.abs(directionalScore) - noisePenalty);
    const edgeProbability = this.sigmoid((edgeRaw * 3.2) - 0.8);

    let direction = 'neutral';
    if (directionalScore > 0.08) direction = 'bullish';
    if (directionalScore < -0.08) direction = 'bearish';

    const holdThreshold = this.adaptiveState.holdThreshold;
    const recommendation = edgeProbability < holdThreshold || direction === 'neutral'
      ? 'HOLD'
      : direction === 'bullish' ? 'BUY' : 'SELL';

    const primaryRr = this.pickPrimaryRr(edgeProbability, features.volatilityNorm);
    const slPips = this.pickStopLossPips(features, primaryRr);

    const confidence = this.clamp(
      Math.round((edgeProbability * 100) + this.adaptiveState.confidenceBoost),
      45,
      95
    );

    return {
      modelVersion: this.modelVersion,
      timeframe,
      regime: this.classifyRegime(features),
      direction,
      recommendation,
      edgeProbability: Number(edgeProbability.toFixed(4)),
      confidence,
      features,
      riskPlan: {
        slPips,
        rrOptions: [1, 2, 3, 5],
        primaryRr,
        tpMaxPips: 300,
        minSlPips: 30,
        maxSlPips: 80
      },
      adaptive: {
        holdThreshold: this.adaptiveState.holdThreshold,
        strongThreshold: this.adaptiveState.strongThreshold,
        recentWinRate: this.adaptiveState.recentWinRate,
        sampledTrades: this.adaptiveState.sampledTrades
      }
    };
  }

  async canTradeByDailyLoss() {
    const maxDailyLoss = Number(process.env.MAX_DAILY_LOSS_USD || 150);

    try {
      const snapshot = await databaseService.getDailyRiskSnapshot();
      if (!snapshot.hasPnlData) {
        return {
          allowed: true,
          reason: 'no_realized_pnl_data',
          dailyPnl: snapshot.dailyPnl,
          maxDailyLoss
        };
      }

      return {
        allowed: snapshot.dailyPnl > (-1 * Math.abs(maxDailyLoss)),
        reason: snapshot.dailyPnl <= (-1 * Math.abs(maxDailyLoss))
          ? 'daily_loss_limit_reached'
          : 'ok',
        dailyPnl: snapshot.dailyPnl,
        maxDailyLoss
      };
    } catch (error) {
      console.error('Model risk check failed:', error.message);
      return {
        allowed: true,
        reason: 'risk_check_failed_open',
        dailyPnl: 0,
        maxDailyLoss
      };
    }
  }

  async refreshAdaptiveState() {
    if (this.learningInProgress) return;
    this.learningInProgress = true;

    try {
      const recentSignals = await databaseService.getRecentSignals(300);
      const labeled = recentSignals.filter(s => {
        const out = String(s?.tradeOutcome || s?.outcome || s?.result || '').toUpperCase();
        return ['WIN', 'LOSS', 'TP', 'SL'].includes(out);
      });

      if (labeled.length < 20) {
        this.lastAdaptiveRefreshAt = new Date().toISOString();
        this.learningInProgress = false;
        return;
      }

      const wins = labeled.filter(s => {
        const out = String(s?.tradeOutcome || s?.outcome || s?.result || '').toUpperCase();
        return out === 'WIN' || out === 'TP';
      }).length;

      const winRate = wins / labeled.length;
      this.adaptiveState.sampledTrades = labeled.length;
      this.adaptiveState.recentWinRate = Number(winRate.toFixed(4));

      // Adapt selectivity: low win-rate => more HOLD and lower confidence inflation.
      this.adaptiveState.holdThreshold = this.clamp(0.66 - (winRate * 0.16), 0.52, 0.66);
      this.adaptiveState.confidenceBoost = this.clamp((winRate - 0.5) * 12, -5, 5);
      this.lastAdaptiveRefreshAt = new Date().toISOString();

      await databaseService.updateSystemConfig({
        signalModel: {
          version: this.modelVersion,
          adaptiveState: this.adaptiveState,
          updatedAt: this.lastAdaptiveRefreshAt
        }
      });

      console.log('🧠 Signal model adapted:', {
        sampledTrades: labeled.length,
        winRate: `${(winRate * 100).toFixed(1)}%`,
        holdThreshold: this.adaptiveState.holdThreshold
      });
    } catch (error) {
      console.error('Adaptive model refresh failed:', error.message);
    } finally {
      this.learningInProgress = false;
    }
  }
}

module.exports = new SignalModelService();
