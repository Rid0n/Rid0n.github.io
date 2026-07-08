// Projects carousel: a 3D ring of nodes on a circle pitched up at the back.
// Cards stay as flat billboards (always facing the viewer) so the images
// remain readable; depth is conveyed by scale, vertical arc, fade and z-index.
// Clicking the front card expands a case-study panel (bullets + slideshow).

const DRAG_SENS = 0.006;   // radians of spin per pixel dragged
const EASE = 0.16;         // how quickly the ring settles onto a node

// ── Project content (bullets + media for the expanded case study) ──
const PROJECTS = {
    go2: {
        title: 'Unitree Go2 Quadruped',
        meta: 'Palisade Research · Jetson Orin, ROS2, Nav2, C++, Python, Docker',
        bullets: [
            'For the Unitree Go2 quadruped:',
            'Configured the full autonomy stack for autonomous office perimeter patrol.',
            'Fused LiDAR SLAM, Nav2 navigation, YOLOv8 person detection and BehaviorTree reactive behaviors.',
            'Calibrated LiDAR extrinsics and denoised point clouds for reliable mapping and navigation.',
            'Ran AI-safety shutdown-avoidance trials with an LLM in control of the robot.',
            'Directed shooting of the capstone video that amassed 1.3M views on X.'
        ],
        media: [
            { type: 'tweet', url: 'https://twitter.com/PalisadeAI/status/2022085855943569852' },
            { type: 'video', src: 'media/dog_2.mp4' },
            { type: 'image', src: 'media/dog_3.jpg' },
            { type: 'video', src: 'media/dog_4.mp4' }
        ]
    },
    serena: {
        title: 'Retail Mobile Robots',
        meta: 'Coalescent Mobile Robotics · C++, ROS2, Nav2, Docker, Linux',
        bullets: [
            'For a fleet of autonomous mobile robots in retail stores:',
            'Built and maintained the Nav2 Behavior Tree architecture driving motion planning for a wheeled robot.',
            'Implemented 10 mission-specific robot behaviors in C++.',
            'Overhauled the Behavior Trees package to tie 20+ packages together — more testable, robust, with stats collection.',
            'Ran on-site field testing and debugging throughout live deployments.'
        ],
        media: [
            { type: 'image', src: 'media/serena_1.jpg' },
            { type: 'video', src: 'media/serena_2.mp4' },
            { type: 'video', src: 'media/serena_3.mp4' }
        ]
    },
    drone: {
        title: 'Autonomous Drone & Mars Rover',
        meta: 'Innopolis National Hackathon — Winner · ROS, C++, Python, OpenCV, Arduino, Jetson',
        bullets: [
            'For an autonomous drone and Mars rover:',
            'Wrote drone flight-control and computer-vision C++ to autonomously detect and collect colored cubes.',
            'Built Python/C++ software for a rover completing a simulated Mars mission — joystick control, drill, live camera feed.',
            'Integrated sensors across Arduino, Jetson and Raspberry Pi hardware.'
        ],
        media: [
            { type: 'image', src: 'media/rover.jpg' },
            { type: 'video', src: 'media/rover_vid.mp4' },
            { type: 'image', src: 'media/drone.jpg' },
            { type: 'video', src: 'media/drone_vid.mp4' }
        ]
    },
    sat: {
        title: 'Picosatellite',
        meta: 'National CanSat Competition (MSU) — Finalist · C, ATmega, I2C/SPI/UART',
        bullets: [
            'For an ATmega-based picosatellite:',
            'Led a team of three building a satellite-in-a-can that flew 1 km and returned data.',
            'Wrote low-level C firmware for an ATmega MCU linking flight sensors, radio and memory over I2C, SPI and UART.',
            'Calibrated the accelerometer and barometer.'
        ],
        media: [
            { type: 'image', src: 'media/sat1.jpg' },
            { type: 'image', src: 'media/sat2.jpg' },
            { type: 'image', src: 'media/sat3.jpg' }
        ]
    },
    quad: {
        title: 'Autonomous Indoor Quadcopter',
        meta: 'Future of Life Institute · ArduPilot, MAVLink, EKF fusion, CUDA · SpeedyBee F405, Raspberry Pi Zero 2 W',
        bullets: [
            'For a 350g GPS-denied indoor quadcopter:',
            'Flew fully autonomous indoor missions that locate and approach a known face.',
            'Patched ArduPilot firmware and fused optical-flow/LiDAR in the EKF for stable flight without GPS.',
            'Built a CUDA-accelerated face-recognition ground station (~60 FPS) commanding the drone over MAVLink.',
            'Root-caused airframe instabilities via FFT on raw 1 kHz IMU logs, then hand-tuned rate PIDs and altitude control.',
            'Built a fail-safe mission state machine with verified commands and layered emergency responses.'
        ],
        media: [
            { type: 'image', src: 'media/copter_main.jpg' },
            { type: 'image', src: 'media/copter_3.jpg' }
        ]
    }
};

const stage = document.querySelector('.cf-stage');

