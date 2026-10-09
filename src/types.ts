export type VoiceFamily = 'adult_male' | 'adult_female' | 'boy' | 'girl';

export interface WeatherInfo {
  condition: string;
  temp_c?: number;
  source_time?: string;
}

export interface Witness {
  id: string;
  human_id?: string;
  text: string;
  created_at_utc: string;
  timezone?: string;
  local_hour?: number;
  voice_family: VoiceFamily;
  city?: string;
  country_code?: string;
  weather?: WeatherInfo;
  demo_theme?: string;
  demo_x: number;
  demo_y: number;
  embedding?: number[];
  is_user?: boolean;
}

export interface Human {
  human_id: string;
  voice_family: VoiceFamily;
  created_at_utc: string;
}

export interface HumanCredential {
  human_id: string;
  recovery_secret: string; // Stored securely on client
  recovery_secret_hash: string;
  created_at_utc: string;
}

export interface WitnessEdge {
  source_id: string;
  target_id: string;
  semantic_score: number;
  same_human: boolean;
  temporal_score?: number;
  context_tags?: string[];
}

export type ViewMode = 'biz' | 'ben' | 'composer' | 'exhibition';

export type TimeFilter = 'all' | 'today' | 'week' | 'month';
export type WeatherFilter = 'all' | 'rain' | 'clear' | 'cloudy';
export type HourFilter = 'all' | 'morning' | 'day' | 'evening' | 'night';

export interface FilterState {
  time: TimeFilter;
  weather: WeatherFilter;
  hour: HourFilter;
  search: string;
}
