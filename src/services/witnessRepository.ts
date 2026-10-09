import seedData from '../data/witnesses.json';
import { FilterState, Human, HumanCredential, VoiceFamily, Witness, WitnessEdge } from '../types';
import { db } from './firebase';
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  getDocs,
} from 'firebase/firestore';

const STORAGE_KEY_HUMAN = 'sahitlik_human_profile_v1';
const STORAGE_KEY_USER_WITNESSES = 'sahitlik_user_witnesses_v1';
const BROADCAST_CHANNEL_NAME = 'sahitlik_realtime_channel_v1';

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
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.init();
    this.initFirestore();
    this.initBroadcastChannel();
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
  }

  // Realtime Cloud Firestore Synchronization (works 100% on Vercel across phones & desktops)
  private initFirestore() {
    if (typeof window === 'undefined') return;

    try {
      const witnessesCol = collection(db, 'witnesses');
      const q = query(witnessesCol, orderBy('created_at_utc', 'desc'), firestoreLimit(100));

      let isInitialLoad = true;
      onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data() as Witness;
              const docId = change.doc.id;
              const incoming: Witness = { ...data, id: data.id || docId };

              const exists = this.witnesses.some(
                (w) =>
                  w.id === incoming.id ||
                  (w.text === incoming.text && w.created_at_utc === incoming.created_at_utc)
              );

              if (!exists) {
                this.witnesses.unshift(incoming);
                // Trigger live celebration if arrived in real-time
                if (!isInitialLoad) {
                  this.notifyListeners(incoming);
                }
              }
            }
          });
          isInitialLoad = false;
        },
        (err) => {
          console.warn('[Firestore] Snapshot listener info:', err);
        }
      );
    } catch (err) {
      console.warn('[Firestore] Init error:', err);
    }
  }

  private initBroadcastChannel() {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
    try {
      this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'new_witness' && event.data.witness) {
          const incoming: Witness = event.data.witness;
          const exists = this.witnesses.some((w) => w.id === incoming.id);
          if (!exists) {
            this.witnesses.unshift(incoming);
            this.notifyListeners(incoming);
          }
        }
      };
    } catch (e) {
      console.warn('[WitnessRepo] BroadcastChannel not available:', e);
    }
  }

  private notifyListeners(witness: Witness) {
    this.newWitnessListeners.forEach((listener) => {
      try {
        listener(witness);
      } catch (err) {
        console.error('[WitnessRepo] Listener error:', err);
      }
    });
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
        const witnessesCol = collection(db, 'witnesses');
        const q = query(witnessesCol, orderBy('created_at_utc', 'desc'), firestoreLimit(limit));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const remoteRecords: Witness[] = [];
          snap.forEach((doc) => {
            const data = doc.data() as Witness;
            remoteRecords.push({ ...data, id: doc.id });
          });

          for (const remote of remoteRecords) {
            if (!this.witnesses.some((w) => w.id === remote.id)) {
              this.witnesses.unshift(remote);
            }
          }
        }
      } catch (err) {
        console.warn('[Firestore] fetchLatestWitnesses info:', err);
      }
    }

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
      id: `w_${Date.now()}_${generateRandomToken(4)}`,
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

    // 1. Prepend locally for zero-latency response
    this.witnesses = [newWitness, ...this.witnesses];

    // 2. Persist user witnesses locally in localStorage
    if (typeof window !== 'undefined') {
      try {
        const userOnly = this.witnesses.filter((w) => w.is_user);
        localStorage.setItem(STORAGE_KEY_USER_WITNESSES, JSON.stringify(userOnly));
      } catch (e) {
        console.error('Failed to save witness to storage', e);
      }

      // 3. Multi-tab BroadcastChannel dispatch (0ms same-device sync)
      if (this.broadcastChannel) {
        try {
          this.broadcastChannel.postMessage({ type: 'new_witness', witness: newWitness });
        } catch (e) {
          console.warn('[WitnessRepo] Broadcast post failed:', e);
        }
      }

      // 4. Save to Cloud Firestore (cross-device real-time sync across mobile phones and desktop exhibition screens worldwide)
      try {
        const witnessesCol = collection(db, 'witnesses');
        addDoc(witnessesCol, {
          text: newWitness.text,
          voice_family: newWitness.voice_family,
          human_id: newWitness.human_id,
          city: newWitness.city,
          country_code: newWitness.country_code,
          created_at_utc: newWitness.created_at_utc,
          local_hour: newWitness.local_hour,
          demo_theme: newWitness.demo_theme,
          demo_x: newWitness.demo_x,
          demo_y: newWitness.demo_y,
          is_user: true,
        })
          .then((docRef) => {
            newWitness.id = docRef.id;
          })
          .catch((err) => {
            console.warn('[Firestore] addDoc error:', err);
          });
      } catch (err) {
        console.warn('[Firestore] Error:', err);
      }
    }

    // Trigger local listeners
    this.notifyListeners(newWitness);

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
      lower.includes('beşiktaş') ||
      lower.includes('haliç')
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
