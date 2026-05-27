// Deployed mode: set window.COLLAGE_DATA via collage-data.js (generated from Export).
// Authoring mode: uses IndexedDB for images + localStorage for positions.

const MARKDOWN_TEXT = `
# hi, i'm serge! INTRO TEXT
(any/all)

henceforth, I throw down a vulnerable bid to connect. How it should work.

*Lorem ipsum dolor sit amet*, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco.

## what i'm looking for

Laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat.

- something something
- another quality you're looking for
- a third thing

## about me sections

- songs
- art
- films
- series
- memes
- quotes
- YT channels
- games
- #TODO: add delights

- whimsy/what we'll be like

Anyhoo! here's a collection of things that made me who I am.
`;

const MARKDOWN_TEXT_2 = `
# who you are

I don't feel like imposing much restrictions, who tf can tell why people vibe or not, feel free to disregard. Still, I imagine you would be:

- kind
- smart, you're ravenous to knowledge
- stupid
- sensitive as shit and intense
- a transient, shifting being
- life isn't something that happens to you, it's something you lead    
# The shenanigans we'd be up to

tough shit

`;

// ── IndexedDB ────────────────────────────────────────────────────────────────

const DB_NAME = 'frieposter';
let db;

function openDB() {
    return new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = e => e.target.result.createObjectStore('imgs', { keyPath: 'id' });
        r.onsuccess = e => res(e.target.result);
        r.onerror = e => rej(e.target.error);
    });
}

function dbPut(id, blob) {
    return new Promise((res, rej) => {
        const tx = db.transaction('imgs', 'readwrite');
        tx.objectStore('imgs').put({ id, blob });
        tx.oncomplete = res;
        tx.onerror = e => rej(e.target.error);
    });
}

function dbAll() {
    return new Promise((res, rej) => {
        const r = db.transaction('imgs').objectStore('imgs').getAll();
        r.onsuccess = e => res(e.target.result);
        r.onerror = e => rej(e.target.error);
    });
}

function dbDel(id) {
    return new Promise((res, rej) => {
        const tx = db.transaction('imgs', 'readwrite');
        tx.objectStore('imgs').delete(id);
        tx.oncomplete = res;
        tx.onerror = e => rej(e.target.error);
    });
}

// ── Layout persistence ───────────────────────────────────────────────────────

const LS_KEY = 'frieposter_layout';

function loadLayout() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
    catch { return {}; }
}

function saveLayout() {
    localStorage.setItem(LS_KEY, JSON.stringify(layout));
}

// ── Image compression ────────────────────────────────────────────────────────

function compress(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX = 1400;
            const s = Math.min(1, MAX / Math.max(img.width, img.height));
            const c = document.createElement('canvas');
            c.width = Math.round(img.width * s);
            c.height = Math.round(img.height * s);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.88);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(file.name)); };
        img.src = url;
    });
}

// ── State ────────────────────────────────────────────────────────────────────

let layout = {};
let editMode = false;
let drag = null;
let resz = null;
let rot = null;
let selectedIds = new Set();
let cropState = null;
let cropDrag = null;
const imgEls = {};
const objURLs = {};

const $canvas = () => document.getElementById('collage-canvas');

// ── Collage rendering ────────────────────────────────────────────────────────

async function seedFromCollageData() {
    const entries = Object.entries(window.COLLAGE_DATA.images);
    await Promise.all(entries.map(async ([id, dataURL]) => {
        const blob = await fetch(dataURL).then(r => r.blob());
        await dbPut(id, blob);
    }));
    const seededLayout = window.COLLAGE_DATA.layout || {};
    Object.entries(seededLayout).forEach(([id, pos]) => {
        if (!layout[id]) layout[id] = pos;
    });
    saveLayout();
}

