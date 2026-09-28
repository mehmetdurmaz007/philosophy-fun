import type { QuestionnaireItem } from './types'

function hashSeed(seed: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rngFromSeed(seed: string) {
  let a = hashSeed(seed) || 0x9e3779b9
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function interleavedOrder(items: QuestionnaireItem[], seed: string): string[] {
  const rng = rngFromSeed(seed)
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  // Greedily avoid adjacent items from the same construct when alternatives exist.
  for (let i = 1; i < shuffled.length; i++) {
    if (shuffled[i].construct_id === shuffled[i - 1].construct_id) {
      const swap = shuffled.findIndex((x, idx) => idx > i && x.construct_id !== shuffled[i - 1].construct_id)
      if (swap > i) [shuffled[i], shuffled[swap]] = [shuffled[swap], shuffled[i]]
    }
  }
  return shuffled.map(x => x.item_id)
}
