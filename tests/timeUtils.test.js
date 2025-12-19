import { describe, it, expect } from 'vitest';
import { parseIntStrict, normalizeTime, formatHMS } from '../src/timeUtils.js';

describe('parseIntStrict (R1.8: валідація вводу)', () => {
    it('повертає null для порожніх значень', () => {
        expect(parseIntStrict('')).toBeNull();
        expect(parseIntStrict('   ')).toBeNull();
        expect(parseIntStrict(null)).toBeNull();
        expect(parseIntStrict(undefined)).toBeNull();
    });

    it('парсить цілі числа з пробілами', () => {
        expect(parseIntStrict(' 5 ')).toBe(5);
        expect(parseIntStrict('-3')).toBe(-3);
        expect(parseIntStrict('+7')).toBe(7);
    });

    it('відхиляє дробові/наукові/нечислові формати', () => {
        expect(parseIntStrict('5.5')).toBeNull();
        expect(parseIntStrict('1e3')).toBeNull();
        expect(parseIntStrict('abc')).toBeNull();
        expect(parseIntStrict('12 3')).toBeNull();
    });
});

describe('normalizeTime (R1.1, R1.8: нормалізація часу)', () => {
    it('нормалізує seconds>=60, переносить у хвилини', () => {
        const r = normalizeTime(0, 60);
        expect(r.ok).toBe(true);
        expect(r.m).toBe(1);
        expect(r.s).toBe(0);
        expect(r.totalSec).toBe(60);

        const r2 = normalizeTime(0, 61);
        expect(r2.ok).toBe(true);
        expect(r2.m).toBe(1);
        expect(r2.s).toBe(1);
        expect(r2.totalSec).toBe(61);

        const r3 = normalizeTime(0, 3599);
        expect(r3.ok).toBe(true);
        expect(r3.m).toBe(59);
        expect(r3.s).toBe(59);
        expect(r3.totalSec).toBe(3599);
    });

    it('від’ємні значення -> 0', () => {
        const r = normalizeTime(-5, -1);
        expect(r.ok).toBe(true);
        expect(r.m).toBe(0);
        expect(r.s).toBe(0);
        expect(r.totalSec).toBe(0);
    });

    it('некоректний НЕпорожній ввід -> ok=false (помилка)', () => {
        const r1 = normalizeTime('abc', '10');
        expect(r1.ok).toBe(false);
        expect(r1.error).toBe('minutes');

        const r2 = normalizeTime('10', 'abc');
        expect(r2.ok).toBe(false);
        expect(r2.error).toBe('seconds');
    });

    it('порожні поля трактуються як 0', () => {
        const r = normalizeTime('', '');
        expect(r.ok).toBe(true);
        expect(r.totalSec).toBe(0);
    });

    it('обмежує minutes до 999 (за замовчуванням)', () => {
        const r = normalizeTime(2000, 0);
        expect(r.ok).toBe(true);
        expect(r.m).toBe(999);
        expect(r.s).toBe(0);
    });
});

describe('formatHMS (R1.1: відображення часу)', () => {
    it('форматує значення у HH:MM:SS', () => {
        expect(formatHMS(0)).toBe('00:00:00');
        expect(formatHMS(70)).toBe('00:01:10');
        expect(formatHMS(3600)).toBe('01:00:00');
        expect(formatHMS(3661)).toBe('01:01:01');
    });

    it('від’ємне -> 00:00:00', () => {
        expect(formatHMS(-1)).toBe('00:00:00');
    });
});
