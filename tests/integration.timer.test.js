import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeTime } from '../src/timeUtils.js';
import { createTimerEngine, TimerState } from '../src/timerEngine.js';

describe('Integration: timeUtils + timerEngine (real countdown via fake timers)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(0); // Date.now() = 0
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('ITC-01: valid input -> engine ticks and finishes', () => {
        const onTick = vi.fn();
        const onFinish = vi.fn();

        const engine = createTimerEngine({
            onTick,
            onFinish,
            now: () => Date.now(),
        });

        const norm = normalizeTime(0, 3);
        expect(norm.ok).toBe(true);
        engine.start(norm.totalSec);

        expect(engine.getState()).toBe(TimerState.Running);

        vi.advanceTimersByTime(3200);

        expect(engine.getState()).toBe(TimerState.Finished);
        expect(onFinish).toHaveBeenCalledTimes(1);

        expect(onTick.mock.calls.length).toBeGreaterThan(1);

        const lastCall = onTick.mock.calls.at(-1);
        expect(lastCall[0]).toBe(0);
    });

    it('ITC-02: invalid input -> start is not executed (rule: ok=false)', () => {
        const onFinish = vi.fn();
        const engine = createTimerEngine({ onFinish, now: () => Date.now() });

        const norm = normalizeTime('abc', '10');
        expect(norm.ok).toBe(false);

        vi.advanceTimersByTime(5000);
        expect(onFinish).not.toHaveBeenCalled();
        expect(engine.getState()).toBe(TimerState.Idle);
    });

    it('ITC-03: seconds normalization (61s) -> engine finishes after 61s', () => {
        const onFinish = vi.fn();
        const engine = createTimerEngine({ onFinish, now: () => Date.now() });

        const norm = normalizeTime(0, 61);
        expect(norm.ok).toBe(true);
        expect(norm.totalSec).toBe(61);

        engine.start(norm.totalSec);
        vi.advanceTimersByTime(61_200);

        expect(engine.getState()).toBe(TimerState.Finished);
        expect(onFinish).toHaveBeenCalledTimes(1);
    });
});
