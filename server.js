import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import { createChat, runAgentStream } from './agentCore.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many requests, please slow down.' }
});

// sessionId → { chat, lastActive }
const sessions = new Map();

function getOrCreateSession(sessionId) {
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    session.lastActive = Date.now();
    return { session, id: sessionId };
  }
  const id = randomUUID();
  const session = { chat: createChat(), lastActive: Date.now() };
  sessions.set(id, session);
  return { session, id };
}

// Clean up sessions idle for more than 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (session.lastActive < cutoff) sessions.delete(id);
  }
}, 5 * 60 * 1000);

app.post('/chat', limiter, async (req, res) => {
  const { message, sessionId } = req.body;
  if (!message) return res.status(400).json({ error: 'No message provided' });
  if (typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const { session, id } = getOrCreateSession(sessionId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ type: 'session', sessionId: id })}\n\n`);

  try {
    await runAgentStream(session.chat, message, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
    });
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Agent error' })}\n\n`);
  }

  res.end();
});

app.listen(3000, () => console.log('🎨 Server running at http://localhost:3000'));
