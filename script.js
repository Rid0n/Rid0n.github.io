// Deployed: set window.COLLAGE_DATA and window.COLLAGE_DATA_2 in collage-data.js (from Export).
// Authoring: IndexedDB + localStorage, one store per collage.

const MARKDOWN_TEXT = `
# hi, i'm serge! 💫  
(any/all, 24yo, ru/en)

Thanks for scanning the random QR-code.   
You've found my plea for close meaningful friendship I lack. Perhaps, you do too. 

<p class="fine-print">(maybe creating an entire website for that sole purpose is a bit much and a bit weird, but I <em>am</em> much and weird and I'm deathly tired of nonchalance)</p>

## The following will include:
- A rant on adult friendships
- An introduction to me
- A draft of you
- Type of shit we'd be up to
- A way to reach me

**(best viewed on larger screens)**

## Rant
I am sick to my stomach of how miserable and empty adult relationships are. Are we just meant to be satisfied with the endless catchups? The all too familiar conversations running on repeat? Is it just me or does life just stop with work? Where are the conversations that we used to have as kids? Where's the fun of invention and whimsy? This can not be all there is..

We are not meant to merely cruise this existence alone, we're meant to brave it alongside people we love. Individuality is a lie, ultimately it is us who'll save each other. Meaning itself is *forged* in connection.

We're somehow stuck doing such meaningless crap. We should be creating worlds, witnessing naked fire of souls, crying our hearts out and being embraced and comforted, champion kindness. But also simply doing cool shit, visiting one another whenever, cooking dinner, just inhabiting the same space, embracing the quiet moments.

And I am simply weak. I can not do it all without a friend by my side, nor do I want to. I am a bleak speck on my own, but a supernova under right eyes.

*Henceforth, I throw down a vulnerable bid to connect.* How it *should* be done. \n

Anyhoo! Let's start with a collection of things that made me who I am so you can get an idea of me.
`;

const MARKDOWN_TEXT_2 = `
# <p class="center"> who you are
</p>

I don't feel like imposing much restrictions, who tf can tell why people vibe or not, feel free to disregard.  
Still, I imagine you would be:

- kind
- smart
- stupid
- sensitive as shit, intense
- a transient, shifting being
- leading your life, not letting it just happen to you

# <p class="center"> what we'd do
</p>

<div class="tag-cloud">
<span>colorhunting</span><span>theme parties</span><span>travel on a whim</span><span>sleepovers</span><span>talk dreams and nightmares</span><span>come unannounced and be welcome</span><span>help each other with anything</span><span>be there</span><span>care</span><span>support</span><span>do cringe</span><span>make reels</span><span>sleep on the floor</span><span>talk to strangers</span><span>burst into acting spontaneously</span><span>frolic</span><span>cocoa ceremonies</span><span>sing</span><span>reinvent what it means to be friends a thousand times over</span>
</div>

<!--
# #TODOs

- finalize me-layout by: adding delights, being happy with it all
- write intro(motivation+me) text, write inter(you + we'd be upto shit like x) text, write ender(text me) text
- introduce we do shit collage: collect lil' guys and friendship examples
- finalize everything 
-->
`;

const MARKDOWN_TEXT_3 = `

<p class="center">You've reached the endpoint! thank you.</p>

<p class="center">I hope you got a rough idea of me and the people I seek now.</p>

<p class="center">If you feel like we'll vibe, text me on insta or tg - ||🍈serezhdipity||
</p>
`;

// ── IndexedDB ────────────────────────────────────────────────────────────────

const DB_NAME = 'frieposter';
let db;

function openDB() {
    return new Promise((res, rej) => {
        const r = indexedDB.open(DB_NAME, 2);
        r.onupgradeneeded = e => {
            const d = e.target.result;
            if (!d.objectStoreNames.contains('imgs'))  d.createObjectStore('imgs',  { keyPath: 'id' });
            if (!d.objectStoreNames.contains('imgs2')) d.createObjectStore('imgs2', { keyPath: 'id' });
        };
        r.onsuccess = e => res(e.target.result);
        r.onerror   = e => rej(e.target.error);
    });
}

function dbPut(store, id, blob) {
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put({ id, blob });
        tx.oncomplete = res;
        tx.onerror    = e => rej(e.target.error);
    });
}