if (stage) {
    const cards = [...stage.querySelectorAll('.cf-card')];
    const cf = document.querySelector('.coverflow');
    const detail = document.getElementById('cf-detail');
    const hint = document.querySelector('.cf-hint');
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
        lift = cardH * 0.50;
    };

    const layout = () => {
        cards.forEach((card, i) => {
            const a = i * STEP - rot;
            const cosA = Math.cos(a);
            const depth = (cosA + 1) / 2;          // 1 = front (near), 0 = back (far)
            const x = Math.sin(a) * radiusX;
            const y = cosA * lift;                 // front sits low, back rides high
            const scale = 0.55 + 0.85 * depth;
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

    const go = (dir) => { closeDetail(); target += dir * STEP; spin(); };
    const bringToFront = (i) => {
        // pick the equivalent rotation nearest to where we are (no long spins)
        const k = Math.round((rot - i * STEP) / (2 * Math.PI));
        target = i * STEP + k * 2 * Math.PI;
        spin();
    };

    // ── Case-study detail panel ──
    let openId = null;
    let slideshowCleanup = null;

    const detailHTML = (p) => {
        const bullets = p.bullets.map((b) => `<li>${b}</li>`).join('');
        const slides = p.media.map((m, idx) => {
            const on = idx === 0 ? ' active' : '';
            if (m.type === 'tweet') {
                return `<div class="cf-slide tweet${on}"><blockquote class="twitter-tweet" data-theme="dark" data-dnt="true" data-conversation="none" data-align="center"><a href="${m.url}"></a></blockquote></div>`;
            }
            if (m.type === 'video') {
                return `<div class="cf-slide${on}"><video src="${m.src}" controls muted loop playsinline preload="metadata"></video></div>`;
            }
            return `<div class="cf-slide${on}"><img src="${m.src}" alt="" loading="lazy"></div>`;
        }).join('');
        const dots = p.media.map((m, idx) =>
            `<button type="button" class="cf-dot${idx === 0 ? ' active' : ''}" aria-label="Slide ${idx + 1}"></button>`).join('');

        return `
            <button type="button" class="cf-close" aria-label="Close details">×</button>
            <div class="cf-detail-inner">
                <div class="cf-points-col">
                    <h3 class="cf-detail-title">${p.title}</h3>
                    <p class="cf-meta">${p.meta}</p>
                    <ul class="cf-points">${bullets}</ul>
                </div>
                <div class="cf-show">
                    <div class="cf-slides">${slides}</div>
                    <div class="cf-slide-controls">
                        <button type="button" class="cf-prev-s" aria-label="Previous slide">‹</button>
                        <div class="cf-dots">${dots}</div>
                        <button type="button" class="cf-next-s" aria-label="Next slide">›</button>
                    </div>
                </div>
            </div>`;
    };

    // Auto-advancing slideshow: pauses on hover, freezes on interaction.
    const initSlideshow = (root) => {
        const wrap = root.querySelector('.cf-slides');
        const slides = [...wrap.querySelectorAll('.cf-slide')];
        const dots = [...root.querySelectorAll('.cf-dot')];
        let i = 0, timer = null, frozen = false, hovering = false;

        const render = () => {
            slides.forEach((s, k) => {
                const active = k === i;
                s.classList.toggle('active', active);
                const v = s.querySelector('video');
                if (v) active ? v.play().catch(() => {}) : v.pause();
            });
            dots.forEach((d, k) => d.classList.toggle('active', k === i));
        };
        const to = (n) => { i = (n + slides.length) % slides.length; render(); };
        const sync = () => {
            const run = !frozen && !hovering && slides.length > 1;
            if (run && !timer) timer = setInterval(() => to(i + 1), 5000);
            if (!run && timer) { clearInterval(timer); timer = null; }
        };
        const freeze = () => { frozen = true; sync(); };

        wrap.addEventListener('mouseenter', () => { hovering = true; sync(); });
        wrap.addEventListener('mouseleave', () => { hovering = false; sync(); });
        wrap.addEventListener('pointerdown', freeze);
        root.querySelector('.cf-prev-s')?.addEventListener('click', () => { freeze(); to(i - 1); });
        root.querySelector('.cf-next-s')?.addEventListener('click', () => { freeze(); to(i + 1); });
        dots.forEach((d, k) => d.addEventListener('click', () => { freeze(); to(k); }));

        render();
        sync();
        return () => { if (timer) clearInterval(timer); };
    };

    function openDetail(id) {
        const p = PROJECTS[id];
        if (!p || !detail) return;
        closeDetail();
        detail.innerHTML = detailHTML(p);
        detail.hidden = false;
        requestAnimationFrame(() => detail.classList.add('open'));
        slideshowCleanup = initSlideshow(detail);
        window.twttr?.widgets?.load(detail);   // render any embedded tweet
        detail.querySelector('.cf-close')?.addEventListener('click', closeDetail);
        if (hint) hint.style.display = 'none';
        openId = id;
    }

    function closeDetail() {
        if (!openId) return;
        if (slideshowCleanup) { slideshowCleanup(); slideshowCleanup = null; }
        detail.classList.remove('open');
        detail.hidden = true;
        detail.innerHTML = '';
        if (hint) hint.style.display = '';
        openId = null;
    }

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
        if (Math.abs(dx) > 6 && !moved) { moved = true; closeDetail(); }
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

    // Click a front card to expand it; click a side card to bring it forward.
    cards.forEach((card, i) => {
        card.addEventListener('click', () => {
            if (moved) return;
            if (i !== frontIndex()) { closeDetail(); bringToFront(i); }
            else if (openId === card.dataset.project) closeDetail();
            else openDetail(card.dataset.project);
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
