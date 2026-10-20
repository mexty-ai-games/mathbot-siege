import { EndlessConfig, RobotKind, WavePlan } from '../types';
import { shuffle } from '../math/problems';

/** Endless difficulty curve: more robots, new kinds over time, faster, more at once, a Titan boss every few waves. */
export function planWave(n: number, c: EndlessConfig): WavePlan {
  const boss = c.bossEvery > 0 && n % c.bossEvery === 0;
  const total = Math.min(c.maxRobots, Math.round(c.startRobots + c.robotsPerWave * (n - 1)));
  const grow = (from: number) => (n >= from ? Math.floor((n - from) / 2) + 1 : 0);
  let mechs = grow(c.mechFrom);
  let spiders = grow(c.spiderFrom);
  let scouts = grow(c.scoutFrom);
  // keep at least a third of the wave as easy drones
  const special = Math.max(0, total - Math.ceil(total / 3) - (boss ? 1 : 0));
  while (mechs + spiders + scouts > special) {
    if (mechs >= spiders && mechs >= scouts && mechs > 0) mechs--;
    else if (spiders >= scouts && spiders > 0) spiders--;
    else scouts--;
  }
  const drones = Math.max(1, total - mechs - spiders - scouts - (boss ? 1 : 0));
  const list: RobotKind[] = [];
  for (let i = 0; i < drones; i++) list.push('drone');
  for (let i = 0; i < mechs; i++) list.push('mech');
  for (let i = 0; i < spiders; i++) list.push('spider');
  for (let i = 0; i < scouts; i++) list.push('scout');
  const robots = shuffle(list);
  // an easy drone opens every wave; the boss arrives in the second half
  const firstDrone = robots.indexOf('drone');
  if (firstDrone > 0) { robots.splice(firstDrone, 1); robots.unshift('drone'); }
  if (boss) robots.splice(Math.max(1, Math.floor(robots.length / 2)), 0, 'titan');
  return {
    robots,
    boss,
    speed: Math.min(c.speedCap, c.speedStart + c.speedPerWave * (n - 1)),
    maxActive: Math.min(c.maxActiveCap, c.maxActiveStart + Math.floor((n - 1) / 2)),
  };
}
