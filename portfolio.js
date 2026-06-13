// Portfolio interactions: accordion expand + per-project slideshow.

document.querySelectorAll('.exp').forEach((exp) => {

    // ── Expand / collapse (accordion: one open at a time) ──
    const row = exp.querySelector('.exp-row');
    row.addEventListener('click', () => {
        const willOpen = !exp.classList.contains('open');
        document.querySelectorAll('.exp.open').forEach((other) => {
            if (other !== exp) other.classList.remove('open');
        });
        exp.classList.toggle('open', willOpen);
        if (willOpen) {
            // Play the visible slide's video; pause everything in collapsed panels.
            exp.querySelector('.exp-slide.active video')?.play().catch(() => {});
        } else {
            exp.querySelectorAll('video').forEach((v) => v.pause());
        }
    });

    // ── Slideshow ──
    const slides = [...exp.querySelectorAll('.exp-slide')];
    const dots = [...exp.querySelectorAll('.dot')];
    if (!slides.length) return;

    let i = 0;
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

    exp.querySelector('.prev')?.addEventListener('click', (e) => { e.stopPropagation(); show(i - 1); });
    exp.querySelector('.next')?.addEventListener('click', (e) => { e.stopPropagation(); show(i + 1); });
    dots.forEach((d, k) => d.addEventListener('click', (e) => { e.stopPropagation(); show(k); }));
});