async function renderCollage() {
    Object.values(objURLs).forEach(u => URL.revokeObjectURL(u));
    Object.keys(objURLs).forEach(k => delete objURLs[k]);
    Object.keys(imgEls).forEach(k => delete imgEls[k]);
    $canvas().querySelectorAll('.img-w').forEach(el => el.remove());

    layout = loadLayout();
    let blobs = await dbAll();

    if (blobs.length === 0 && window.COLLAGE_DATA) {
        toast('Loading images…');
        await seedFromCollageData();
        layout = loadLayout();
        blobs = await dbAll();
    }

    const entries = blobs.map(({ id, blob }) => {
        const url = URL.createObjectURL(blob);
        objURLs[id] = url;
        return { id, src: url };
    });

    entries.forEach(({ id, src }) => {
        if (!layout[id]) layout[id] = randPos();
        const p = layout[id];

        const w = document.createElement('div');
        w.className = 'img-w';
        w.dataset.id = id;
        applyPos(w, p);

        const clip = document.createElement('div');
        clip.className = 'img-clip';

        const img = document.createElement('img');
        img.draggable = false;
        img.onload = () => {
            applyCrop(img, clip, layout[id].crop, layout[id].w);
            fitCanvas();
        };
        img.src = src;
        clip.appendChild(img);

        const del = document.createElement('button');
        del.className = 'del-btn';
        del.textContent = '×';
        del.addEventListener('mousedown', e => e.stopPropagation());
        del.addEventListener('click', () => removeImg(id));

        const handle = document.createElement('div');
        handle.className = 'rsz-handle';

        const rotHandle = document.createElement('div');
        rotHandle.className = 'rot-handle';

        w.addEventListener('dragstart', e => e.preventDefault());
        w.addEventListener('dblclick', e => {
            if (editMode) { e.preventDefault(); openCropModal(id); }
        });

        w.append(clip, del, handle, rotHandle);
        $canvas().appendChild(w);
        imgEls[id] = w;
    });

    updateHint(entries.length === 0);
    fitCanvas();
}

function applyPos(el, p) {
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.width = p.w + 'px';
    el.style.transform = `rotate(${p.r || 0}deg)`;
    el.style.zIndex = p.z || 1;
}

function applyCrop(img, clip, crop, displayW) {
    if (!crop) {
        clip.style.height = '';
        img.style.cssText = 'display:block; width:100%; height:auto;';
        return;
    }
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    if (!natW || !natH) return;
    const scale = displayW / (crop.w * natW);
    clip.style.height = Math.round(crop.h * natH * scale) + 'px';
    img.style.cssText = `position:absolute; width:${Math.round(natW * scale)}px; height:${Math.round(natH * scale)}px; left:${Math.round(-crop.x * natW * scale)}px; top:${Math.round(-crop.y * natH * scale)}px;`;
}

function randPos() {
    const c = $canvas();
    const W = c.offsetWidth || window.innerWidth;
    return {
        x: 30 + Math.floor(Math.random() * Math.max(W - 320, 80)),
        y: 30 + Math.floor(Math.random() * 380),
        w: 170 + Math.floor(Math.random() * 140),
        r: (Math.random() - 0.5) * 10,
        z: Date.now(),
    };
}

function fitCanvas() {
    let max = 520;
    Object.entries(layout).forEach(([id, p]) => {
        const el = imgEls[id];
        if (el) max = Math.max(max, p.y + el.offsetHeight + 80);
    });
    $canvas().style.minHeight = max + 'px';
}

function updateHint(show) {
    document.getElementById('empty-hint').style.display = show ? 'flex' : 'none';
}

// ── Selection ─────────────────────────────────────────────────────────────────

function select(id, additive = false) {
    if (!additive) {
        selectedIds.forEach(sid => imgEls[sid]?.classList.remove('selected'));
        selectedIds.clear();
    }
    if (id) {
        if (additive && selectedIds.has(id)) {
            selectedIds.delete(id);
            imgEls[id]?.classList.remove('selected');
        } else {
            selectedIds.add(id);
            imgEls[id]?.classList.add('selected');
        }
    }
    updateSelectionUI();
}

function deselect() {
    selectedIds.forEach(sid => imgEls[sid]?.classList.remove('selected'));
    selectedIds.clear();
    updateSelectionUI();
}

function updateSelectionUI() {
    const n = selectedIds.size;
    const multi = n > 1;
    $canvas().classList.toggle('multi-select', multi);
    document.getElementById('crop-btn').disabled = n !== 1;
    ['layer-front-btn', 'layer-fwd-btn', 'layer-back-btn', 'layer-rear-btn'].forEach(btnId => {
        document.getElementById(btnId).disabled = n !== 1;
    });
}

