import { normalizeTime, formatHMS, escapeHtml, clamp } from './timeUtils.js';
import { createTimerEngine, TimerState } from './timerEngine.js';
import {
    loadPresets, savePresets,
    loadLastSettings, saveLastSettings,
    upsertPreset, deletePreset, seedData, LS_KEYS
} from './storage.js';

const el = {
    name: document.getElementById('name'),
    minutes: document.getElementById('minutes'),
    seconds: document.getElementById('seconds'),
    visual: document.getElementById('visual'),
    sound: document.getElementById('sound'),
    volume: document.getElementById('volume'),
    volVal: document.getElementById('volVal'),

    time: document.getElementById('time'),
    statusText: document.getElementById('statusText'),
    dot: document.getElementById('dot'),
    remainingHint: document.getElementById('remainingHint'),

    btnStart: document.getElementById('btnStart'),
    btnPause: document.getElementById('btnPause'),
    btnStop: document.getElementById('btnStop'),
    btnRestart: document.getElementById('btnRestart'),

    btnSavePreset: document.getElementById('btnSavePreset'),
    btnReset: document.getElementById('btnReset'),
    btnSeed: document.getElementById('btnSeed'),

    msg: document.getElementById('msg'),
    presetList: document.getElementById('presetList'),
    presetCount: document.getElementById('presetCount'),
    pillStorage: document.getElementById('pillStorage'),

    overlay: document.getElementById('overlay'),
    modalText: document.getElementById('modalText'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnMute: document.getElementById('btnMute'),
};

let presets = [];
let audioCtx = null;
let beepOsc = null;
let beepGain = null;

function showMsg(text, kind='warn') {
    el.msg.className = `msg show ${kind}`;
    el.msg.textContent = text;
    clearTimeout(showMsg._t);
    showMsg._t = setTimeout(() => {
        el.msg.className = 'msg';
        el.msg.textContent = '';
    }, 4200);
}

function setStatus(state) {
    el.statusText.textContent = state;
    el.dot.className = `dot ${state.toLowerCase()}`;
}

function openModal(text) {
    el.modalText.textContent = text;
    el.overlay.classList.add('show');
}
function closeModal() {
    el.overlay.classList.remove('show');
}

function ensureAudio() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
    }
}

function startBeep(volume0to100) {
    try {
        ensureAudio();
        const ctx = audioCtx;
        const gain = ctx.createGain();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 880;

        const vol = clamp(volume0to100, 0, 100) / 100;
        gain.gain.value = vol * 0.25;

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        beepOsc = osc;
        beepGain = gain;

        clearTimeout(startBeep._t);
        startBeep._t = setTimeout(() => stopBeep(), 3000);
    } catch {
        showMsg('Не вдалося відтворити звук (може бути заблоковано браузером).', 'warn');
    }
}

function stopBeep() {
    clearTimeout(startBeep._t);
    if (beepOsc) { try { beepOsc.stop(); } catch {} try { beepOsc.disconnect(); } catch {} }
    if (beepGain) { try { beepGain.disconnect(); } catch {} }
    beepOsc = null;
    beepGain = null;
}

function syncVolume() {
    el.volVal.textContent = String(el.volume.value);
}

function getFormData({ silent=false } = {}) {
    const nt = normalizeTime(el.minutes.value, el.seconds.value, { maxMinutes: 999 });
    if (!nt.ok) {
        if (!silent) {
            showMsg(nt.error === 'minutes'
                ? 'Хвилини: введіть ціле число (0..999).'
                : 'Секунди: введіть ціле число (0..).', 'bad');
        }
        return { ok:false };
    }

    el.minutes.value = String(nt.m);
    el.seconds.value = String(nt.s);

    return {
        ok: true,
        name: String(el.name.value ?? ''),
        minutes: nt.m,
        seconds: nt.s,
        totalSec: nt.totalSec,
        visualEnabled: el.visual.checked,
        soundEnabled: el.sound.checked,
        volume: clamp(Number(el.volume.value) || 0, 0, 100),
    };
}

function saveLast() {
    const d = getFormData({ silent:true });
    if (!d.ok) return;
    saveLastSettings({
        name: d.name,
        minutes: d.minutes,
        seconds: d.seconds,
        visualEnabled: d.visualEnabled,
        soundEnabled: d.soundEnabled,
        volume: d.volume,
    });
}

function renderTime(sec, state) {
    el.time.textContent = formatHMS(sec);
    if (state === TimerState.Running || state === TimerState.Paused) {
        el.remainingHint.textContent = `${Math.max(0, Math.trunc(sec))}s`;
    } else {
        el.remainingHint.textContent = '';
    }
}

