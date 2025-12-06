/**
 * GOLD MENTOR PRO SERVER UPDATE
 * Add these lines to: src/server.js
 */

// After line 35 (after the health check endpoint closing brace):

// Signal API Routes (for Bridge to request signals)
const signalRoutes = require('./routes/signalRoutes');
app.use('/api/signal', signalRoutes);

// Then update the console.log in app.listen (around line 39):
console.log(`🟢 Gold Mentor Pro server running on port ${PORT}`);
console.log(`📡 Signal API available at /api/signal/generate`);
