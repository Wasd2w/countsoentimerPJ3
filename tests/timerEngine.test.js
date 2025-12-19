import { describe, it, expect } from 'vitest';
import { computeRemainingSec } from '../src/timerEngine.js';

describe('computeRemainingSec (R1.2: drift-free відлік)', () => {
    it('використовує ceil правило', () => {
        const end = 10_000;

        expect(computeRemainingSec(end, 9_001)).toBe(1);

        expect(computeRemainingSec(end, 9_000)).toBe(1);

        expect(computeRemainingSec(end, 8_999)).toBe(2);
    });

    it('ніколи не повертає від’ємне', () => {
        expect(computeRemainingSec(10_000, 10_000)).toBe(0);
        expect(computeRemainingSec(10_000, 12_000)).toBe(0);
    });
});