function updateButtons(state) {
    const d = getFormData({ silent:true });
    const total = d.ok ? d.totalSec : 0;

    const canStart = d.ok && total > 0 && (state === TimerState.Idle || state === TimerState.Paused);
    const canPause = state === TimerState.Running;
    const canStop  = state === TimerState.Running || state === TimerState.Paused || state === TimerState.Finished;
    const canRestart = d.ok && total > 0;

    el.btnStart.disabled = !canStart;
    el.btnPause.disabled = !canPause;
    el.btnStop.disabled = !canStop;
    el.btnRestart.disabled = !canRestart;

    el.btnStart.textContent = (state === TimerState.Paused) ? 'Продовжити' : 'Старт';
}

function presetToLabel(p) {
    const parts = [];
    parts.push(p.visualEnabled ? 'Visual' : '—Visual');
    parts.push(p.soundEnabled ? `Sound ${p.volume}` : '—Sound');
    return parts.join(' · ');
}

function renderPresets() {
    el.presetList.innerHTML = '';
    el.presetCount.textContent = String(presets.length);

    if (presets.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'msg show';
        empty.textContent = 'Немає пресетів. Натисніть “Seed” або “Зберегти як пресет”.';
        el.presetList.appendChild(empty);
        return;
    }

    for (const p of presets) {
        const row = document.createElement('div');
        row.className = 'item';

        const meta = document.createElement('div');
        meta.className = 'meta';

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = p.name?.trim() ? p.name : '(без назви)';

        const sub = document.createElement('div');
        sub.className = 'sub';
        sub.innerHTML = `
      <span class="kbd">${formatHMS(p.durationSec)}</span>
      <span>${escapeHtml(presetToLabel(p))}</span>
    `;

        meta.appendChild(name);
        meta.appendChild(sub);

        const actions = document.createElement('div');
        actions.className = 'actions';

        const btnRun = document.createElement('button');
        btnRun.className = 'small btn-primary';
        btnRun.textContent = 'Запустити';
        btnRun.addEventListener('click', () => {
            applyPresetToForm(p);
            closeModal();
            stopBeep();
            engine.start(p.durationSec);
            updateButtons(engine.getState());
        });

        const btnEdit = document.createElement('button');
        btnEdit.className = 'small';
        btnEdit.textContent = 'Ред.';
        btnEdit.addEventListener('click', () => {
            applyPresetToForm(p);
            showMsg('Пресет застосовано у форму. Змініть поля та натисніть “Зберегти як пресет”.', 'good');
        });

        const btnDel = document.createElement('button');
        btnDel.className = 'small btn-danger';
        btnDel.textContent = 'Видалити';
        btnDel.addEventListener('click', () => {
            presets = deletePreset(presets, p.id);
            savePresets(presets);
            renderPresets();
            showMsg('Пресет видалено.', 'good');
        });

        actions.appendChild(btnRun);
        actions.appendChild(btnEdit);
        actions.appendChild(btnDel);

        row.appendChild(meta);
        row.appendChild(actions);
        el.presetList.appendChild(row);
    }
}

function applyPresetToForm(p) {
    const total = clamp(Number(p.durationSec) || 0, 0, 999*60 + 59);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const minutes = h * 60 + m;

    el.name.value = String(p.name ?? '');
    el.minutes.value = String(minutes);
    el.seconds.value = String(s);
    el.visual.checked = !!p.visualEnabled;
    el.sound.checked = !!p.soundEnabled;
    el.volume.value = String(clamp(Number(p.volume ?? 50) || 0, 0, 100));
    syncVolume();

    // normalize & persist
    getFormData({ silent:true });
    saveLast();
}

// Engine: чиста логіка відліку
const engine = createTimerEngine({
    onTick: (remaining, state) => {
        setStatus(state);
        renderTime(remaining, state);
        updateButtons(state);
    },
    onFinish: () => {
        const name = String(el.name.value ?? '').trim();
        const label = name ? `Таймер “${name}” завершився.` : 'Таймер завершився.';
        const visualOn = el.visual.checked;
        const soundOn = el.sound.checked;

        if (visualOn) openModal(label);
        if (soundOn) startBeep(clamp(Number(el.volume.value) || 0, 0, 100));
        if (!visualOn && !soundOn) showMsg('Відлік завершено (сповіщення вимкнені).', 'warn');
    }
});