function dbAll(store) {
    return new Promise((res, rej) => {
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = e => res(e.target.result);
        r.onerror   = e => rej(e.target.error);
    });
}

function dbDel(store, id) {
    return new Promise((res, rej) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = res;
        tx.onerror    = e => rej(e.target.error);
    });
}

// ── Layout persistence ───────────────────────────────────────────────────────

function loadLayout(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch { return {}; }
}

function saveLayout(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
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
            c.width  = Math.round(img.width  * s);
            c.height = Math.round(img.height * s);
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(blob => blob ? resolve(blob) : reject(new Error('toBlob failed')), 'image/jpeg', 0.88);
        };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(file.name)); };
        img.src = url;
    });
}

// ── Global state ─────────────────────────────────────────────────────────────

let editMode      = false;
let activeCollage = null;
let cropState     = null;
let cropDrag      = null;

// ── Collage factory ───────────────────────────────────────────────────────────

function makeCollage(canvasId, lsKey, storeName, windowDataKey) {
    const c = {
        canvasId, lsKey, storeName, windowDataKey,
        layout: {}, imgEls: {}, objURLs: {},
        drag: null, resz: null, rot: null,
        selectedIds: new Set(),
    };

    c.$canvas    = ()  => document.getElementById(c.canvasId);
    c.saveLayout = ()  => saveLayout(c.lsKey, c.layout);

    c.seedFromCollageData = async () => {
        const data = window[c.windowDataKey];
        if (!data) return;
        await Promise.all(Object.entries(data.images).map(async ([id, dataURL]) => {
            const blob = await fetch(dataURL).then(r => r.blob());
            await dbPut(c.storeName, id, blob);
        }));
        Object.entries(data.layout || {}).forEach(([id, pos]) => {
            if (!c.layout[id]) c.layout[id] = pos;
        });
        c.saveLayout();
    };

    c.render = async () => {
        Object.values(c.objURLs).forEach(u => URL.revokeObjectURL(u));
        Object.keys(c.objURLs).forEach(k => delete c.objURLs[k]);
        Object.keys(c.imgEls).forEach(k => delete c.imgEls[k]);
        c.$canvas().querySelectorAll('.img-w').forEach(el => el.remove());

        c.layout = loadLayout(c.lsKey);
        let blobs = await dbAll(c.storeName);

        if (blobs.length === 0 && window[c.windowDataKey]) {
            toast('Loading images…');
            await c.seedFromCollageData();
            c.layout = loadLayout(c.lsKey);
            blobs = await dbAll(c.storeName);
        }

        const entries = blobs.map(({ id, blob }) => {
            const url = URL.createObjectURL(blob);
            c.objURLs[id] = url;
            return { id, src: url };
        });

        entries.forEach(({ id, src }) => {
            if (!c.layout[id]) c.layout[id] = c.randPos();
            const p = c.layout[id];

            const w = document.createElement('div');
            w.className = 'img-w';
            w.dataset.id = id;
            c.applyPos(w, p);

            const clip = document.createElement('div');
            clip.className = 'img-clip';

            const img = document.createElement('img');
            img.draggable = false;
            img.onload = () => { applyCrop(img, clip, c.layout[id].crop, c.layout[id].w); c.fitCanvas(); };
            img.src = src;
            clip.appendChild(img);

            const del = document.createElement('button');
            del.className = 'del-btn';
            del.textContent = '×';
            del.addEventListener('mousedown', e => e.stopPropagation());
            del.addEventListener('click', () => c.removeImg(id));

            const handle     = document.createElement('div');
            handle.className = 'rsz-handle';

            const rotHandle      = document.createElement('div');
            rotHandle.className  = 'rot-handle';

            w.addEventListener('dragstart', e => e.preventDefault());
            w.addEventListener('dblclick',  e => { if (editMode) { e.preventDefault(); openCropModal(c, id); } });

            w.append(clip, del, handle, rotHandle);
            c.$canvas().appendChild(w);
            c.imgEls[id] = w;
        });

        c.updateHint(entries.length === 0);
        c.fitCanvas();
    };

    c.applyPos = (el, p) => {
        el.style.left      = p.x + 'px';
        el.style.top       = p.y + 'px';
        el.style.width     = p.w + 'px';
        el.style.transform = `rotate(${p.r || 0}deg)`;
        el.style.zIndex    = p.z || 1;
    };

    c.randPos = () => {
        const el = c.$canvas();
        const W  = el.offsetWidth || window.innerWidth;
        return {
            x: 30 + Math.floor(Math.random() * Math.max(W - 320, 80)),
            y: 30 + Math.floor(Math.random() * 380),
            w: 170 + Math.floor(Math.random() * 140),
            r: (Math.random() - 0.5) * 10,
            z: Date.now(),
        };
    };

    c.fitCanvas = () => {
        let max = 520;
        Object.entries(c.layout).forEach(([id, p]) => {
            const el = c.imgEls[id];
            if (el) max = Math.max(max, p.y + el.offsetHeight + 80);
        });
        c.$canvas().style.minHeight = max + 'px';
    };

    c.updateHint = show => {
        const h = c.$canvas().querySelector('.empty-hint');
        if (h) h.style.display = show ? 'flex' : 'none';
    };

    c.select = (id, additive = false) => {
        if (!additive) {
            c.selectedIds.forEach(sid => c.imgEls[sid]?.classList.remove('selected'));
            c.selectedIds.clear();
        }
        if (id) {
            if (additive && c.selectedIds.has(id)) {
                c.selectedIds.delete(id);
                c.imgEls[id]?.classList.remove('selected');
            } else {
                c.selectedIds.add(id);
                c.imgEls[id]?.classList.add('selected');
            }
        }
        c.updateSelectionUI();
    };

    c.deselect = () => {
        c.selectedIds.forEach(sid => c.imgEls[sid]?.classList.remove('selected'));
        c.selectedIds.clear();
        c.updateSelectionUI();
    };

    c.updateSelectionUI = () => {
        const n = c.selectedIds.size;
        c.$canvas().classList.toggle('multi-select', n > 1);
        document.getElementById('crop-btn').disabled = n !== 1;
        ['layer-front-btn', 'layer-fwd-btn', 'layer-back-btn', 'layer-rear-btn'].forEach(btnId => {
            document.getElementById(btnId).disabled = n !== 1;
        });
    };

    c.reorderLayer = (id, action) => {
        const sorted = Object.keys(c.layout).sort((a, b) => (c.layout[a].z || 0) - (c.layout[b].z || 0));
        const idx = sorted.indexOf(id);
        sorted.splice(idx, 1);
        if      (action === 'front')    sorted.push(id);
        else if (action === 'back')     sorted.unshift(id);
        else if (action === 'forward')  sorted.splice(Math.min(idx + 1, sorted.length), 0, id);
        else if (action === 'backward') sorted.splice(Math.max(idx - 1, 0), 0, id);
        sorted.forEach((imgId, i) => {
            c.layout[imgId].z = i + 1;
            if (c.imgEls[imgId]) c.imgEls[imgId].style.zIndex = i + 1;
        });
        c.saveLayout();
    };

    c.addFiles = async files => {
        const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (!valid.length) return;
        toast(`Adding ${valid.length} image${valid.length > 1 ? 's' : ''}…`);
        const results = await Promise.allSettled(valid.map(async f => {
            const id   = 'i' + Date.now() + Math.random().toString(36).slice(2, 7);
            const blob = f.type === 'image/svg+xml' ? f : await compress(f);
            await dbPut(c.storeName, id, blob);
        }));
        const added  = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        if (added > 0) await c.render();
        toast(failed ? `Added ${added}, skipped ${failed} unsupported files` : `Added ${added} image${added > 1 ? 's' : ''}`);
    };

    c.removeImg = async id => {
        if (c.selectedIds.has(id)) c.deselect();
        await dbDel(c.storeName, id);
        delete c.layout[id];
        c.saveLayout();
        if (c.objURLs[id]) { URL.revokeObjectURL(c.objURLs[id]); delete c.objURLs[id]; }
        c.imgEls[id]?.remove();
        delete c.imgEls[id];
        c.updateHint(Object.keys(c.imgEls).length === 0);
        c.fitCanvas();
    };

    return c;
}