function reorderLayer(id, action) {
    const sorted = Object.keys(layout).sort((a, b) => (layout[a].z || 0) - (layout[b].z || 0));
    const idx = sorted.indexOf(id);
    sorted.splice(idx, 1);
    if      (action === 'front')    sorted.push(id);
    else if (action === 'back')     sorted.unshift(id);
    else if (action === 'forward')  sorted.splice(Math.min(idx + 1, sorted.length), 0, id);
    else if (action === 'backward') sorted.splice(Math.max(idx - 1, 0), 0, id);
    sorted.forEach((imgId, i) => {
        layout[imgId].z = i + 1;
        if (imgEls[imgId]) imgEls[imgId].style.zIndex = i + 1;
    });
    saveLayout();
}

// ── Edit mode ────────────────────────────────────────────────────────────────

function toggleEdit() {
    editMode = !editMode;
    if (!editMode) deselect();
    $canvas().classList.toggle('edit-mode', editMode);
    document.getElementById('edit-bar').classList.toggle('visible', editMode);
    toast(editMode ? 'Edit mode  ·  Ctrl+Shift+E to exit' : 'Layout saved');
}

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        toggleEdit();
    }
    if (e.key === 'Escape' && editMode) deselect();
});

// ── Drag to move ─────────────────────────────────────────────────────────────

document.addEventListener('mousedown', e => {
    if (!editMode) return;
    if (e.target.classList.contains('rsz-handle') || e.target.classList.contains('rot-handle') || e.target.classList.contains('del-btn')) return;
    const w = e.target.closest('.img-w');
    if (!w) { if (!e.target.closest('#edit-bar')) deselect(); return; }

    e.preventDefault();
    const id = w.dataset.id;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    // Only change selection if shift-clicking, or clicking something not already selected.
    // Clicking an already-selected image without shift should keep the whole group selected.
    if (additive || !selectedIds.has(id)) select(id, additive);

    const cr = $canvas().getBoundingClientRect();
    const maxZ = Math.max(0, ...Object.values(layout).map(p => p.z || 0));

    drag = {
        startX: e.clientX - cr.left,
        startY: e.clientY - cr.top,
        group: [...selectedIds].map((sid, i) => {
            layout[sid].z = maxZ + 1 + i;
            imgEls[sid].style.zIndex = maxZ + 1 + i;
            imgEls[sid].classList.add('dragging');
            return { id: sid, el: imgEls[sid], x0: parseFloat(imgEls[sid].style.left) || 0, y0: parseFloat(imgEls[sid].style.top) || 0 };
        }),
    };
});

// ── Drag to resize (capture phase to beat move handler) ──────────────────────

