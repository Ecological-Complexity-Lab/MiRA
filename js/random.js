/**
 * random.js — Seeded pseudo-random numbers (mulberry32).
 *
 * The same seed always gives the same sequence, so layouts computed with a
 * seed are reproducible (e.g. plots built from R code).
 */

const MULBERRY_INCREMENT = 0x6D2B79F5;
const UINT32_RANGE = 4294967296; // 2^32

/**
 * @param {number} seed  Any integer
 * @returns {() => number}  Function returning numbers in [0, 1), like Math.random
 */
export function createSeededRandom(seed) {
    let state = seed >>> 0;
    return function seededRandom() {
        state = (state + MULBERRY_INCREMENT) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
    };
}
