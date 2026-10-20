import React, { useEffect, useRef } from 'react';
import { LocalizedText, ModeConfig, UiTexts } from '../types';

type T = (x: LocalizedText | undefined) => string;

const OP_SYMBOL: { [k: string]: string } = { add: '+', sub: '−', mul: '×', div: '÷' };

function useFocusFirst() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  return ref;
}

export function Logo({ ui, t }: { ui: UiTexts; t: T }) {
  const words = t(ui.title).split(' ');
  const l1 = words.slice(0, Math.max(1, words.length - 1)).join(' ');
  const l2 = words.length > 1 ? words[words.length - 1] : '';
  return (
    <div style={{ textAlign: 'center' }}>
      <h1 className="msb-logo" style={{ margin: 0 }}>
        <span className="l1">{l1}</span>
        {l2 && <span className="l2">{l2}</span>}
      </h1>
      <div className="msb-tag">{t(ui.subtitle)}</div>
    </div>
  );
}

export function Loading({ ui, t, progress, error, onRetry }: { ui: UiTexts; t: T; progress: number; error: boolean; onRetry: () => void }) {
  return (
    <div className="msb-menu" role="status">
      <Logo ui={ui} t={t} />
      {error ? (
        <>
          <p className="msb-p">{t(ui.loadError)}</p>
          <button className="msb-btn" onClick={onRetry}>{t(ui.retry)}</button>
        </>
      ) : (
        <>
          <div className="msb-bar" aria-hidden="true"><i style={{ width: Math.round(progress * 100) + '%' }} /></div>
          <p className="msb-p">{t(ui.loading)} {Math.round(progress * 100)}%</p>
        </>
      )}
    </div>
  );
}

export function Title({ ui, t, onPlay, onHow }: { ui: UiTexts; t: T; onPlay: () => void; onHow: () => void }) {
  const first = useFocusFirst();
  return (
    <div className="msb-menu" style={{ justifyContent: 'space-between', paddingTop: '6vh', paddingBottom: '6vh' }}>
      <Logo ui={ui} t={t} />
      <div className="msb-row">
        <button ref={first} className="msb-btn" onClick={onPlay}>{t(ui.play)}</button>
        <button className="msb-btn ghost" onClick={onHow}>{t(ui.howToPlay)}</button>
      </div>
    </div>
  );
}

export function HowTo({ ui, t, touch, onBack }: { ui: UiTexts; t: T; touch: boolean; onBack: () => void }) {
  const first = useFocusFirst();
  return (
    <div className="msb-menu dim">
      <div className="msb-card" role="dialog" aria-labelledby="msb-how">
        <h2 className="msb-h" id="msb-how">{t(ui.howToPlay)}</h2>
        <ol className="msb-steps">
          {(ui.howToSteps || []).map((s, i) => <li key={i}>{t(s)}</li>)}
        </ol>
        <p className="msb-p" style={{ marginTop: 12, opacity: 0.85 }}>🎮 {t(touch ? ui.controlsTouch : ui.controlsDesktop)}</p>
        {!touch && <p className="msb-p" style={{ opacity: 0.85 }}>⌨️ {t(ui.controlsKeyboard)}</p>}
      </div>
      <button ref={first} className="msb-btn" onClick={onBack}>{t(ui.back)}</button>
    </div>
  );
}

export function ModeSelect({ ui, t, modes, best, bestWave, onPick, onBack }: {
  ui: UiTexts; t: T; modes: ModeConfig[]; best: { [id: string]: number }; bestWave: { [id: string]: number };
  onPick: (m: ModeConfig) => void; onBack: () => void;
}) {
  const first = useFocusFirst();
  return (
    <div className="msb-menu dim">
      <h2 className="msb-h">{t(ui.chooseMode)}</h2>
      <div className="msb-modes">
        {modes.map((m, i) => (
          <button key={m.id} ref={i === 0 ? first : undefined} className="msb-mode" style={{ ['--c' as any]: m.color }} onClick={() => onPick(m)}>
            <span className="sym" aria-hidden="true">{(m.ops || []).map((o) => OP_SYMBOL[o]).join(' ')}</span>
            <span className="nm">{t(m.name)}</span>
            <span className="ds">{t(m.description)}</span>
            {best[m.id] ? <span className="bs">★ {t(ui.best)}: {best[m.id]} · {t(ui.bestWave)}: {bestWave[m.id] || 0}</span> : null}
          </button>
        ))}
      </div>
      <button className="msb-btn ghost" onClick={onBack}>{t(ui.back)}</button>
    </div>
  );
}

export function Pause({ ui, t, muted, onResume, onMute, onEndRun, onQuit }: {
  ui: UiTexts; t: T; muted: boolean; onResume: () => void; onMute: () => void; onEndRun: () => void; onQuit: () => void;
}) {
  const first = useFocusFirst();
  return (
    <div className="msb-menu dim" role="dialog" aria-label={t(ui.paused)}>
      <h2 className="msb-h">{t(ui.paused)}</h2>
      <button ref={first} className="msb-btn" onClick={onResume}>{t(ui.resume)}</button>
      <button className="msb-btn ghost" onClick={onMute}>{muted ? '🔇 ' + t(ui.unmute) : '🔊 ' + t(ui.mute)}</button>
      <button className="msb-btn ghost" onClick={onEndRun}>{t(ui.endRun)}</button>
      <button className="msb-btn ghost" onClick={onQuit}>{t(ui.quit)}</button>
    </div>
  );
}

export interface ResultData { score: number; wave: number; correct: number; answered: number; newBest: boolean }

export function Results({ ui, t, r, guest, onAgain, onMenu }: {
  ui: UiTexts; t: T; r: ResultData; guest: boolean; onAgain: () => void; onMenu: () => void;
}) {
  const first = useFocusFirst();
  const acc = r.answered ? Math.round((r.correct / r.answered) * 100) : 0;
  return (
    <div className="msb-menu dim">
      <div className="msb-card" role="dialog" aria-labelledby="msb-res">
        <h2 className="msb-h" id="msb-res" style={{ color: '#ffd84a' }}>{t(ui.defeatTitle)}</h2>
        <p className="msb-p">{t(ui.defeatText)}</p>
        <div className="msb-stats">
          <div className="msb-stat"><small>{t(ui.score)}</small><b>{r.score}</b></div>
          <div className="msb-stat"><small>{t(ui.waveReached)}</small><b>{r.wave}</b></div>
          <div className="msb-stat"><small>{t(ui.solved)}</small><b>{r.correct}</b></div>
          <div className="msb-stat"><small>{t(ui.accuracy)}</small><b>{acc}%</b></div>
        </div>
        {r.newBest && <p className="msb-p msb-new">★ {t(ui.newBest)} ★</p>}
        {guest && <p className="msb-note">{t(ui.guestNote)}</p>}
      </div>
      <div className="msb-row">
        <button ref={first} className="msb-btn" onClick={onAgain}>{t(ui.playAgain)}</button>
        <button className="msb-btn ghost" onClick={onMenu}>{t(ui.menu)}</button>
      </div>
    </div>
  );
}