document.addEventListener('mousedown', e => {
    if (!editMode || !e.target.classList.contains('rsz-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    const w = e.target.closest('.img-w');
    resz = { el: w, id: w.dataset.id, sx: e.clientX, sw: w.offsetWidth };
    w.classList.add('resizing');
}, true);

// ── Drag to rotate (capture phase) ───────────────────────────────────────────

document.addEventListener('mousedown', e => {
    if (!editMode || !e.target.classList.contains('rot-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    const w = e.target.closest('.img-w');
    const id = w.dataset.id;
    const rect = w.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    rot = {
        el: w, id, cx, cy,
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
        startR: layout[id].r || 0,
    };
    w.classList.add('rotating');
}, true);

document.addEventListener('mousemove', e => {
    if (drag) {
        const cr = $canvas().getBoundingClientRect();
        const dx = (e.clientX - cr.left) - drag.startX;
        const dy = (e.clientY - cr.top) - drag.startY;
        drag.group.forEach(({ id, el, x0, y0 }) => {
            const x = Math.max(0, x0 + dx);
            const y = Math.max(0, y0 + dy);
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            layout[id].x = x;
            layout[id].y = y;
        });
    }
    if (resz) {
        const w = Math.max(80, resz.sw + (e.clientX - resz.sx));
        resz.el.style.width = w + 'px';
        layout[resz.id].w = w;
        const clip = resz.el.querySelector('.img-clip');
        applyCrop(clip.querySelector('img'), clip, layout[resz.id].crop, w);
    }
    if (rot) {
        const angle = Math.atan2(e.clientY - rot.cy, e.clientX - rot.cx);
        const r = rot.startR + (angle - rot.startAngle) * (180 / Math.PI);
        rot.el.style.transform = `rotate(${r}deg)`;
        layout[rot.id].r = r;
    }
    if (cropDrag && cropState) {
        const dx = e.clientX - cropDrag.sx;
        const dy = e.clientY - cropDrag.sy;
        const s = cropDrag.startRect;
        const { dispW, dispH } = cropState;
        let r = { ...s };
        if (cropDrag.type === 'move') {
            r.x = s.x + dx;
            r.y = s.y + dy;
        } else {
            const t = cropDrag.type;
            if (t.includes('e')) r.w = s.w + dx;
            if (t.includes('s')) r.h = s.h + dy;
            if (t.includes('w')) { r.x = s.x + dx; r.w = s.w - dx; }
            if (t.includes('n')) { r.y = s.y + dy; r.h = s.h - dy; }
        }
        cropState.rect = constrainRect(r, dispW, dispH);
        updateCropRect();
    }
});

document.addEventListener('mouseup', () => {
    if (drag) {
        drag.group.forEach(({ el }) => el.classList.remove('dragging'));
        saveLayout();
        fitCanvas();
        drag = null;
    }
    if (resz) {
        resz.el.classList.remove('resizing');
        saveLayout();
        fitCanvas();
        resz = null;
    }
    if (rot) {
        rot.el.classList.remove('rotating');
        saveLayout();
        rot = null;
    }
    if (cropDrag) cropDrag = null;
});

// ── File upload ───────────────────────────────────────────────────────────────

async function addFiles(files) {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!valid.length) return;
    toast(`Adding ${valid.length} image${valid.length > 1 ? 's' : ''}…`);
    const results = await Promise.allSettled(valid.map(async f => {
        const id = 'i' + Date.now() + Math.random().toString(36).slice(2, 7);
        const blob = f.type === 'image/svg+xml' ? f : await compress(f);
        await dbPut(id, blob);
    }));
    const added = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (added > 0) await renderCollage();
    toast(failed ? `Added ${added}, skipped ${failed} unsupported files` : `Added ${added} image${added > 1 ? 's' : ''}`);
}

// ── Remove image ──────────────────────────────────────────────────────────────

async function removeImg(id) {
    if (selectedIds.has(id)) deselect();
    await dbDel(id);
    delete layout[id];
    saveLayout();
    if (objURLs[id]) { URL.revokeObjectURL(objURLs[id]); delete objURLs[id]; }
    imgEls[id]?.remove();
    delete imgEls[id];
    updateHint(Object.keys(imgEls).length === 0);
    fitCanvas();
}

// ── Export ────────────────────────────────────────────────────────────────────

async function exportCollage() {
    toast('Preparing export…');
    const blobs = await dbAll();
    const images = {};

    await Promise.all(blobs.map(({ id, blob }) =>
        new Promise(res => {
            const reader = new FileReader();
            reader.onload = e => { images[id] = e.target.result; res(); };
            reader.readAsDataURL(blob);
        })
    ));

    const json = JSON.stringify({ layout, images });
    const content = `window.COLLAGE_DATA = ${json};`;

    const a = document.createElement('a');
    a.href = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(content);
    a.download = 'collage-data.js';
    a.click();

    toast('Saved collage-data.js — add <script src="collage-data.js"></script> to your index.html to deploy');
}

// ── Crop modal ────────────────────────────────────────────────────────────────

function constrainRect(r, maxW, maxH, MIN = 20) {
    let { x, y, w, h } = r;
    if (w < MIN) w = MIN;
    if (h < MIN) h = MIN;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x + w > maxW) x = maxW - w;
    if (y + h > maxH) y = maxH - h;
    return { x, y, w, h };
}

function openCropModal(id) {
    const wrapper = imgEls[id];
    const img = wrapper.querySelector('img');
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    const maxW = window.innerWidth * 0.88;
    const maxH = window.innerHeight * 0.78;
    const scale = Math.min(maxW / natW, maxH / natH, 1);
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);

    const existing = layout[id].crop;
    const rect = existing
        ? { x: existing.x * dispW, y: existing.y * dispH, w: existing.w * dispW, h: existing.h * dispH }
        : { x: 0, y: 0, w: dispW, h: dispH };

    cropState = { id, natW, natH, dispW, dispH, rect };

    const cropImg = document.getElementById('crop-img');
    const container = document.getElementById('crop-container');
    cropImg.src = img.src;
    cropImg.style.width = dispW + 'px';
    cropImg.style.height = dispH + 'px';
    container.style.width = dispW + 'px';
    container.style.height = dispH + 'px';

    updateCropRect();
    document.getElementById('crop-modal').hidden = false;
}

function updateCropRect() {
    const { rect } = cropState;
    const el = document.getElementById('crop-rect');
    el.style.left   = rect.x + 'px';
    el.style.top    = rect.y + 'px';
    el.style.width  = rect.w + 'px';
    el.style.height = rect.h + 'px';
}

function applyCropModal() {
    const { id, rect, dispW, dispH } = cropState;
    const crop = { x: rect.x / dispW, y: rect.y / dispH, w: rect.w / dispW, h: rect.h / dispH };
    layout[id].crop = crop;
    saveLayout();
    const wrapper = imgEls[id];
    const clip = wrapper.querySelector('.img-clip');
    applyCrop(clip.querySelector('img'), clip, crop, layout[id].w);
    fitCanvas();
    closeCropModal();
}

function closeCropModal() {
    document.getElementById('crop-modal').hidden = true;
    cropState = null;
    cropDrag = null;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── Markdown ──────────────────────────────────────────────────────────────────

function renderText() {
    document.getElementById('markdown-content').innerHTML = marked.parse(MARKDOWN_TEXT);
    document.getElementById('markdown-content-2').innerHTML = marked.parse(MARKDOWN_TEXT_2);
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    renderText();
    db = await openDB();
    await renderCollage();

    document.getElementById('upload-btn').addEventListener('click', () =>
        document.getElementById('file-input').click()
    );
    document.getElementById('file-input').addEventListener('change', e => {
        addFiles(e.target.files);
        e.target.value = '';
    });
    document.getElementById('exit-edit-btn').addEventListener('click', toggleEdit);
    document.getElementById('export-btn').addEventListener('click', exportCollage);
    document.getElementById('crop-btn').addEventListener('click', () => { const [id] = selectedIds; if (id) openCropModal(id); });
    document.getElementById('layer-front-btn').addEventListener('click', () => { const [id] = selectedIds; if (id) reorderLayer(id, 'front'); });
    document.getElementById('layer-fwd-btn').addEventListener('click',   () => { const [id] = selectedIds; if (id) reorderLayer(id, 'forward'); });
    document.getElementById('layer-back-btn').addEventListener('click',  () => { const [id] = selectedIds; if (id) reorderLayer(id, 'backward'); });
    document.getElementById('layer-rear-btn').addEventListener('click',  () => { const [id] = selectedIds; if (id) reorderLayer(id, 'back'); });
    document.getElementById('crop-apply-btn').addEventListener('click', applyCropModal);
    document.getElementById('crop-cancel-btn').addEventListener('click', closeCropModal);
    document.getElementById('crop-reset-btn').addEventListener('click', () => {
        const { dispW, dispH } = cropState;
        cropState.rect = { x: 0, y: 0, w: dispW, h: dispH };
        updateCropRect();
    });

    const cropRect = document.getElementById('crop-rect');
    cropRect.addEventListener('mousedown', e => {
        if (e.target.classList.contains('crop-handle')) return;
        e.preventDefault();
        cropDrag = { type: 'move', sx: e.clientX, sy: e.clientY, startRect: { ...cropState.rect } };
    });
    document.querySelectorAll('.crop-handle').forEach(h => {
        h.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            cropDrag = { type: h.dataset.h, sx: e.clientX, sy: e.clientY, startRect: { ...cropState.rect } };
        });
    });

    const c = $canvas();
    c.addEventListener('dragover', e => {
        if (!editMode) return;
        e.preventDefault();
        document.getElementById('drop-overlay').classList.add('visible');
    });
    c.addEventListener('dragleave', e => {
        if (!c.contains(e.relatedTarget))
            document.getElementById('drop-overlay').classList.remove('visible');
    });
    c.addEventListener('drop', async e => {
        e.preventDefault();
        document.getElementById('drop-overlay').classList.remove('visible');
        if (editMode) await addFiles(e.dataTransfer.files);
    });
}

init();
