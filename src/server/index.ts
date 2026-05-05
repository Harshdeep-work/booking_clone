import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import { initSocketServer, setIO } from './websocket';
import seatsRouter from './routes/seats';
import seatActionsRouter from './routes/seatActions';
import sectionsRouter from './routes/sections';
import layoutRouter from './routes/layout';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({ origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/seats', seatsRouter);
app.use('/api', seatActionsRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/layout', layoutRouter);
app.use('/api', sectionsRouter); // /api/geojson/:layoutId

// Initialize Socket.IO
const io = initSocketServer(httpServer);
setIO(io);

const PORT = parseInt(process.env.BACKEND_PORT || process.env.PORT || '4000', 10);
httpServer.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Socket.IO] WebSocket server ready`);
});

export default app;
