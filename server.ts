import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.json());

// In-memory witness store + persistent file fallback
const STORE_PATH = path.resolve(__dirname, 'src/data/witnesses-store.json');
const SEED_PATH = path.resolve(__dirname, 'src/data/witnesses.json');

interface WitnessRecord {
  id: string;
  human_id?: string;
  text: string;
  created_at_utc: string;
  timezone?: string;
  local_hour?: number;
  voice_family: string;
  city?: string;
  country_code?: string;
  weather?: {
    condition: string;
    temp_c?: number;
    source_time?: string;
  };
  demo_theme?: string;
  demo_x: number;
  demo_y: number;
  is_user?: boolean;
}

let witnesses: WitnessRecord[] = [];

// Load seed and existing store
try {
  if (fs.existsSync(STORE_PATH)) {
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    witnesses = JSON.parse(raw);
  } else if (fs.existsSync(SEED_PATH)) {
    const raw = fs.readFileSync(SEED_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    witnesses = (parsed.witnesses || []).map((w: any) => ({
      ...w,
      is_user: false,
    }));
  }
} catch (err) {
  console.error('[Server] Failed to initialize witness data:', err);
}

function persistStore() {
  try {
    fs.writeFileSync(STORE_PATH, JSON.stringify(witnesses, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Server] Failed to persist witness store:', err);
  }
}

// Active Server-Sent Events (SSE) connections
const sseClients = new Set<express.Response>();

function broadcastNewWitness(witness: WitnessRecord) {
  const payload = `data: ${JSON.stringify({ type: 'new_witness', witness })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Basic semantic theme inference fallback
function inferBasicTheme(text: string): string {
  const lower = text.toLowerCase();
  if (/yağmur|güneş|rüzgar|deniz|ağaç|yaprak|toprak|gökyüzü|çiçek|orman|kar|hava/.test(lower)) return 'doğa';
  if (/vapur|metro|otobüs|trafik|sokak|cadde|şehir|bina|durak|köprü|yol|şişli|kadıköy|beşiktaş/.test(lower)) return 'şehir';
  if (/anne|baba|kardeş|çocuk|bebek|dede|nine|ev|aile|sofra/.test(lower)) return 'aile';
  if (/kedi|köpek|kuş|martı|güvercin|karınca|hayvan|sokak kedisi/.test(lower)) return 'hayvanlar';
  if (/sessiz|yalnız|boş|tek|ıssız|hüzün|kendi|uzak/.test(lower)) return 'yalnızlık';
  if (/zaman|saat|akşam|sabah|gece|yıl|geç|erken|eskiden|şimdi|sonbahar/.test(lower)) return 'zaman';
  if (/ofis|iş|toplantı|mesai|bilgisayar|kod|yazı|çalış/.test(lower)) return 'iş';
  return 'insanlar';
}

// 1. GET /api/witnesses - List witnesses (supports ?limit=100 and ?since=ISO_DATE)
app.get('/api/witnesses', (req, res) => {
  const { limit, since } = req.query;
  let result = [...witnesses];

  if (since && typeof since === 'string') {
    const sinceTime = new Date(since).getTime();
    if (!isNaN(sinceTime)) {
      result = result.filter((w) => new Date(w.created_at_utc).getTime() > sinceTime);
    }
  }

  // Sort descending by created_at_utc (newest first)
  result.sort((a, b) => new Date(b.created_at_utc).getTime() - new Date(a.created_at_utc).getTime());

  if (limit) {
    const parsedLimit = parseInt(limit as string, 10);
    if (!isNaN(parsedLimit) && parsedLimit > 0) {
      result = result.slice(0, parsedLimit);
    }
  }

  res.json({
    count: result.length,
    total: witnesses.length,
    witnesses: result,
  });
});

// 2. POST /api/witnesses - Submit new witness (mobile / web)
app.post('/api/witnesses', (req, res) => {
  const { text, voice_family, human_id, city, weather, demo_theme, demo_x, demo_y } = req.body;

  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Witness text is required' });
    return;
  }

  const now = new Date();
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.15 + Math.random() * 0.45;

  const newWitness: WitnessRecord = {
    id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    human_id: human_id || `human_${Math.random().toString(36).substring(2, 8)}`,
    text: text.trim(),
    created_at_utc: now.toISOString(),
    local_hour: now.getHours(),
    voice_family: voice_family || 'adult_female',
    city: city || 'İstanbul',
    country_code: 'TR',
    weather: weather || {
      condition: 'clear',
      temp_c: 19,
      source_time: now.toISOString(),
    },
    demo_theme: demo_theme || inferBasicTheme(text),
    demo_x: typeof demo_x === 'number' ? demo_x : Math.sin(angle) * radius,
    demo_y: typeof demo_y === 'number' ? demo_y : Math.cos(angle) * radius,
    is_user: true,
  };

  // Prepend to in-memory store
  witnesses.unshift(newWitness);
  persistStore();

  // Instant broadcast to all active SSE subscribers (including Exhibition Mode screens!)
  broadcastNewWitness(newWitness);

  res.status(201).json({
    success: true,
    witness: newWitness,
  });
});

// 3. GET /api/witnesses/stream - Realtime Server-Sent Events (SSE)
app.get('/api/witnesses/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Initial connection handshake
  res.write(`data: ${JSON.stringify({ type: 'connected', totalWitnesses: witnesses.length })}\n\n`);
  sseClients.add(res);

  // Periodic heartbeat every 20 seconds to keep connection open
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// 4. Vite middleware (dev) / static files (prod)
async function setupVite() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Şahitlik running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('[Server] Startup failed:', err);
});
