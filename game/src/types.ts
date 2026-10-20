// Shared types for MathBot Siege. Learner-facing text is always a LocalizedText from props.

export type {
  LocalizedText, ModeConfig, EndlessConfig, NumberSettings, GameSettings, ModelUrls, UiTexts, WeaponConfig,
  UpgradeConfig, LessonConfig, LootConfig,
} from './block';

export type Op = 'add' | 'sub' | 'mul' | 'div';
export type RobotKind = 'drone' | 'mech' | 'spider' | 'scout' | 'titan';
export type UpgradeId = 'shield' | 'reload' | 'magazine' | 'repair' | 'scanner';

/** One generated wave */
export interface WavePlan {
  robots: RobotKind[];
  speed: number;
  maxActive: number;
  boss: boolean;
}

/** Snapshot the engine sends to the React HUD */
export interface HudState {
  wave: number;
  robotsLeft: number;
  score: number;
  cores: number;
  shield: number;
  maxShield: number;
  combo: number;
  ammo: number;
  magazine: number;
  reloading: boolean;
  locked: boolean;
  weapon: string;
  unlocked: string[];
  zoom: number;
  levels: { [id: string]: number };
}

export type EngineEvent =
  | { type: 'correct'; problem: string; answer: number; points: number; combo: number; longShot: boolean }
  | { type: 'wrong'; problem: string; picked: number; hint: boolean }
  | { type: 'body' }
  | { type: 'zapped' }
  | { type: 'lockLost' }
  | { type: 'loot'; kind: 'cores' | 'shield'; amount: number }
  | { type: 'waveStart'; wave: number; boss: boolean }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'intermission'; wave: number }
  | { type: 'end'; score: number; wave: number; correct: number; shots: number; answered: number };
