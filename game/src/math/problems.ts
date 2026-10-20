import { NumberSettings, Op } from '../types';

export interface Problem {
  /** Text with real math symbols, e.g. "7 × 6" */
  text: string;
  answer: number;
  op: Op;
  a: number;
  b: number;
}

const SYMBOL: { [k: string]: string } = { add: '+', sub: '−', mul: '×', div: '÷' };

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Number limits grow with the wave and with harder robots (tier 0..2). */
export function makeProblem(ops: Op[], wave: number, tier: number, n: NumberSettings): Problem {
  const op = ops[Math.floor(Math.random() * ops.length)] || 'add';
  const addMax = Math.min(n.addMaxCap, n.addMaxStart + n.addMaxStep * (wave - 1 + tier * 2));
  const mulMax = Math.min(n.mulMaxCap, n.mulMaxStart + Math.floor((wave - 1) * 0.8) + tier * 2);
  let a = 0;
  let b = 0;
  let answer = 0;
  if (op === 'add') {
    a = rand(1, addMax);
    b = rand(1, addMax);
    answer = a + b;
  } else if (op === 'sub') {
    a = rand(2, addMax);
    b = rand(1, a);
    answer = a - b;
  } else if (op === 'mul') {
    a = rand(2, mulMax);
    b = rand(2, mulMax);
    answer = a * b;
  } else {
    b = rand(2, mulMax);
    answer = rand(2, mulMax);
    a = b * answer;
  }
  return { text: a + ' ' + SYMBOL[op] + ' ' + b, answer, op, a, b };
}

/** Plausible wrong answers: off-by-one, neighbours in the times table, swapped digits… all distinct, never negative. */
export function distractors(p: Problem, count: number): number[] {
  const out: number[] = [];
  const push = (v: number) => {
    if (v >= 0 && v !== p.answer && out.indexOf(v) < 0 && out.length < count) out.push(v);
  };
  const cands: number[] = [];
  if (p.op === 'mul') {
    cands.push(p.answer + p.a, p.answer - p.a, p.answer + p.b, p.answer - p.b, p.a + p.b, p.answer + 1, p.answer - 1);
  } else if (p.op === 'div') {
    cands.push(p.answer + 1, p.answer - 1, p.answer + 2, p.b, p.a - p.b, p.answer * 2);
  } else if (p.op === 'add') {
    cands.push(p.answer + 1, p.answer - 1, p.answer + 10, p.answer - 10, p.answer + 2, Math.abs(p.a - p.b));
  } else {
    cands.push(p.answer + 1, p.answer - 1, p.answer + 10, p.a + p.b, p.answer + 2, p.answer - 2);
  }
  if (p.answer >= 10) {
    const s = String(p.answer);
    push(parseInt(s.split('').reverse().join(''), 10));
  }
  // shuffle candidates so the same trap is not always on the same panel
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = cands[i];
    cands[i] = cands[j];
    cands[j] = t;
  }
  for (let i = 0; i < cands.length; i++) push(cands[i]);
  let spread = 3;
  while (out.length < count) {
    push(p.answer + rand(-spread, spread));
    spread++;
  }
  return out;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
