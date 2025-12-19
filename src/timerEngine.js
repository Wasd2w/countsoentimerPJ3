export const TimerState = Object.freeze({
    Idle: 'Idle',
    Running: 'Running',
    Paused: 'Paused',
    Finished: 'Finished',
});

export function computeRemainingSec(endTimeMs, nowMs) {
    const rem = Math.ceil((endTimeMs - nowMs) / 1000);
    return Math.max(0, rem);
}

export function createTimerEngine({ onTick, onFinish, now = () => Date.now() }) {
    let state = TimerState.Idle;
    let initialSec = 0;
    let remainingSec = 0;
    let endTimeMs = 0;
    let handle = null;

    function stopInterval() {
        if (handle) clearInterval(handle);
        handle = null;
    }

    function tick() {
        if (state !== TimerState.Running) return;
        remainingSec = computeRemainingSec(endTimeMs, now());
        if (remainingSec <= 0) {
            stopInterval();
            state = TimerState.Finished;
            remainingSec = 0;
            onTick?.(remainingSec, state);
            onFinish?.();
            return;
        }
        onTick?.(remainingSec, state);
    }

    function start(totalSec) {
        stopInterval();
        state = TimerState.Running;
        initialSec = Math.max(0, Math.trunc(totalSec));
        remainingSec = initialSec;
        endTimeMs = now() + initialSec * 1000;
        onTick?.(remainingSec, state);
        handle = setInterval(tick, 200);
        tick();
    }

    function pause() {
        if (state !== TimerState.Running) return;
        stopInterval();
        state = TimerState.Paused;
        onTick?.(remainingSec, state);
    }

    function resume() {
        if (state !== TimerState.Paused) return;
        state = TimerState.Running;
        endTimeMs = now() + remainingSec * 1000;
        handle = setInterval(tick, 200);
        tick();
    }

    function stop(newIdleRemainingSec = 0) {
        stopInterval();
        state = TimerState.Idle;
        initialSec = Math.max(0, Math.trunc(newIdleRemainingSec));
        remainingSec = initialSec;
        onTick?.(remainingSec, state);
    }

    function restart(totalSec) {
        start(totalSec);
    }

    function getState() { return state; }
    function getRemainingSec() { return remainingSec; }
    function getInitialSec() { return initialSec; }

    return { start, pause, resume, stop, restart, getState, getRemainingSec, getInitialSec };
}
