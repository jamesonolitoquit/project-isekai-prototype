/**
 * prng.ts — Seeded Pseudorandom Number Generator
 * 
 * Enables deterministic world simulation by replacing Math.random()
 * with a seeded Mulberry32 algorithm. All randomness tied to worldState.seed.
 */

/**
 * Mulberry32 — a simple, fast seeded PRNG
 * Returns a function that generates pseudo-random floats in [0, 1)
 */
export function mulberry32(a: number) {
  return function() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/**
 * Seeded Random Number Generator wrapper
 * Maintains state and provides convenience methods
 */
export class SeededRng {
  private generator: () => number;
  private seed: number;

  constructor(initialSeed: number = 12345) {
    this.seed = initialSeed;
    this.generator = mulberry32(this.seed);
  }

  /**
   * Generate a random float in [0, 1)
   */
  next(): number {
    return this.generator();
  }

  /**
   * Generate a random integer in [min, max] (inclusive)
   */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * Generate a random float in [min, max]
   */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Pick a random element from an array
   */
  pick<T>(array: T[]): T {
    if (array.length === 0) throw new Error('Cannot pick from empty array');
    return array[this.nextInt(0, array.length - 1)];
  }

  /**
   * Shuffle an array in-place using Fisher-Yates
   */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Get current seed (for debugging/logging)
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Reseed the generator
   */
  reseed(newSeed: number): void {
    this.seed = newSeed;
    this.generator = mulberry32(this.seed);
  }
}

/**
 * Global PRNG instance from WorldState seed
 * This is injected by the world controller and used by all gameplay systems
 */
let globalRng: SeededRng | null = null;

export function setGlobalRng(rng: SeededRng): void {
  globalRng = rng;
}

export function getGlobalRng(): SeededRng {
  if (!globalRng) {
    throw new Error('Global RNG not initialized. Call setGlobalRng(rng) from world controller.');
  }
  return globalRng;
}

/**
 * Convenience export: use this in place of Math.random()
 */
export function random(): number {
  return getGlobalRng().next();
}

/**
 * Convenience export: seeded Date.now() replacement
 * Returns deterministic tick-based time, not wall-clock time
 */
export function seededNow(worldTick: number): number {
  // Use worldTick as a deterministic time source
  // Multiply by 10 to simulate milliseconds (1 tick = 10ms equiv)
  return worldTick * 10;
}