// ── Collage instances ─────────────────────────────────────────────────────────

const collage1   = makeCollage('collage-canvas',   'frieposter_layout',   'imgs',  'COLLAGE_DATA');
const collage2   = makeCollage('collage-canvas-2', 'frieposter_layout_2', 'imgs2', 'COLLAGE_DATA_2');
const collageMap = new Map([[collage1.canvasId, collage1], [collage2.canvasId, collage2]]);

// ── Crop helpers ──────────────────────────────────────────────────────────────

function applyCrop(img, clip, crop, displayW) {
    if (!crop) {
        clip.style.height = '';
        img.style.cssText = 'display:block; width:100%; height:auto;';
        return;
    }
    const natW = img.naturalWidth, natH = img.naturalHeight;
    if (!natW || !natH) return;
    const scale = displayW / (crop.w * natW);
    clip.style.height = Math.round(crop.h * natH * scale) + 'px';
    img.style.cssText = `position:absolute; width:${Math.round(natW*scale)}px; height:${Math.round(natH*scale)}px; left:${Math.round(-crop.x*natW*scale)}px; top:${Math.round(-crop.y*natH*scale)}px;`;
}

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

function openCropModal(c, id) {
    const wrapper = c.imgEls[id];
    const img     = wrapper.querySelector('img');
    const natW    = img.naturalWidth;
    const natH    = img.naturalHeight;

    const maxW  = window.innerWidth  * 0.88;
    const maxH  = window.innerHeight * 0.78;
    const scale = Math.min(maxW / natW, maxH / natH, 1);
    const dispW = Math.round(natW * scale);
    const dispH = Math.round(natH * scale);

    const existing = c.layout[id].crop;
    const rect = existing
        ? { x: existing.x * dispW, y: existing.y * dispH, w: existing.w * dispW, h: existing.h * dispH }
        : { x: 0, y: 0, w: dispW, h: dispH };

    cropState = { collage: c, id, natW, natH, dispW, dispH, rect };

    const cropImg   = document.getElementById('crop-img');
    const container = document.getElementById('crop-container');
    cropImg.src     = img.src;
    cropImg.style.width  = dispW + 'px';
    cropImg.style.height = dispH + 'px';
    container.style.width  = dispW + 'px';
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
    const { collage: c, id, rect, dispW, dispH } = cropState;
    const crop = { x: rect.x / dispW, y: rect.y / dispH, w: rect.w / dispW, h: rect.h / dispH };
    c.layout[id].crop = crop;
    c.saveLayout();
    const wrapper = c.imgEls[id];
    const clip    = wrapper.querySelector('.img-clip');
    applyCrop(clip.querySelector('img'), clip, crop, c.layout[id].w);
    c.fitCanvas();
    closeCropModal();
}

