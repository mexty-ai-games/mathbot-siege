import React from 'react';

const SYM: { [k: string]: string } = { add: '+', sub: '−', mul: '×', div: '÷' };

function answer(op: string, a: number, b: number) {
  return op === 'add' ? a + b : op === 'sub' ? a - b : op === 'mul' ? a * b : Math.floor(a / Math.max(1, b));
}

/** Pictures that make the operation visible: number line (+), take-away (−), arrays (×), sharing into groups (÷). */
export function LessonVisual({ op, a, b }: { op: string; a: number; b: number }) {
  const ans = answer(op, a, b);
  const eq = a + ' ' + SYM[op] + ' ' + b + ' = ' + ans;
  let body: React.ReactNode = null;
  if (op === 'add') {
    const max = Math.max(1, Math.min(20, a + b));
    const W = 320;
    const x = (n: number) => 14 + (n / max) * (W - 28);
    const ticks: React.ReactNode[] = [];
    for (let i = 0; i <= max; i++) {
      ticks.push(<line key={'t' + i} x1={x(i)} x2={x(i)} y1={70} y2={i % 5 === 0 ? 80 : 76} stroke="#5fd8ff" strokeWidth={1.5} />);
      if (i % 5 === 0 || i === a || i === a + b) ticks.push(<text key={'n' + i} x={x(i)} y={95} fill="#bfefff" fontSize={11} textAnchor="middle">{i}</text>);
    }
    body = (
      <svg viewBox={'0 0 ' + W + ' 104'} className="msb-lviz" role="img" aria-label={eq}>
        <line x1={x(0)} x2={x(max)} y1={70} y2={70} stroke="#5fd8ff" strokeWidth={2} />
        {ticks}
        <path d={'M' + x(0) + ' 68 Q' + (x(0) + x(a)) / 2 + ' ' + 14 + ' ' + x(a) + ' 68'} fill="none" stroke="#3ad7ff" strokeWidth={3} />
        <text x={(x(0) + x(a)) / 2} y={34} fill="#3ad7ff" fontSize={14} fontWeight={900} textAnchor="middle">+{a}</text>
        <path d={'M' + x(a) + ' 68 Q' + (x(a) + x(a + b)) / 2 + ' ' + 30 + ' ' + x(a + b) + ' 68'} fill="none" stroke="#ffd84a" strokeWidth={3} />
        <text x={(x(a) + x(a + b)) / 2} y={46} fill="#ffd84a" fontSize={14} fontWeight={900} textAnchor="middle">+{b}</text>
        <circle cx={x(a + b)} cy={70} r={6} fill="#7dffb2" />
      </svg>
    );
  } else if (op === 'sub') {
    const n = Math.min(20, a);
    const dots: React.ReactNode[] = [];
    for (let i = 0; i < n; i++) {
      const cx = 18 + (i % 10) * 30;
      const cy = 26 + Math.floor(i / 10) * 34;
      const gone = i >= n - b;
      dots.push(<circle key={i} cx={cx} cy={cy} r={11} fill={gone ? 'none' : '#7dff8a'} stroke={gone ? '#ff6a5a' : 'none'} strokeWidth={2} />);
      if (gone) dots.push(<path key={'x' + i} d={'M' + (cx - 8) + ' ' + (cy - 8) + 'L' + (cx + 8) + ' ' + (cy + 8) + 'M' + (cx + 8) + ' ' + (cy - 8) + 'L' + (cx - 8) + ' ' + (cy + 8)} stroke="#ff6a5a" strokeWidth={2.5} />);
    }
    body = <svg viewBox="0 0 310 80" className="msb-lviz" role="img" aria-label={eq}>{dots}</svg>;
  } else if (op === 'mul') {
    const rows = Math.min(10, a);
    const cols = Math.min(12, b);
    const s = Math.min(22, 240 / Math.max(rows, cols));
    const dots: React.ReactNode[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) dots.push(<circle key={r + '_' + c} cx={30 + c * s} cy={14 + r * s} r={s * 0.36} fill={r % 2 ? '#ff8a6a' : '#ff5a3c'} />);
      dots.push(<text key={'r' + r} x={12} y={18 + r * s} fill="#bfefff" fontSize={10} textAnchor="middle">{(r + 1) * cols}</text>);
    }
    body = <svg viewBox={'0 0 ' + (40 + cols * s) + ' ' + (10 + rows * s)} className="msb-lviz" role="img" aria-label={eq}>{dots}</svg>;
  } else {
    const groups = Math.max(1, Math.min(6, b));
    const per = Math.min(12, ans);
    const gw = 300 / groups;
    const els: React.ReactNode[] = [];
    for (let g = 0; g < groups; g++) {
      els.push(<rect key={'g' + g} x={g * gw + 4} y={4} width={gw - 8} height={84} rx={10} fill="none" stroke="#ffb020" strokeWidth={2} strokeDasharray="5 4" />);
      for (let i = 0; i < per; i++) {
        const cols = Math.max(1, Math.floor((gw - 16) / 16));
        els.push(<circle key={g + '_' + i} cx={g * gw + 16 + (i % cols) * 16} cy={20 + Math.floor(i / cols) * 16} r={6} fill="#ffb020" />);
      }
    }
    body = <svg viewBox="0 0 300 92" className="msb-lviz" role="img" aria-label={eq}>{els}</svg>;
  }
  return (
    <div className="msb-lvizbox">
      {body}
      <div className="msb-leq" aria-hidden="true">{eq}</div>
    </div>
  );
}
