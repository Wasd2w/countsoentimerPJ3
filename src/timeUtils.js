export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

export function parseIntStrict(value) {
    const s = String(value ?? '').trim();
    if (s === '') return null;
    if (!/^[+-]?\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
}

export function normalizeTime(minutesInput, secondsInput, opts = { maxMinutes: 999 }) {
    const maxMinutes = opts?.maxMinutes ?? 999;

    const mi = parseIntStrict(minutesInput);
    const si = parseIntStrict(secondsInput);

    if (mi === null && String(minutesInput ?? '').trim() !== '') {
        return { ok: false, m: 0, s: 0, totalSec: 0, error: 'minutes' };
    }
    if (si === null && String(secondsInput ?? '').trim() !== '') {
        return { ok: false, m: 0, s: 0, totalSec: 0, error: 'seconds' };
    }

    let m = Math.max(0, mi ?? 0);
    let s = Math.max(0, si ?? 0);

    if (s >= 60) {
        m += Math.floor(s / 60);
        s = s % 60;
    }

    m = clamp(m, 0, maxMinutes);
    const totalSec = m * 60 + s;

    return { ok: true, m, s, totalSec, error: null };
}

export function formatHMS(totalSec) {
    const sec = Math.max(0, Math.trunc(totalSec ?? 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const pad = (x) => String(x).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function escapeHtml(str) {
    const s = String(str ?? '');
    return s.replace(/[&<>"'`]/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;', '`':'&#96;'
    }[ch]));
}