function closeCropModal() {
    document.getElementById('crop-modal').hidden = true;
    cropState = null;
    cropDrag  = null;
}

// ── Edit mode ────────────────────────────────────────────────────────────────

function toggleEdit() {
    editMode = !editMode;
    if (!editMode) for (const col of collageMap.values()) col.deselect();
    for (const col of collageMap.values()) col.$canvas().classList.toggle('edit-mode', editMode);
    document.getElementById('edit-bar').classList.toggle('visible', editMode);
    toast(editMode ? 'Edit mode  ·  Ctrl+Shift+E to exit' : 'Layout saved');
}

document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); toggleEdit(); }
    if (e.key === 'Escape' && editMode) for (const col of collageMap.values()) col.deselect();
});

// ── Drag to move ─────────────────────────────────────────────────────────────

document.addEventListener('mousedown', e => {
    if (!editMode) return;
    if (e.target.classList.contains('rsz-handle') || e.target.classList.contains('rot-handle') || e.target.classList.contains('del-btn')) return;

    const canvas     = e.target.closest('.collage-canvas');
    const newCollage = canvas ? collageMap.get(canvas.id) : null;
    const w          = e.target.closest('.img-w');

    if (!w) {
        if (!e.target.closest('#edit-bar')) {
            if (newCollage) newCollage.deselect();
            else for (const col of collageMap.values()) col.deselect();
        }
        return;
    }

    if (newCollage && newCollage !== activeCollage && activeCollage) activeCollage.deselect();
    if (newCollage) activeCollage = newCollage;
    if (!activeCollage) return;

    e.preventDefault();
    const id       = w.dataset.id;
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (additive || !activeCollage.selectedIds.has(id)) activeCollage.select(id, additive);

    const cr   = activeCollage.$canvas().getBoundingClientRect();
    const maxZ = Math.max(0, ...Object.values(activeCollage.layout).map(p => p.z || 0));

    activeCollage.drag = {
        startX: e.clientX - cr.left,
        startY: e.clientY - cr.top,
        group: [...activeCollage.selectedIds].map((sid, i) => {
            activeCollage.layout[sid].z = maxZ + 1 + i;
            activeCollage.imgEls[sid].style.zIndex = maxZ + 1 + i;
            activeCollage.imgEls[sid].classList.add('dragging');
            return { id: sid, el: activeCollage.imgEls[sid], x0: parseFloat(activeCollage.imgEls[sid].style.left) || 0, y0: parseFloat(activeCollage.imgEls[sid].style.top) || 0 };
        }),
    };
});

