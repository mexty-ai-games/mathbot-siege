import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMexty, useLanguage, useCloudSave } from '@mexty/sdk';
import { Engine } from './engine/Engine';
import { Assets, loadAssets } from './engine/assets';
import { Sfx } from './engine/audio';
import { Hud, Toast, Banner } from './ui/Hud';
import { TouchControls } from './ui/TouchControls';
import { Loading, Title, HowTo, ModeSelect, Pause, Results, ResultData } from './ui/Menus';
import { CSS } from './ui/css';
import { EngineEvent, HudState } from './types';

/** A text in every language the game ships */
export interface LocalizedText {
  en?: string;
  fr?: string;
}

export interface ModeConfig {
  /** Stable id used for saves and best scores */
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Operations mixed in this mode */
  ops: ('add' | 'sub' | 'mul' | 'div')[];
  /** Accent colour of the mode card (CSS colour) */
  color: string;
}

export interface WaveConfig {
  /** Humanoid drones (1 problem each) */
  drones: number;
  /** Heavy mechs (2 problems each, slower) */
  mechs: number;
  /** Spider bots (fast, harder numbers) */
  spiders: number;
  /** Walking speed multiplier */
  speed: number;
  /** Robots walking at the same time */
  maxActive: number;
}

export interface NumberSettings {
  /** Largest number in + and − problems on wave 1 */
  addMaxStart: number;
  /** Growth of that limit per wave */
  addMaxStep: number;
  /** Cap for + and − numbers */
  addMaxCap: number;
  /** Largest factor in × and ÷ problems on wave 1 */
  mulMaxStart: number;
  /** Cap for × and ÷ factors (times tables up to …) */
  mulMaxCap: number;
}

export interface GameSettings {
  /** Shield cells at the start */
  shield: number;
  /** Cells lost when a robot reaches you and zaps */
  robotZapDamage: number;
  /** Cells lost when shooting a wrong answer */
  wrongAnswerDamage: number;
  /** Cells restored after each cleared wave */
  waveHeal: number;
  /** Shots per magazine */
  magazine: number;
  /** Wrong answers on one robot before its right panel blinks green */
  hintAfterMistakes: number;
  numbers: NumberSettings;
}

export interface ModelUrls {
  /** Humanoid drone .glb (rigged, clips Idle/Walk/Attack/Hit/PowerDown, PANEL_* sockets) */
  drone: string;
  /** Heavy mech .glb */
  mech: string;
  /** Spider bot .glb */
  spider: string;
  /** First-person blaster .glb (MUZZLE node) */
  blaster: string;
  /** Hangar arena .glb */
  arena: string;
}

export interface UiTexts {
  title: LocalizedText;
  subtitle: LocalizedText;
  play: LocalizedText;
  howToPlay: LocalizedText;
  howToSteps: LocalizedText[];
  controlsDesktop: LocalizedText;
  controlsTouch: LocalizedText;
  controlsKeyboard: LocalizedText;
  chooseMode: LocalizedText;
  back: LocalizedText;
  loading: LocalizedText;
  loadError: LocalizedText;
  retry: LocalizedText;
  clickToAim: LocalizedText;
  tapToStart: LocalizedText;
  wave: LocalizedText;
  waveIncoming: LocalizedText;
  waveCleared: LocalizedText;
  robotsLeft: LocalizedText;
  score: LocalizedText;
  best: LocalizedText;
  shield: LocalizedText;
  combo: LocalizedText;
  reloading: LocalizedText;
  weaponName: LocalizedText;
  paused: LocalizedText;
  resume: LocalizedText;
  quit: LocalizedText;
  mute: LocalizedText;
  unmute: LocalizedText;
  pause: LocalizedText;
  fire: LocalizedText;
  /** Random cheer after a right answer */
  praise: LocalizedText[];
  /** Shown after a wrong answer; {picked} and {problem} are replaced */
  wrongAnswer: LocalizedText;
  hint: LocalizedText;
  aimForAnswer: LocalizedText;
  zapped: LocalizedText;
  victoryTitle: LocalizedText;
  victoryText: LocalizedText;
  defeatTitle: LocalizedText;
  defeatText: LocalizedText;
  accuracy: LocalizedText;
  solved: LocalizedText;
  waveReached: LocalizedText;
  newBest: LocalizedText;
  playAgain: LocalizedText;
  menu: LocalizedText;
  guestNote: LocalizedText;
}

