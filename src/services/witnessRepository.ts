import seedData from '../data/witnesses.json';
import { FilterState, Human, HumanCredential, VoiceFamily, Witness, WitnessEdge } from '../types';

const STORAGE_KEY_HUMAN = 'sahitlik_human_profile_v1';
const STORAGE_KEY_USER_WITNESSES = 'sahitlik_user_witnesses_v1';

// Generate cryptographic hex hash
async function hashSecret(secret: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(secret);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback simple hash
    }
  }
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    hash = (hash << 5) - hash + secret.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

function generateRandomToken(len = 8): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class WitnessRepository {
  private witnesses: Witness[] = [];
  private currentHuman: Human | null = null;
  private currentCredential: HumanCredential | null = null;
  private initialized = false;
  private newWitnessListeners: Set<(witness: Witness) => void> = new Set();
  private eventSource: EventSource | null = null;
  private lastSyncUtc: string = new Date().toISOString();
  private reconnectTimer: any = null;

  constructor() {
    this.init();
    this.initRealtimeStream();
  }

  private init() {
    if (this.initialized) return;

    // Load seed witnesses
    const seeds: Witness[] = (seedData.witnesses as Witness[]).map((w) => ({
      ...w,
      is_user: false,
    }));

    // Load user witnesses from localStorage
    let userWitnesses: Witness[] = [];
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_USER_WITNESSES);
        if (stored) {
          userWitnesses = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed to load user witnesses from storage', e);
      }
    }

    this.witnesses = [...userWitnesses, ...seeds];
    this.initHumanIdentity();
    this.initialized = true;

    // Initial server synchronization in background
    if (typeof window !== 'undefined') {
      this.syncFromServer();
    }
  }

  private initHumanIdentity() {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY_HUMAN);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.currentHuman = parsed.human;
        this.currentCredential = parsed.credential;
      } else {
        // Create new pseudonymous HumanID & Recovery Secret
        const humanId = `human_${generateRandomToken(8)}`;
        const secretPart1 = generateRandomToken(6);
        const secretPart2 = generateRandomToken(6);
        const secretPart3 = generateRandomToken(6);
        const recoverySecret = `sahit-${secretPart1}-${secretPart2}-${secretPart3}`;

        this.currentHuman = {
          human_id: humanId,
          voice_family: 'adult_female',
          created_at_utc: new Date().toISOString(),
        };

        this.currentCredential = {
          human_id: humanId,
          recovery_secret: recoverySecret,
          recovery_secret_hash: '',
          created_at_utc: new Date().toISOString(),
        };

        hashSecret(recoverySecret).then((hash) => {
          if (this.currentCredential) {
            this.currentCredential.recovery_secret_hash = hash;
            this.persistHumanIdentity();
          }
        });

        this.persistHumanIdentity();
      }
    } catch (e) {
      console.error('Failed to initialize HumanID', e);
    }
  }

  private persistHumanIdentity() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        STORAGE_KEY_HUMAN,
        JSON.stringify({
          human: this.currentHuman,
          credential: this.currentCredential,
        })
      );
    } catch (e) {
      console.error('Failed to persist HumanID', e);
    }
  }

  // Realtime Server-Sent Events (SSE) Stream
  private initRealtimeStream() {
    if (typeof window === 'undefined' || !('EventSource' in window)) return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource('/api/witnesses/stream');

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_witness' && data.witness) {
            const incoming: Witness = data.witness;
            const exists = this.witnesses.some((w) => w.id === incoming.id);
            if (!exists) {
              this.witnesses.unshift(incoming);
              this.lastSyncUtc = incoming.created_at_utc;
              // Notify subscribers (Exhibition Mode, collective map, etc.)
              this.newWitnessListeners.forEach((listener) => {
                try {
                  listener(incoming);
                } catch (err) {
                  console.error('[WitnessRepo] Listener error:', err);
                }
              });
            }
          }
        } catch {
          // heartbeat or non-json message
        }
      };

      this.eventSource.onerror = () => {
        // Handle disconnect with auto-reconnect
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.syncFromServer();
            this.initRealtimeStream();
          }, 3000);
        }
      };
    } catch (err) {
      console.error('[WitnessRepo] Failed to setup realtime stream:', err);
    }
  }

  // Catch up missing witnesses created since last known timestamp
  public async syncFromServer() {
    if (typeof window === 'undefined') return;
    try {
      const url = this.lastSyncUtc
        ? `/api/witnesses?since=${encodeURIComponent(this.lastSyncUtc)}`
        : '/api/witnesses';
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.witnesses)) {
        let addedCount = 0;
        for (const w of data.witnesses) {
          if (!this.witnesses.some((existing) => existing.id === w.id)) {
            this.witnesses.unshift(w);
            addedCount++;
          }
        }
        if (data.witnesses.length > 0) {
          this.lastSyncUtc = new Date().toISOString();
        }
      }
    } catch {
      // Offline fallback
    }
  }

  public subscribeToNewWitnesses(callback: (w: Witness) => void): () => void {
    this.newWitnessListeners.add(callback);
    return () => {
      this.newWitnessListeners.delete(callback);
    };
  }

  public async fetchLatestWitnesses(limit = 100): Promise<Witness[]> {
    this.init();
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch(`/api/witnesses?limit=${limit}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.witnesses) && data.witnesses.length > 0) {
            // Merge with local witnesses
            for (const remote of data.witnesses) {
              if (!this.witnesses.some((w) => w.id === remote.id)) {
                this.witnesses.push(remote);
              }
            }
            return data.witnesses;
          }
        }
      } catch {
        // Fallback to local
      }
    }

    // Local fallback: sort descending by date and return top `limit`
    const sorted = [...this.witnesses].sort(
      (a, b) => new Date(b.created_at_utc).getTime() - new Date(a.created_at_utc).getTime()
    );
    return sorted.slice(0, limit);
  }

  public getHuman(): Human | null {
    this.init();
    return this.currentHuman;
  }

  public getCredential(): HumanCredential | null {
    this.init();
    return this.currentCredential;
  }

  public updateVoiceFamily(family: VoiceFamily) {
    this.init();
    if (this.currentHuman) {
      this.currentHuman.voice_family = family;
      this.persistHumanIdentity();
    }
  }

  public recoverIdentity(recoveryCode: string): { success: boolean; message?: string } {
    this.init();
    const cleanCode = recoveryCode.trim();
    if (!cleanCode || cleanCode.length < 8) {
      return { success: false, message: 'Geçersiz recovery kodu formatı.' };
    }

    let derivedId = 'human_' + cleanCode.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase();
    if (derivedId.length < 10) {
      derivedId = `human_${generateRandomToken(8)}`;
    }

    this.currentHuman = {
      human_id: derivedId,
      voice_family: this.currentHuman?.voice_family || 'adult_female',
      created_at_utc: new Date().toISOString(),
    };

    this.currentCredential = {
      human_id: derivedId,
      recovery_secret: cleanCode,
      recovery_secret_hash: '',
      created_at_utc: new Date().toISOString(),
    };

    hashSecret(cleanCode).then((hash) => {
      if (this.currentCredential) {
        this.currentCredential.recovery_secret_hash = hash;
        this.persistHumanIdentity();
      }
    });

    this.persistHumanIdentity();
    return { success: true };
  }

  public getAllWitnesses(): Witness[] {
    this.init();
    return this.witnesses;
  }

  public getUserWitnesses(): Witness[] {
    this.init();
    const humanId = this.currentHuman?.human_id;
    return this.witnesses.filter((w) => w.is_user || (humanId && w.human_id === humanId));
  }

  public addWitness(params: {
    text: string;
    voice_family?: VoiceFamily;
    city?: string;
    weatherCondition?: string;
    temp_c?: number;
  }): Witness {
    this.init();

    const humanId = this.currentHuman?.human_id || `human_${generateRandomToken(8)}`;
    const family = params.voice_family || this.currentHuman?.voice_family || 'adult_female';
    const now = new Date();

    const angle = Math.random() * Math.PI * 2;
    const radius = 0.15 + Math.random() * 0.45;
    const demo_x = Math.sin(angle) * radius;
    const demo_y = Math.cos(angle) * radius;

    const newWitness: Witness = {
      id: `usr_${Date.now()}_${generateRandomToken(4)}`,
      human_id: humanId,
      text: params.text.trim(),
      created_at_utc: now.toISOString(),
      local_hour: now.getHours(),
      voice_family: family,
      city: params.city || 'İstanbul',
      country_code: 'TR',
      weather: {
        condition: params.weatherCondition || 'clear',
        temp_c: params.temp_c || 19,
        source_time: now.toISOString(),
      },
      demo_theme: this.inferBasicTheme(params.text),
      demo_x,
      demo_y,
      is_user: true,
    };

    // Prepend locally for zero-latency response
    this.witnesses = [newWitness, ...this.witnesses];

    // Persist user witnesses locally
    if (typeof window !== 'undefined') {
      try {
        const userOnly = this.witnesses.filter((w) => w.is_user);
        localStorage.setItem(STORAGE_KEY_USER_WITNESSES, JSON.stringify(userOnly));
      } catch (e) {
        console.error('Failed to save witness to storage', e);
      }

      // Synchronize with backend API in background & broadcast to SSE
      fetch('/api/witnesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newWitness),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.witness && data.witness.id) {
            newWitness.id = data.witness.id;
          }
        })
        .catch((err) => {
          console.warn('[WitnessRepo] Background sync failed (saved offline):', err);
        });
    }

    // Trigger local listeners
    this.newWitnessListeners.forEach((listener) => {
      try {
        listener(newWitness);
      } catch (err) {
        console.error('[WitnessRepo] Listener error:', err);
      }
    });

    return newWitness;
  }

  private inferBasicTheme(text: string): string {
    const lower = text.toLowerCase();
    if (
      lower.includes('martı') ||
      lower.includes('vapur') ||
      lower.includes('sokak') ||
      lower.includes('cadde') ||
      lower.includes('trafik') ||
      lower.includes('şehir') ||
      lower.includes('otobüs') ||
      lower.includes('şişli') ||
      lower.includes('kadıköy') ||
      lower.includes('beşiktaş')
    ) {
      return 'şehir';
    }
    if (
      lower.includes('yağmur') ||
      lower.includes('rüzgar') ||
      lower.includes('ağaç') ||
      lower.includes('yaprak') ||
      lower.includes('gökyüzü') ||
      lower.includes('güneş') ||
      lower.includes('deniz')
    ) {
      return 'doğa';
    }
    if (
      lower.includes('çocuk') ||
      lower.includes('anne') ||
      lower.includes('baba') ||
      lower.includes('yaşlı') ||
      lower.includes('insan') ||
      lower.includes('kadın') ||
      lower.includes('adam')
    ) {
      return 'insan';
    }
    if (
      lower.includes('sessizlik') ||
      lower.includes('zaman') ||
      lower.includes('ışık') ||
      lower.includes('gölge') ||
      lower.includes('ses') ||
      lower.includes('gece')
    ) {
      return 'zaman';
    }
    return 'dikkat';
  }

  public getWitnessConnections(witnessId: string, maxCount = 4): { edges: WitnessEdge[]; targets: Witness[] } {
    this.init();
    const source = this.witnesses.find((w) => w.id === witnessId);
    if (!source) return { edges: [], targets: [] };

    const candidates = this.witnesses.filter((w) => w.id !== witnessId);

    const scored = candidates.map((target) => {
      const dx = target.demo_x - source.demo_x;
      const dy = target.demo_y - source.demo_y;
      const spatialDist = Math.sqrt(dx * dx + dy * dy);

      const themeMatch = target.demo_theme && source.demo_theme && target.demo_theme === source.demo_theme;
      const themeBonus = themeMatch ? 0.18 : 0.0;

      const sameHuman = Boolean(source.human_id && target.human_id && source.human_id === target.human_id);
      const personalBonus = sameHuman ? 0.22 : 0.0;

      const timeDiffHours = Math.abs((source.local_hour ?? 12) - (target.local_hour ?? 12));
      const timeBonus = timeDiffHours <= 2 ? 0.05 : 0.0;

      const baseSimilarity = Math.max(0.4, 1.0 - spatialDist * 0.7);
      const totalScore = Math.min(0.98, Math.max(0.65, baseSimilarity + themeBonus + personalBonus + timeBonus));

      return {
        target,
        score: totalScore,
        sameHuman,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, maxCount);

    const edges: WitnessEdge[] = top.map((t) => ({
      source_id: source.id,
      target_id: t.target.id,
      semantic_score: Number(t.score.toFixed(2)),
      same_human: t.sameHuman,
      context_tags: t.target.demo_theme ? [t.target.demo_theme] : [],
    }));

    const targets = top.map((t) => t.target);

    return { edges, targets };
  }

  public filterWitnesses(witnesses: Witness[], filters: FilterState): Witness[] {
    const now = new Date();
    const query = filters.search.trim().toLowerCase();

    return witnesses.filter((w) => {
      if (query && !w.text.toLowerCase().includes(query) && !(w.city && w.city.toLowerCase().includes(query))) {
        return false;
      }

      if (filters.weather !== 'all') {
        const cond = w.weather?.condition?.toLowerCase() || '';
        if (filters.weather === 'rain' && !cond.includes('rain') && !cond.includes('yağmur')) {
          return false;
        }
        if (filters.weather === 'clear' && !cond.includes('clear') && !cond.includes('güneş') && !cond.includes('açık')) {
          return false;
        }
        if (filters.weather === 'cloudy' && !cond.includes('cloud') && !cond.includes('bulut')) {
          return false;
        }
      }

      if (filters.hour !== 'all') {
        const hour = w.local_hour ?? new Date(w.created_at_utc).getHours();
        if (filters.hour === 'morning' && (hour < 5 || hour >= 12)) return false;
        if (filters.hour === 'day' && (hour < 12 || hour >= 18)) return false;
        if (filters.hour === 'evening' && (hour < 18 || hour >= 23)) return false;
        if (filters.hour === 'night' && (hour >= 5 && hour < 23)) return false;
      }

      if (filters.time !== 'all') {
        const wDate = new Date(w.created_at_utc);
        const diffMs = now.getTime() - wDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (filters.time === 'today' && diffDays > 1.5) return false;
        if (filters.time === 'week' && diffDays > 7.5) return false;
        if (filters.time === 'month' && diffDays > 31) return false;
      }

      return true;
    });
  }
}

export const witnessRepo = new WitnessRepository();