function applyLastSettingsToForm() {
    const s = loadLastSettings();
    if (!s) {
        el.minutes.value = '0';
        el.seconds.value = '30';
        el.visual.checked = true;
        el.sound.checked = false;
        el.volume.value = '50';
        el.name.value = '';
    } else {
        el.name.value = s.name;
        el.minutes.value = String(s.minutes);
        el.seconds.value = String(s.seconds);
        el.visual.checked = !!s.visualEnabled;
        el.sound.checked = !!s.soundEnabled;
        el.volume.value = String(s.volume);
    }
    syncVolume();

    const d = getFormData({ silent:true });
    renderTime(d.ok ? d.totalSec : 0, TimerState.Idle);
    setStatus(TimerState.Idle);
    updateButtons(TimerState.Idle);
}

function resetStorage() {
    localStorage.removeItem(LS_KEYS.presets);
    localStorage.removeItem(LS_KEYS.lastSettings);
    presets = [];
    renderPresets();
    showMsg('Сховище очищено (Reset).', 'good');
}

function initStorageFlag() {
    try {
        localStorage.setItem('__test__', '1');
        localStorage.removeItem('__test__');
        el.pillStorage.textContent = 'localStorage OK';
    } catch {
        el.pillStorage.textContent = 'localStorage недоступно';
        showMsg('Увага: localStorage недоступно, збереження вимкнено.', 'warn');
    }
}

function bindUI() {
    el.volume.addEventListener('input', () => { syncVolume(); saveLast(); });

    const onAnyChange = () => {
        getFormData({ silent:true });
        saveLast();
        updateButtons(engine.getState());
    };

    el.name.addEventListener('input', onAnyChange);
    el.minutes.addEventListener('input', onAnyChange);
    el.seconds.addEventListener('input', onAnyChange);
    el.visual.addEventListener('change', onAnyChange);
    el.sound.addEventListener('change', onAnyChange);

    el.btnStart.addEventListener('click', () => {
        if (engine.getState() === TimerState.Paused) {
            engine.resume();
            return;
        }
        const d = getFormData();
        if (!d.ok) return;
        if (d.totalSec <= 0) {
            showMsg('Задайте час більше 0.', 'bad');
            updateButtons(engine.getState());
            return;
        }
        closeModal();
        stopBeep();
        engine.start(d.totalSec);
        saveLast();
    });

    el.btnPause.addEventListener('click', () => { engine.pause(); saveLast(); });
    el.btnStop.addEventListener('click', () => {
        stopBeep();
        closeModal();
        const d = getFormData({ silent:true });
        engine.stop(d.ok ? d.totalSec : 0);
        saveLast();
    });

    el.btnRestart.addEventListener('click', () => {
        const d = getFormData();
        if (!d.ok) return;
        if (d.totalSec <= 0) { showMsg('Задайте час більше 0, щоб перезапустити.', 'bad'); return; }
        stopBeep(); closeModal();
        engine.restart(d.totalSec);
        saveLast();
    });

    el.btnSavePreset.addEventListener('click', () => {
        const d = getFormData();
        if (!d.ok) return;
        if (d.totalSec <= 0) { showMsg('Неможливо зберегти пресет з часом 00:00.', 'bad'); return; }

        let presetName = String(d.name ?? '').replace(/\s+/g, ' ').trim();
        if (presetName.length > 60) presetName = presetName.slice(0, 60);
        el.name.value = presetName; // normalize in UI

        const preset = {
            id: crypto.randomUUID(),
            name: presetName,
            durationSec: d.totalSec,
            visualEnabled: d.visualEnabled,
            soundEnabled: d.soundEnabled,
            volume: d.volume,
        };

        presets = upsertPreset(presets, preset);
        savePresets(presets);
        renderPresets();
        saveLast();
        showMsg('Пресет збережено/оновлено.', 'good');
    });

    el.btnReset.addEventListener('click', () => {
        stopBeep(); closeModal();
        engine.stop(0);
        resetStorage();
        applyLastSettingsToForm();
    });

    el.btnSeed.addEventListener('click', () => {
        stopBeep(); closeModal();
        engine.stop(0);
        seedData();
        presets = loadPresets();
        applyLastSettingsToForm();
        renderPresets();
        showMsg('Seed-дані завантажено.', 'good');
    });

    el.btnCloseModal.addEventListener('click', closeModal);
    el.btnMute.addEventListener('click', () => { stopBeep(); showMsg('Звук зупинено.', 'good'); });
    el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) closeModal(); });

    document.addEventListener('visibilitychange', () => { if (document.hidden) stopBeep(); });
}

function init() {
    initStorageFlag();
    presets = loadPresets();
    applyLastSettingsToForm();
    renderPresets();
    bindUI();
}

init();
