import { describe, it, expect, beforeEach } from 'vitest';
import { loadPresets, savePresets, upsertPreset } from '../src/storage.js';

function makeMemoryStorage() {
    const m = new Map();
    return {
        getItem: (k) => (m.has(k) ? m.get(k) : null),
        setItem: (k, v) => m.set(k, String(v)),
        removeItem: (k) => m.delete(k),
        clear: () => m.clear(),
    };
}

describe('storage presets (R1.7: збереження пресетів)', () => {
    let storage;

    beforeEach(() => {
        storage = makeMemoryStorage();
    });

    it('savePresets + loadPresets повертає ті самі дані', () => {
        const presets = [{ id: '1', name: 'Tea', durationSec: 180, visualEnabled: true, soundEnabled: false, volume: 50 }];
        savePresets(presets, storage);
        expect(loadPresets(storage)).toEqual(presets);
    });

    it('loadPresets повертає [] якщо дані відсутні або зламані', () => {
        expect(loadPresets(storage)).toEqual([]);

        storage.setItem('countdown.presets.v1', 'not-json');
        expect(loadPresets(storage)).toEqual([]);
    });

    it('upsertPreset оновлює існуючий пресет за trim(name)', () => {
        const presets = [{ id: '1', name: 'Tea', durationSec: 10 }];
        const next = upsertPreset(presets, { id: 'X', name: '  Tea  ', durationSec: 20 });

        expect(next).toHaveLength(1);
        expect(next[0].name).toBe('Tea');
        expect(next[0].durationSec).toBe(20);
    });

    it('upsertPreset додає новий пресет на початок', () => {
        const presets = [{ id: '1', name: 'Tea', durationSec: 10 }];
        const next = upsertPreset(presets, { id: '2', name: 'Coffee', durationSec: 20 });

        expect(next).toHaveLength(2);
        expect(next[0].name).toBe('Coffee');
    });

    it('upsertPreset не мутує вхідний масив (важливо для unit-тестів)', () => {
        const presets = [{ id: '1', name: 'Tea', durationSec: 10 }];
        const next = upsertPreset(presets, { id: '1', name: 'Tea', durationSec: 99 });

        expect(presets[0].durationSec).toBe(10);
        expect(next[0].durationSec).toBe(99);
    });
});
