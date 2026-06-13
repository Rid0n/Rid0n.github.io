// Portfolio interactions: accordion expand + per-project auto-advancing slideshow.

const ADVANCE_MS = 5000;

const panels = [...document.querySelectorAll('.exp')].map((exp) => {
    const slides = [...exp.querySelectorAll('.exp-slide')];
    const dots = [...exp.querySelectorAll('.dot')];
    const show_ = exp.querySelector('.exp-show');

    let i = 0;
    let timer = null;
    let isOpen = false;
    let hovering = false;
    let frozen = false;   // user has taken control — stay put

    const show = (n) => {
        i = (n + slides.length) % slides.length;
        slides.forEach((s, k) => {
            const active = k === i;
            s.classList.toggle('active', active);
            const vid = s.querySelector('video');
            if (vid) active ? vid.play().catch(() => {}) : vid.pause();
        });
        dots.forEach((d, k) => d.classList.toggle('active', k === i));
    };

    // Run the auto-advance only when open, not frozen, and not being hovered.
    const sync = () => {
        const shouldRun = isOpen && !frozen && !hovering && slides.length > 1;
        if (shouldRun && !timer) timer = setInterval(() => show(i + 1), ADVANCE_MS);
        if (!shouldRun && timer) { clearInterval(timer); timer = null; }
    };

    const freeze = () => { frozen = true; sync(); };

    // Pause while reading/scrolling; resume on the way out (unless frozen).
    show_?.addEventListener('mouseenter', () => { hovering = true; sync(); });
    show_?.addEventListener('mouseleave', () => { hovering = false; sync(); });

    // Any real interaction with the media or controls freezes it on this slide.
    show_?.addEventListener('pointerdown', freeze);

    exp.querySelector('.prev')?.addEventListener('click', (e) => { e.stopPropagation(); show(i - 1); });
    exp.querySelector('.next')?.addEventListener('click', (e) => { e.stopPropagation(); show(i + 1); });
    dots.forEach((d, k) => d.addEventListener('click', (e) => { e.stopPropagation(); show(k); }));

    const open = () => {
        isOpen = true;
        exp.classList.add('open');
        slides[i]?.querySelector('video')?.play().catch(() => {});
        sync();
    };

    const close = () => {
        isOpen = false;
        exp.classList.remove('open');
        exp.querySelectorAll('video').forEach((v) => v.pause());
        sync();
    };

    return { exp, open, close };
});

// ── Accordion: one panel open at a time ──
panels.forEach((p) => {
    p.exp.querySelector('.exp-row').addEventListener('click', () => {
        const willOpen = !p.exp.classList.contains('open');
        panels.forEach((q) => q.close());
        if (willOpen) p.open();
    });
});
