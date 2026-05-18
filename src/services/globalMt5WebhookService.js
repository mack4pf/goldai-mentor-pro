const axios = require('axios');

class GlobalMt5WebhookService {
  constructor() {
    this.webhookUrl = process.env.GLOBAL_MT5_WEBHOOK_URL || 'https://nojai-backend.onrender.com/api/mt5-webhook/global/nojai_global_mt5_xK9mPqR2vLwT8nJcYdZbFs';
    this.minConfidence = Number(process.env.GLOBAL_MT5_MIN_CONFIDENCE || 85);
    this.defaultVolume = Number(process.env.GLOBAL_MT5_VOLUME || 0.01);
    this.strategyName = 'XAUUSD 1';
  }

  isEligible(signal) {
    if (!signal) return false;

    const confidence = Number(signal.confidence || 0);
    const signalType = (signal.signal || '').toString().toUpperCase();

    if (!signalType || signalType === 'HOLD' || signalType === 'ERROR') {
      return false;
    }

    if (!signalType.includes('BUY') && !signalType.includes('SELL')) {
      return false;
    }

    return confidence >= this.minConfidence && confidence <= 100;
  }

  buildPayload(signal) {
    const signalType = (signal.signal || '').toString().toUpperCase();
    const action = signalType.includes('BUY') ? 'buy' : 'sell';

    const payload = {
      symbol: signal.symbol || 'XAUUSD',
      action,
      volume: this.defaultVolume,
      strategy: this.strategyName
    };

    const stopLoss = Number(signal.stopLoss);
    const takeProfit = Number(signal.takeProfit1);

    if (Number.isFinite(stopLoss) && stopLoss > 0) {
      payload.stopLoss = stopLoss;
    }

    if (Number.isFinite(takeProfit) && takeProfit > 0) {
      payload.takeProfit = takeProfit;
    }

    return payload;
  }

  async dispatchIfEligible(signal, source = 'unknown') {
    if (!this.isEligible(signal)) {
      return {
        sent: false,
        reason: 'Signal not eligible for global MT5 webhook.'
      };
    }

    const payload = this.buildPayload(signal);

    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      console.log(`🌐 MT5 GLOBAL WEBHOOK SENT (${source}) -> ${payload.action.toUpperCase()} ${payload.symbol} @ ${signal.confidence}%`);

      return {
        sent: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      const status = error.response?.status || 'NO_RESPONSE';
      const message = error.response?.data || error.message;
      console.error(`❌ MT5 GLOBAL WEBHOOK FAILED (${source}) [${status}]:`, message);

      return {
        sent: false,
        reason: `Webhook failed: ${status}`,
        error: message
      };
    }
  }
}

module.exports = new GlobalMt5WebhookService();
