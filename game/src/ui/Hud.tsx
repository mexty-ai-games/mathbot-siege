import React from 'react';
import { HudState, LocalizedText, UiTexts } from '../types';

type T = (x: LocalizedText | undefined) => string;

export interface Toast { text: string; kind: 'good' | 'bad' | 'info'; key: number }
export interface Banner { title: string; sub: string; kind: 'wave' | 'clear'; key: number }

interface HudProps {
  hud: HudState;
  ui: UiTexts;
  t: T;
  muted: boolean;
  touch: boolean;
  toast: Toast | null;
  banner: Banner | null;
  showLockPrompt: boolean;
  onMute: () => void;
  onPause: () => void;
  crosshairRef: React.RefObject<HTMLDivElement | null>;
  damageRef: React.RefObject<HTMLDivElement | null>;
  radarRef: React.RefObject<HTMLCanvasElement | null>;
  arrowsRef: React.RefObject<HTMLDivElement | null>;
}

function Cells({ n, on, cls }: { n: number; on: number; cls: string }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < n; i++) out.push(<i key={i} className={i < on ? 'on' : ''} />);
  return <div className={cls} aria-hidden="true">{out}</div>;
}

export function Hud(p: HudProps) {
  const { hud, ui, t } = p;
  const low = hud.shield <= Math.max(1, Math.floor(hud.maxShield / 4));
  return (
    <div className={'msb-hud' + (p.touch ? ' msb-touchhud' : '')}>
      <div className="msb-dmg" ref={p.damageRef} />
      <div ref={p.arrowsRef} className="msb-layer" aria-hidden="true" />
      <div className="msb-cross" ref={p.crosshairRef} aria-hidden="true"><b className="t" /><b className="d" /><b className="l" /><b className="r" /><i /></div>

      <div className="msb-tl">
        <div className="msb-badge" aria-hidden="true">🛡️</div>
        <div className="msb-bars">
          <Cells n={hud.maxShield} on={hud.shield} cls={'msb-cells' + (low ? ' low' : '')} />
          <div className="msb-combo">
            <span>{t(ui.combo)} x{Math.max(1, hud.combo)}</span>
            {[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < hud.combo ? 'on' : ''} />)}
          </div>
        </div>
        <span className="msb-sr">{t(ui.shield)} {hud.shield} / {hud.maxShield}</span>
      </div>

      <div className="msb-tc">
        <div className="msb-wave">{t(ui.wave)} {hud.wave} / {hud.waves}</div>
        <div className="msb-left">🤖 {hud.robotsLeft} <span className="msb-sr">{t(ui.robotsLeft)}</span></div>
      </div>

      <div className="msb-tr">
        <div className="msb-score"><span className="msb-sr">{t(ui.score)}</span>{hud.score}<b aria-hidden="true">★</b></div>
        <button className="msb-ico" onClick={p.onMute} aria-label={p.muted ? t(ui.unmute) : t(ui.mute)}>{p.muted ? '🔇' : '🔊'}</button>
        <button className="msb-ico" onClick={p.onPause} aria-label={t(ui.pause)}>❚❚</button>
      </div>

      <div className="msb-br">
        <div className="msb-ammo">
          <div className="wn">{t(ui.weaponName)}</div>
          {hud.reloading
            ? <div className="rl">{t(ui.reloading)}</div>
            : <div className="am">{hud.ammo}<small>/ {hud.magazine}</small></div>}
        </div>
        <canvas className="msb-radar" ref={p.radarRef} width={124} height={124} aria-hidden="true" />
      </div>

      <div aria-live="polite" className="msb-layer">
        {p.toast && <div key={p.toast.key} className={'msb-toast ' + p.toast.kind}>{p.toast.text}</div>}
      </div>
      <div aria-live="assertive" className="msb-layer">
        {p.banner && (
          <div key={p.banner.key} className={'msb-banner' + (p.banner.kind === 'clear' ? ' clear' : '')}>
            <b>{p.banner.title}</b>
            {p.banner.sub && <small>{p.banner.sub}</small>}
          </div>
        )}
      </div>
      {p.showLockPrompt && <div className="msb-lock"><span>{t(p.touch ? ui.tapToStart : ui.clickToAim)}</span></div>}
    </div>
  );
}
