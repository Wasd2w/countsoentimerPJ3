import { clamp } from './timeUtils.js';

export const LS_KEYS = Object.freeze({
    presets: 'countdown.presets.v1',
    lastSettings: 'countdown.lastSettings.v1',
});

export function safeJsonParse(raw, fallback) {
    try { return JSON.parse(raw); } catch { return fallback; }
}

export function loadPresets(storage = localStorage) {
    const raw = storage.getItem(LS_KEYS.presets);
    if (!raw) return [];
    const arr = safeJsonParse(raw, []);
    if (!Array.isArray(arr)) return [];
    return arr
        .filter(p => p && typeof p === 'object')
        .map(p => ({
            id: String(p.id ?? crypto.randomUUID()),
            name: String(p.name ?? ''),
            durationSec: clamp(Number(p.durationSec ?? 0) || 0, 0, 999 * 60 + 59),
            visualEnabled: !!p.visualEnabled,
            soundEnabled: !!p.soundEnabled,
            volume: clamp(Number(p.volume ?? 50) || 0, 0, 100),
        }));
}

export function savePresets(presets, storage = localStorage) {
    storage.setItem(LS_KEYS.presets, JSON.stringify(presets));
}

export function loadLastSettings(storage = localStorage) {
    const raw = storage.getItem(LS_KEYS.lastSettings);
    if (!raw) return null;
    const s = safeJsonParse(raw, null);
    if (!s || typeof s !== 'object') return null;
    return {
        name: String(s.name ?? ''),
        minutes: clamp(Number(s.minutes ?? 0) || 0, 0, 999),
        seconds: clamp(Number(s.seconds ?? 0) || 0, 0, 59),
        visualEnabled: !!s.visualEnabled,
        soundEnabled: !!s.soundEnabled,
        volume: clamp(Number(s.volume ?? 50) || 0, 0, 100),
    };
}

export function saveLastSettings(data, storage = localStorage) {
    storage.setItem(LS_KEYS.lastSettings, JSON.stringify(data));
}

export function upsertPreset(presets, preset) {
    const name = String(preset?.name ?? '').trim();
    const next = [...presets];
    const idx = next.findIndex(p => String(p?.name ?? '').trim() === name);
    if (idx >= 0) {
        next[idx] = { ...next[idx], ...preset, name };
        return next;
    }
    return [{ ...preset, name }, ...next];
}

export function deletePreset(presets, id) {
    return presets.filter(p => p.id !== id);
}

export function seedData(storage = localStorage) {
    const seeds = [
        { id:'S-P-01', name:'Чай 3:00', durationSec: 3*60,  visualEnabled:true,  soundEnabled:false, volume:50 },
        { id:'S-P-02', name:'Помідор 25:00', durationSec: 25*60, visualEnabled:true,  soundEnabled:true,  volume:70 },
        { id:'S-P-03', name:'Мікро 0:05', durationSec: 5,     visualEnabled:false, soundEnabled:true,  volume:30 },
        { id:'S-P-04', name:'Фокус 1:00:00', durationSec: 60*60,visualEnabled:true,  soundEnabled:false, volume:50 },
        { id:'S-P-05', name:'', durationSec: 20,             visualEnabled:true,  soundEnabled:false, volume:50 },
        { id:'S-P-06', name:'A', durationSec: 10,            visualEnabled:false, soundEnabled:false, volume:0 },
        { id:'S-P-07', name:'Назва_з_підкресленнями_123', durationSec:45, visualEnabled:true, soundEnabled:true, volume:100 },
        { id:'S-P-08', name:'ДужеДужеДовгаНазва_яка_перевищує_30_символів', durationSec:30, visualEnabled:true, soundEnabled:false, volume:50 },
        { id:'S-P-09', name:'❤️EmojiTimer❤️', durationSec:15, visualEnabled:true, soundEnabled:true, volume:20 },
        { id:'S-P-10', name:'<script>alert(1)</script>', durationSec:12, visualEnabled:true, soundEnabled:false, volume:50 },
    ];

    const last = {
        name: 'Останній запуск',
        minutes: 1,
        seconds: 5,
        visualEnabled: true,
        soundEnabled: true,
        volume: 70,
    };

    storage.setItem(LS_KEYS.presets, JSON.stringify(seeds));
    storage.setItem(LS_KEYS.lastSettings, JSON.stringify(last));
}
