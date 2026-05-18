const axios = require('axios');

class GlobalMt5WebhookService {
  constructor() {
    this.webhookUrl = process.env.GLOBAL_MT5_WEBHOOK_URL || 'https://nojai-backend.onrender.com/api/mt5-webhook/global/nojai_mt5_xauusd_cc0c64afea2c7ca875d38b2b';
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

    const entry = Number(signal.entry ?? signal.entryPrice);
    const sl = Number(signal.sl ?? signal.stopLoss);
    const tp1 = Number(signal.tp1 ?? signal.takeProfit1);

    const payload = {
      symbol: signal.symbol || 'XAUUSD',
      action,
      volume: this.defaultVolume,
      strategy: this.strategyName
    };

    if (Number.isFinite(entry) && entry > 0) {
      payload.entry = entry;
    }

    if (Number.isFinite(sl) && sl > 0) {
      // MT5 backend preferred field for SL.
      payload.sl = sl;
      // Backward compatibility for older webhook handlers.
      payload.stopLoss = sl;
    }

    if (Number.isFinite(tp1) && tp1 > 0) {
      // MT5 backend preferred field for TP1.
      payload.tp1 = tp1;
      // Backward compatibility for older webhook handlers.
      payload.takeProfit = tp1;
    }

    return payload;
  }

  async dispatchIfEligible(signal, source = 'unknown') {
    const confidence = Number(signal?.confidence || 0);
    const signalType = (signal?.signal || '').toString().toUpperCase();

    console.log(`\n📊 MT5 WEBHOOK CHECK (${source}):`, {
      symbol: signal?.symbol || 'XAUUSD',
      signal: signalType,
      confidence: `${confidence}%`,
      minRequired: `${this.minConfidence}%`,
      eligible: this.isEligible(signal)
    });

    if (!this.isEligible(signal)) {
      const reason = confidence < this.minConfidence ? `confidence ${confidence}% < ${this.minConfidence}%` : 
                     (signalType === 'HOLD' || signalType === 'ERROR') ? `signal type is ${signalType}` :
                     !signalType.includes('BUY') && !signalType.includes('SELL') ? `invalid signal type: ${signalType}` :
                     'unknown reason';
      console.log(`   ⏭️  SKIPPED: ${reason}`);
      return {
        sent: false,
        reason: `Signal not eligible: ${reason}`
      };
    }

    const payload = this.buildPayload(signal);

    console.log(`   ✅ ELIGIBLE - Building webhook payload:`, JSON.stringify(payload, null, 2));

    try {
      console.log(`   📤 Sending to: ${this.webhookUrl}`);
      const response = await axios.post(this.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      console.log(`\n✅✅✅ MT5 GLOBAL WEBHOOK DELIVERED (${source}) ✅✅✅`);
      console.log(`   🟢 Status: ${response.status}`);
      console.log(`   🎯 Action: ${payload.action.toUpperCase()} ${payload.symbol}`);
      console.log(`   💰 Volume: ${payload.volume}`);
      console.log(`   📍 Entry: ${payload.entry || 'MARKET'} | SL=${payload.sl || payload.stopLoss || 'N/A'} | TP1=${payload.tp1 || payload.takeProfit || 'N/A'}`);
      console.log(`   🤖 Strategy: ${payload.strategy}`);
      console.log(`   📈 Confidence: ${confidence}%\n`);

      return {
        sent: true,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      const status = error.response?.status || 'NO_RESPONSE';
      const message = error.response?.data || error.message;
      
      console.log(`\n❌❌❌ MT5 GLOBAL WEBHOOK FAILED (${source}) ❌❌❌`);
      console.log(`   🔴 Status: ${status}`);
      console.log(`   ⚠️  Error: ${message}`);
      console.log(`   📤 Attempted URL: ${this.webhookUrl}`);
      console.log(`   📦 Payload was:`, JSON.stringify(payload, null, 2));
      console.log(`   💡 Check if webhook endpoint is online\n`);

      return {
        sent: false,
        reason: `Webhook failed: ${status}`,
        error: message
      };
    }
  }
}

module.exports = new GlobalMt5WebhookService();
