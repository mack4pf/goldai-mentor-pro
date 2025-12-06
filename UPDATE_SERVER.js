// ===================================================================
// INSTRUCTIONS: Add these lines to src/server.js in Gold Mentor Pro
// ===================================================================

// After the health check endpoint (around line 32), add:

// Middleware
app.use(express.json());

// Signal API Routes (for Bridge to request signals)
const signalRoutes = require('./routes/signalRoutes');
app.use('/api/signal', signalRoutes);

// Then update the console.log inside app.listen() to show:
console.log(`🟢 Gold Mentor Pro server running on port ${PORT}`);
console.log(`📡 Signal API available at /api/signal/generate`);

// ===================================================================
// That's it! Save and restart the server.
// ===================================================================
