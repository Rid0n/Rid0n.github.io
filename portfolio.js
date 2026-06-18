// Projects carousel: a 3D ring of nodes on a circle pitched up at the back.
// Cards stay as flat billboards (always facing the viewer) so the images
// remain readable; depth is conveyed by scale, vertical arc, fade and z-index.

const DRAG_SENS = 0.006;   // radians of spin per pixel dragged
const EASE = 0.16;         // how quickly the ring settles onto a node

const stage = document.querySelector('.cf-stage');

if (stage) {
    const cards = [...stage.querySelectorAll('.cf-card')];
    const cf = document.querySelector('.coverflow');
    const N = cards.length;
    const STEP = (2 * Math.PI) / N;   // even spacing of the nodes

    let radiusX = 320;   // horizontal radius of the ellipse
    let lift = 90;       // vertical arc (front low, back high) — the "pitch"
    let rot = 0;         // current ring rotation
    let target = 0;      // rotation we're easing toward
    let raf = null;

    const frontIndex = () => ((Math.round(rot / STEP) % N) + N) % N;

    const measure = () => {
        const w = stage.clientWidth;
        const cardW = cards[0].offsetWidth || w * 0.4;
        const cardH = cards[0].offsetHeight || 240;
        radiusX = Math.max(150, Math.min(w * 0.33, w / 2 - cardW * 0.3));
        lift = cardH * 0.55;
    };

    const layout = () => {
        cards.forEach((card, i) => {
            const a = i * STEP - rot;
            const cosA = Math.cos(a);
            const depth = (cosA + 1) / 2;          // 1 = front (near), 0 = back (far)
            const x = Math.sin(a) * radiusX;
            const y = cosA * lift;                 // front sits low, back rides high
            const scale = 0.5 + 0.9 * depth;   // front blows up to ~1.4×, back shrinks to ~0.5×
            card.style.transform =
                `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${scale.toFixed(3)})`;
            card.style.opacity = (0.4 + 0.6 * depth).toFixed(3);
            card.style.zIndex = String(Math.round(depth * 100));
        });
        const front = frontIndex();
        cards.forEach((c, i) => c.classList.toggle('is-active', i === front));
    };

    const animate = () => {
        const diff = target - rot;
        if (Math.abs(diff) < 0.0008) { rot = target; layout(); raf = null; return; }
        rot += diff * EASE;
        layout();
        raf = requestAnimationFrame(animate);
    };
    const spin = () => { if (raf === null) raf = requestAnimationFrame(animate); };

    const go = (dir) => { target += dir * STEP; spin(); };
    const bringToFront = (i) => {
        // pick the equivalent rotation nearest to where we are (no long spins)
        const k = Math.round((rot - i * STEP) / (2 * Math.PI));
        target = i * STEP + k * 2 * Math.PI;
        spin();
    };

    // ── Drag / swipe to spin ──
    let dragging = false, moved = false, startX = 0, rotStart = 0;

    stage.addEventListener('pointerdown', (e) => {
        dragging = true;
        moved = false;
        startX = e.clientX;
        rotStart = rot;
        if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    });
    window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > 6) moved = true;
        rot = rotStart - dx * DRAG_SENS;
        target = rot;
        layout();
    });
    window.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        target = Math.round(rot / STEP) * STEP;   // snap to the nearest node
        spin();
    });

    // Click a card to bring it to the front (ignore the tail of a drag).
    cards.forEach((card, i) => {
        card.addEventListener('click', () => {
            if (moved) return;
            if (i !== frontIndex()) bringToFront(i);
        });
    });

    document.querySelector('.cf-prev')?.addEventListener('click', () => go(-1));
    document.querySelector('.cf-next')?.addEventListener('click', () => go(1));

    cf?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    });

    window.addEventListener('resize', () => { measure(); layout(); });

    measure();
    layout();
}
