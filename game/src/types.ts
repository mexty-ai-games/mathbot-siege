// Shared types for MathBot Siege. Learner-facing text is always a LocalizedText from props.

export type { LocalizedText, ModeConfig, WaveConfig, NumberSettings, GameSettings, ModelUrls, UiTexts } from './block';

export type Op = 'add' | 'sub' | 'mul' | 'div';
export type RobotKind = 'drone' | 'mech' | 'spider';

/** Snapshot the engine sends to the React HUD */
export interface HudState {
  wave: number;
  waves: number;
  robotsLeft: number;
  score: number;
  shield: number;
  maxShield: number;
  combo: number;
  ammo: number;
  magazine: number;
  reloading: boolean;
  locked: boolean;
}

export type EngineEvent =
  | { type: 'correct'; problem: string; answer: number; points: number; combo: number }
  | { type: 'wrong'; problem: string; picked: number; hint: boolean }
  | { type: 'body' }
  | { type: 'zapped' }
  | { type: 'lockLost' }
  | { type: 'waveStart'; wave: number }
  | { type: 'waveCleared'; wave: number }
  | { type: 'end'; victory: boolean; score: number; wave: number; correct: number; shots: number; answered: number };