// ── Drag to resize (capture phase) ───────────────────────────────────────────

document.addEventListener('mousedown', e => {
    if (!editMode || !e.target.classList.contains('rsz-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    const w      = e.target.closest('.img-w');
    const canvas = w.closest('.collage-canvas');
    activeCollage = collageMap.get(canvas.id);
    activeCollage.resz = { el: w, id: w.dataset.id, sx: e.clientX, sw: w.offsetWidth };
    w.classList.add('resizing');
}, true);

// ── Drag to rotate (capture phase) ───────────────────────────────────────────

document.addEventListener('mousedown', e => {
    if (!editMode || !e.target.classList.contains('rot-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    const w      = e.target.closest('.img-w');
    const canvas = w.closest('.collage-canvas');
    activeCollage = collageMap.get(canvas.id);
    const id   = w.dataset.id;
    const rect = w.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    activeCollage.rot = {
        el: w, id, cx, cy,
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx),
        startR: activeCollage.layout[id].r || 0,
    };
    w.classList.add('rotating');
}, true);

// ── Mouse move ────────────────────────────────────────────────────────────────

document.addEventListener('mousemove', e => {
    if (activeCollage) {
        const { drag, resz, rot } = activeCollage;
        if (drag) {
            const cr = activeCollage.$canvas().getBoundingClientRect();
            const dx = (e.clientX - cr.left) - drag.startX;
            const dy = (e.clientY - cr.top)  - drag.startY;
            drag.group.forEach(({ id, el, x0, y0 }) => {
                const x = Math.max(0, x0 + dx);
                const y = Math.max(0, y0 + dy);
                el.style.left = x + 'px';
                el.style.top  = y + 'px';
                activeCollage.layout[id].x = x;
                activeCollage.layout[id].y = y;
            });
        }
        if (resz) {
            const w = Math.max(80, resz.sw + (e.clientX - resz.sx));
            resz.el.style.width = w + 'px';
            activeCollage.layout[resz.id].w = w;
            const clip = resz.el.querySelector('.img-clip');
            applyCrop(clip.querySelector('img'), clip, activeCollage.layout[resz.id].crop, w);
        }
        if (rot) {
            const angle = Math.atan2(e.clientY - rot.cy, e.clientX - rot.cx);
            const r = rot.startR + (angle - rot.startAngle) * (180 / Math.PI);
            rot.el.style.transform = `rotate(${r}deg)`;
            activeCollage.layout[rot.id].r = r;
        }
    }
    if (cropDrag && cropState) {
        const dx = e.clientX - cropDrag.sx;
        const dy = e.clientY - cropDrag.sy;
        const s  = cropDrag.startRect;
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

// ── Mouse up ──────────────────────────────────────────────────────────────────

document.addEventListener('mouseup', () => {
    if (activeCollage) {
        if (activeCollage.drag) {
            activeCollage.drag.group.forEach(({ el }) => el.classList.remove('dragging'));
            activeCollage.saveLayout();
            activeCollage.fitCanvas();
            activeCollage.drag = null;
        }
        if (activeCollage.resz) {
            activeCollage.resz.el.classList.remove('resizing');
            activeCollage.saveLayout();
            activeCollage.fitCanvas();
            activeCollage.resz = null;
        }
        if (activeCollage.rot) {
            activeCollage.rot.el.classList.remove('rotating');
            activeCollage.saveLayout();
            activeCollage.rot = null;
        }
    }
    if (cropDrag) cropDrag = null;
});

// ── Export (both collages into one collage-data.js) ───────────────────────────

async function exportAll() {
    toast('Preparing export…');

    async function collageData(c) {
        const blobs  = await dbAll(c.storeName);
        const images = {};
        await Promise.all(blobs.map(({ id, blob }) =>
            new Promise(res => {
                const reader = new FileReader();
                reader.onload = e => { images[id] = e.target.result; res(); };
                reader.readAsDataURL(blob);
            })
        ));
        return { layout: c.layout, images };
    }

    const [d1, d2] = await Promise.all([collageData(collage1), collageData(collage2)]);
    const content  = `window.COLLAGE_DATA = ${JSON.stringify(d1)};\nwindow.COLLAGE_DATA_2 = ${JSON.stringify(d2)};`;

    const a    = document.createElement('a');
    a.href     = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(content);
    a.download = 'collage-data.js';
    a.click();
    toast('Saved collage-data.js');
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

// ── Spoiler / blur reveal ─────────────────────────────────────────────────────

function spoiler(html) {
    return html.replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');
}

document.addEventListener('click', e => {
    if (e.target.classList.contains('spoiler')) e.target.classList.toggle('revealed');
});

// ── Markdown ──────────────────────────────────────────────────────────────────

function renderText() {
    document.getElementById('markdown-content').innerHTML   = spoiler(marked.parse(MARKDOWN_TEXT));
    document.getElementById('markdown-content-2').innerHTML = spoiler(marked.parse(MARKDOWN_TEXT_2));
    document.getElementById('markdown-content-3').innerHTML = spoiler(marked.parse(MARKDOWN_TEXT_3));
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
    renderText();
    db = await openDB();
    await Promise.all([collage1.render(), collage2.render()]);

    document.getElementById('upload-btn').addEventListener('click', () =>
        document.getElementById('file-input').click()
    );
    document.getElementById('file-input').addEventListener('change', e => {
        (activeCollage || collage1).addFiles(e.target.files);
        e.target.value = '';
    });
    document.getElementById('exit-edit-btn').addEventListener('click', toggleEdit);
    document.getElementById('export-btn').addEventListener('click', exportAll);

    const btn = id => document.getElementById(id);
    btn('crop-btn').addEventListener('click', () => {
        if (!activeCollage) return;
        const [id] = activeCollage.selectedIds;
        if (id) openCropModal(activeCollage, id);
    });
    btn('layer-front-btn').addEventListener('click', () => { if (activeCollage) { const [id] = activeCollage.selectedIds; if (id) activeCollage.reorderLayer(id, 'front'); } });
    btn('layer-fwd-btn').addEventListener('click',   () => { if (activeCollage) { const [id] = activeCollage.selectedIds; if (id) activeCollage.reorderLayer(id, 'forward'); } });
    btn('layer-back-btn').addEventListener('click',  () => { if (activeCollage) { const [id] = activeCollage.selectedIds; if (id) activeCollage.reorderLayer(id, 'backward'); } });
    btn('layer-rear-btn').addEventListener('click',  () => { if (activeCollage) { const [id] = activeCollage.selectedIds; if (id) activeCollage.reorderLayer(id, 'back'); } });

    btn('crop-apply-btn').addEventListener('click', applyCropModal);
    btn('crop-cancel-btn').addEventListener('click', closeCropModal);
    btn('crop-reset-btn').addEventListener('click', () => {
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

    for (const col of collageMap.values()) {
        const canvas = col.$canvas();
        canvas.addEventListener('dragover', e => {
            if (!editMode) return;
            e.preventDefault();
            canvas.querySelector('.drop-overlay').classList.add('visible');
        });
        canvas.addEventListener('dragleave', e => {
            if (!canvas.contains(e.relatedTarget))
                canvas.querySelector('.drop-overlay').classList.remove('visible');
        });
        canvas.addEventListener('drop', async e => {
            e.preventDefault();
            canvas.querySelector('.drop-overlay').classList.remove('visible');
            if (editMode) { activeCollage = col; await col.addFiles(e.dataTransfer.files); }
        });
    }
}

init();
