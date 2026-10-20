import React, { useEffect, useRef, useState } from 'react';
import { HudState, LessonConfig, LocalizedText, UiTexts, UpgradeConfig, WeaponConfig } from '../types';
import { LessonVisual } from './LessonVisual';

type T = (x: LocalizedText | undefined) => string;

const range = (n: number) => { const a: number[] = []; for (let i = 0; i < n; i++) a.push(i); return a; };

interface Props {
  ui: UiTexts;
  t: T;
  /** 0 = briefing before wave 1 */
  wave: number;
  hud: HudState;
  weapons: WeaponConfig[];
  upgrades: UpgradeConfig[];
  lesson: LessonConfig | null;
  price: (kind: 'weapon' | 'upgrade', id: string) => number;
  onBuy: (kind: 'weapon' | 'upgrade', id: string) => void;
  onEquip: (id: string) => void;
  onHideLessons: () => void;
  onNext: () => void;
  onEndRun: () => void;
}

/** Between waves: a skippable lesson, then the shop (unlock weapons, buy upgrades with cores), then the next wave. */
export function Intermission(p: Props) {
  const { ui, t, hud } = p;
  const [showLesson, setShowLesson] = useState(!!p.lesson);
  const next = useRef<HTMLButtonElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  useEffect(() => { setShowLesson(!!p.lesson); }, [p.wave, !!p.lesson]);
  useEffect(() => {
    const el = showLesson ? skip.current : next.current;
    if (el) el.focus();
  }, [showLesson]);

  const title = p.wave === 0 ? t(ui.briefing) : t(ui.wave) + ' ' + p.wave + ' — ' + t(ui.waveCleared);
  const nextLabel = p.wave === 0 ? t(ui.startRun) : t(ui.nextWave) + ' ' + (p.wave + 1);

  if (showLesson && p.lesson) {
    const l = p.lesson;
    return (
      <div className="msb-menu dim">
        <div className="msb-card msb-lesson" role="dialog" aria-labelledby="msb-lt">
          <div className="msb-kicker">{title}</div>
          <h2 className="msb-h" id="msb-lt">📘 {t(ui.lesson)}: {t(l.title)}</h2>
          <LessonVisual op={l.op} a={l.a} b={l.b} />
          {l.lines.map((line, i) => <p key={i} className="msb-p">{t(line)}</p>)}
        </div>
        <div className="msb-row">
          <button ref={skip} className="msb-btn" onClick={() => setShowLesson(false)}>{t(ui.skipLesson)}</button>
          <button className="msb-btn ghost" onClick={() => { p.onHideLessons(); setShowLesson(false); }}>{t(ui.hideLessons)}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="msb-menu dim msb-inter">
      <div className="msb-kicker">{title}</div>
      <div className="msb-shophead">
        <h2 className="msb-h" style={{ margin: 0 }}>{t(ui.shop)}</h2>
        <div className="msb-wallet" aria-label={t(ui.cores) + ' ' + hud.cores}>{hud.cores} <b>◆</b></div>
      </div>
      <p className="msb-note" style={{ margin: 0 }}>{t(ui.shopHint)}</p>
      <div className="msb-shop">
        {p.weapons.map((w) => {
          const owned = hud.unlocked.indexOf(w.id) >= 0;
          const cost = p.price('weapon', w.id);
          const equipped = hud.weapon === w.id;
          return (
            <div key={w.id} className={'msb-item' + (owned ? ' owned' : '')} style={{ ['--c' as any]: w.color }}>
              <div className="nm">{t(w.name)}</div>
              <div className="ds">{t(w.description)}</div>
              {owned ? (
                <button className="msb-buy ghost" disabled={equipped} onClick={() => p.onEquip(w.id)}>{equipped ? t(ui.equipped) : t(ui.equip)}</button>
              ) : (
                <button className="msb-buy" disabled={cost > hud.cores} onClick={() => p.onBuy('weapon', w.id)}>{t(ui.unlock)} · {cost} ◆</button>
              )}
            </div>
          );
        })}
        {p.upgrades.map((u) => {
          const lvl = hud.levels[u.id] || 0;
          const cost = p.price('upgrade', u.id);
          return (
            <div key={u.id} className="msb-item up">
              <div className="nm"><span aria-hidden="true">{u.icon}</span> {t(u.name)}</div>
              <div className="ds">{t(u.description)}</div>
              {u.maxLevel > 0 && u.id !== 'repair' && (
                <div className="pips" aria-label={t(ui.level) + ' ' + lvl + ' / ' + u.maxLevel}>
                  {range(u.maxLevel).map((i) => <i key={i} className={i < lvl ? 'on' : ''} />)}
                </div>
              )}
              <button className="msb-buy" disabled={cost < 0 || cost > hud.cores} onClick={() => p.onBuy('upgrade', u.id)}>
                {cost < 0 ? t(ui.maxed) : cost + ' ◆'}
              </button>
            </div>
          );
        })}
      </div>
      <div className="msb-row">
        <button ref={next} className="msb-btn" onClick={p.onNext}>{nextLabel} ▶</button>
        {p.wave > 0 && <button className="msb-btn ghost" onClick={p.onEndRun}>{t(ui.endRun)}</button>}
      </div>
    </div>
  );
}
