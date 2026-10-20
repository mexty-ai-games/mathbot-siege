import React, { useRef } from 'react';

interface Props {
  fireLabel: string;
  onMove: (x: number, y: number) => void;
  onLook: (dx: number, dy: number) => void;
  onTapFire: (x: number, y: number) => void;
  onFire: () => void;
}

/** Left: move stick. Right: drag to look, quick tap to shoot where you tap. Fire button shoots at the crosshair. */
export function TouchControls(p: Props) {
  const stick = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLElement>(null);
  const stickId = useRef<number | null>(null);
  const looks = useRef<{ [id: number]: { x: number; y: number; sx: number; sy: number; t: number; moved: boolean } }>({});

  const setKnob = (x: number, y: number) => {
    if (knob.current) knob.current.style.transform = 'translate(' + x * 38 + 'px,' + y * 38 + 'px)';
  };

  const stickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId || !stick.current) return;
    const r = stick.current.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.sqrt(x * x + y * y);
    if (l > 1) { x /= l; y /= l; }
    setKnob(x, y);
    p.onMove(x, -y);
  };
  const stickEnd = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    setKnob(0, 0);
    p.onMove(0, 0);
  };

  return (
    <>
      <div
        className="msb-look"
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          looks.current[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
        }}
        onPointerMove={(e) => {
          const s = looks.current[e.pointerId];
          if (!s) return;
          p.onLook(e.clientX - s.x, e.clientY - s.y);
          s.x = e.clientX;
          s.y = e.clientY;
          if (Math.abs(e.clientX - s.sx) + Math.abs(e.clientY - s.sy) > 14) s.moved = true;
        }}
        onPointerUp={(e) => {
          const s = looks.current[e.pointerId];
          delete looks.current[e.pointerId];
          if (s && !s.moved && performance.now() - s.t < 300) p.onTapFire(e.clientX, e.clientY);
        }}
        onPointerCancel={(e) => { delete looks.current[e.pointerId]; }}
      />
      <div
        className="msb-stick"
        ref={stick}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          stickId.current = e.pointerId;
          stickMove(e);
        }}
        onPointerMove={stickMove}
        onPointerUp={stickEnd}
        onPointerCancel={stickEnd}
        aria-hidden="true"
      >
        <i ref={knob} />
      </div>
      <button className="msb-fire" onPointerDown={(e) => { e.preventDefault(); p.onFire(); }} aria-label={p.fireLabel}>{p.fireLabel}</button>
    </>
  );
}