export interface BlockProps {
  ui: UiTexts;
  modes: ModeConfig[];
  waves: WaveConfig[];
  settings: GameSettings;
  models: ModelUrls;
  /** Decorative holographic formulas floating in the hangar */
  decorFormulas: string[];
}

interface SaveData {
  best: { [modeId: string]: number };
  bestWave: { [modeId: string]: number };
  plays: number;
}

type Screen = 'loading' | 'title' | 'how' | 'modes' | 'play' | 'paused' | 'results';

const EMPTY_HUD: HudState = {
  wave: 0, waves: 0, robotsLeft: 0, score: 0, shield: 0, maxShield: 0, combo: 0, ammo: 0, magazine: 0, reloading: false, locked: false,
};

const isTouch = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const Block: React.FC<BlockProps> = (props) => {
  const mexty = useMexty();
  const { t } = useLanguage();
  const ui = props.ui;
  const [screen, setScreen] = useState<Screen>('loading');
  const [progress, setProgress] = useState(0);
  const [loadErr, setLoadErr] = useState(false);
  const [assets, setAssets] = useState<Assets | null>(null);
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [toast, setToast] = useState<Toast | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [locked, setLocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [guest, setGuest] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [touch] = useState(isTouch);
  const save = useCloudSave<SaveData>('progress', { best: {}, bestWave: {}, plays: 0 });

  const host = useRef<HTMLDivElement>(null);
  const crosshairRef = useRef<HTMLDivElement>(null);
  const damageRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLCanvasElement>(null);
  const arrowsRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const sfx = useMemo(() => new Sfx(), []);
  const modeRef = useRef<ModeConfig | null>(null);
  const screenRef = useRef<Screen>('loading');
  screenRef.current = screen;
  const tRef = useRef(t);
  tRef.current = t;
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const saveRef = useRef(save);
  saveRef.current = save;
  const toastKey = useRef(0);

  const hudRefs = () => ({ crosshair: crosshairRef.current, damage: damageRef.current, radar: radarRef.current, arrows: arrowsRef.current });

  const valid = !!(ui && props.models && props.modes && props.modes.length && props.waves && props.waves.length && props.settings);

  // first screen drawn → hide the store's loader
  useEffect(() => { mexty.ready(); }, []);
  useEffect(() => {
    mexty.getPlayer().then((p) => setGuest(p.isGuest)).catch(() => setGuest(true));
  }, []);

  // load models (Blender-made .glb files referenced by URL props)
  useEffect(() => {
    if (!valid) return;
    let alive = true;
    setLoadErr(false);
    loadAssets(props.models, (f) => alive && setProgress(f))
      .then((a) => { if (alive) { setAssets(a); setScreen((s) => (s === 'loading' ? 'title' : s)); } })
      .catch(() => { if (alive) setLoadErr(true); });
    return () => { alive = false; };
  }, [valid, attempt, props.models && props.models.arena, props.models && props.models.drone]);

  const showToast = (text: string, kind: Toast['kind']) => {
    toastKey.current++;
    setToast({ text, kind, key: toastKey.current });
  };

  const onEvent = useCallback((e: EngineEvent) => {
    const tt = tRef.current;
    const u = uiRef.current;
    if (e.type === 'correct') {
      const list = u.praise || [];
      const word = list.length ? tt(list[Math.floor(Math.random() * list.length)]) : '';
      showToast(word + '  ' + e.problem + ' = ' + e.answer + (e.combo > 1 ? '  x' + e.combo : ''), 'good');
    } else if (e.type === 'wrong') {
      const msg = tt(u.wrongAnswer).replace('{picked}', String(e.picked)).replace('{problem}', e.problem);
      showToast(msg + (e.hint ? '  ' + tt(u.hint) : ''), 'bad');
    } else if (e.type === 'body') {
      showToast(tt(u.aimForAnswer), 'info');
    } else if (e.type === 'zapped') {
      showToast(tt(u.zapped), 'bad');
    } else if (e.type === 'lockLost') {
      if (screenRef.current === 'play' && engine.current) {
        engine.current.setPaused(true);
        setScreen('paused');
      }
    } else if (e.type === 'waveStart') {
      toastKey.current++;
      setBanner({ title: tt(u.wave) + ' ' + e.wave, sub: tt(u.waveIncoming), kind: 'wave', key: toastKey.current });
      mexty.progress.level(e.wave);
    } else if (e.type === 'waveCleared') {
      toastKey.current++;
      setBanner({ title: tt(u.waveCleared), sub: '', kind: 'clear', key: toastKey.current });
    } else if (e.type === 'end') {
      const mode = modeRef.current;
      const sv = saveRef.current.value;
      const id = mode ? mode.id : 'mode';
      const prevBest = sv.best[id] || 0;
      const newBest = e.score > prevBest;
      const best = Object.assign({}, sv.best);
      const bestWave = Object.assign({}, sv.bestWave);
      if (newBest) best[id] = e.score;
      bestWave[id] = Math.max(bestWave[id] || 0, e.wave);
      saveRef.current.save({ best, bestWave, plays: (sv.plays || 0) + 1 });
      mexty.progress.complete(e.correct, Math.max(1, e.answered));
      mexty.gameplayStop();
      mexty.leaderboard.submit('main', e.score).catch(() => undefined);
      if (e.victory) mexty.celebrate();
      window.setTimeout(() => {
        setResult({ victory: e.victory, score: e.score, wave: e.wave, correct: e.correct, answered: e.answered, newBest });
        setScreen('results');
      }, 1300);
    }
  }, []);

  const makeEngine = useCallback(() => {
    if (!assets || !host.current) return null;
    if (engine.current) engine.current.dispose();
    engine.current = null;
    let e: Engine;
    try {
      e = new Engine(host.current, assets, {
      ops: modeRef.current ? modeRef.current.ops : ['add', 'sub', 'mul', 'div'],
      waves: props.waves,
      settings: props.settings,
      touch,
      reducedMotion: reducedMotion(),
      holoFormulas: props.decorFormulas || [],
      sfx,
      hud: hudRefs(),
      onHud: setHud,
      onEvent,
      onLock: setLocked,
      onAnswer: (questionId, question, correct) => mexty.progress.answer({ questionId, question, correct }),
      });
    } catch (err) {
      console.error(err);
      setLoadErr(true);
      setScreen('loading');
      return null;
    }
    engine.current = e;
    if ((window as any).__MSB_DEBUG__) (window as any).__msbEngine = e;
    return e;
  }, [assets, props.waves, props.settings, props.decorFormulas, touch]);

  // attract-mode engine behind the title / menus
  useEffect(() => {
    if (assets && !engine.current) makeEngine();
  }, [assets]);

  useEffect(() => () => {
    if (engine.current) engine.current.dispose();
    engine.current = null;
    sfx.dispose();
  }, []);

  // store pause (time limit, hidden tab) and mute
  useEffect(() => {
    const off1 = mexty.onPause((p) => {
      if (!engine.current) return;
      if (p && screenRef.current === 'play') {
        engine.current.setPaused(true);
        setScreen('paused');
      }
      if (p) sfx.suspend();
    });
    const off2 = mexty.onMute((m) => sfx.setMuted(m || muted));
    return () => { off1(); off2(); };
  }, [muted]);
  useEffect(() => { sfx.setMuted(muted || mexty.muted); }, [muted, mexty.muted]);

  // keyboard pause
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.code === 'Escape' || ev.code === 'KeyP') && screenRef.current === 'play' && engine.current) {
        engine.current.setPaused(true);
        setScreen('paused');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the HUD is mounted only while playing: hand its elements to the engine
  useEffect(() => {
    if (engine.current && (screen === 'play' || screen === 'paused')) {
      engine.current.setHud(hudRefs());
    }
  }, [screen]);

  const startMode = (m: ModeConfig) => {
    modeRef.current = m;
    sfx.unlock();
    sfx.ui();
    const e = engine.current && engine.current.isAttract() ? engine.current : makeEngine();
    setScreen('play');
    setResult(null);
    setToast(null);
    window.setTimeout(() => {
      if (!e) return;
      e.setHud(hudRefs());
      e.start(m.ops);
      if (!touch) e.requestLock();
      mexty.gameplayStart();
    }, 0);
  };

  const resume = () => {
    sfx.ui();
    setScreen('play');
    if (engine.current) {
      engine.current.setPaused(false);
      if (!touch) engine.current.requestLock();
    }
  };

  const toMenu = () => {
    sfx.ui();
    mexty.gameplayStop();
    makeEngine();
    setScreen('title');
  };

  const toggleMute = () => setMuted((m) => !m);

  if (!valid) return <div className="msb" style={{ height: '100%', minHeight: '100vh', background: '#02050a' }} />;

  const playing = screen === 'play' || screen === 'paused';
  return (
    <div className="msb" style={{ height: '100%', minHeight: '100vh' }} onContextMenu={(e) => e.preventDefault()}>
      <style>{CSS}</style>
      <div className="msb-canvas" ref={host} />
      {screen === 'loading' && (
        <Loading ui={ui} t={t} progress={progress} error={loadErr} onRetry={() => setAttempt((a) => a + 1)} />
      )}
      {screen === 'title' && <Title ui={ui} t={t} onPlay={() => { sfx.unlock(); sfx.ui(); setScreen('modes'); }} onHow={() => { sfx.ui(); setScreen('how'); }} />}
      {screen === 'how' && <HowTo ui={ui} t={t} touch={touch} onBack={() => setScreen('title')} />}
      {screen === 'modes' && (
        <ModeSelect ui={ui} t={t} modes={props.modes} best={save.value.best || {}} onPick={startMode} onBack={() => setScreen('title')} />
      )}
      {playing && (
        <>
          {touch && screen === 'play' && (
            <TouchControls
              fireLabel={t(ui.fire)}
              onMove={(x, y) => engine.current && engine.current.setMove(x, y)}
              onLook={(dx, dy) => engine.current && engine.current.look(dx, dy)}
              onTapFire={(x, y) => engine.current && engine.current.fireAtScreen(x, y)}
              onFire={() => engine.current && engine.current.fireCenter()}
            />
          )}
          <Hud
            hud={hud} ui={ui} t={t} muted={muted || mexty.muted} touch={touch} toast={toast} banner={banner}
            showLockPrompt={screen === 'play' && !touch && !locked}
            onMute={toggleMute}
            onPause={() => { if (engine.current) engine.current.setPaused(true); setScreen('paused'); }}
            crosshairRef={crosshairRef} damageRef={damageRef} radarRef={radarRef} arrowsRef={arrowsRef}
          />
        </>
      )}
      {screen === 'paused' && <Pause ui={ui} t={t} muted={muted || mexty.muted} onResume={resume} onMute={toggleMute} onQuit={toMenu} />}
      {screen === 'results' && result && (
        <Results ui={ui} t={t} r={result} guest={guest} onAgain={() => { if (modeRef.current) { makeEngine(); startMode(modeRef.current); } }} onMenu={toMenu} />
      )}
    </div>
  );
};
