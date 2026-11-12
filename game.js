// ==========================================
// HUB MINI-GAME STANDBY UJIAN v2 (TANPA UBAH HTML)
// Layar penuh (portrait & landscape) + efek animasi
// 1. Penjaga Galaksi | 2. Lari Petualang
// 3. Roket Terbang   | 4. Susun Menara | 5. Pertahanan Benteng | 6. Balap Motor
// API lama tetap: resetGame(), mountGameHub(), launchMiniGame(), stopActiveLoop()
// ==========================================

let activeMiniGame = null;
let gameLoopId = null;
let keydownHandler = null;

let mgS = null;
let mgPrevOverflow = '';
const GAMES = {};
const MG_ORDER = ['meteor', 'runner', 'rocket', 'tower', 'castle', 'racer'];

const mgRnd = (a, b) => a + Math.random() * (b - a);
const mgClamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mgBestGet = id => { try { return +localStorage.getItem('cbtBest_' + id) || 0; } catch (e) { return 0; } };
const mgBestSet = (id, v) => { try { localStorage.setItem('cbtBest_' + id, v); } catch (e) {} };
const mgMix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;

// ------------------------------------------
// Kontrol dasar
// ------------------------------------------
function stopActiveLoop() {
    if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
    if (keydownHandler) { document.removeEventListener('keydown', keydownHandler); keydownHandler = null; }
    closeStage();
}

function closeStage() {
    if (!mgS) return;
    const S = mgS;
    mgS = null;
    S.dead = true;
    S.cleanup.forEach(f => { try { f(); } catch (e) {} });
    try {
        if (document.fullscreenElement) Promise.resolve(document.exitFullscreen()).catch(() => {});
        else if (document.webkitFullscreenElement) document.webkitExitFullscreen();
    } catch (e) {}
    S.ov.remove();
    document.body.style.overflow = mgPrevOverflow;
    activeMiniGame = null;
}

// Dipanggil otomatis oleh app.js saat ujian selesai
function resetGame() {
    stopActiveLoop();
    activeMiniGame = null;
    mountGameHub();
}

// ------------------------------------------
// Hub (menu pilihan game)
// ------------------------------------------
function getOrCreateHubContainer() {
    let hub = document.getElementById('cbtMultiGameHub');
    if (hub) return hub;

    const statusElem = document.getElementById('gameStatus');
    const firstCell = document.querySelector('.cell');
    const gridWrapper = firstCell ? firstCell.parentElement : null;

    hub = document.createElement('div');
    hub.id = 'cbtMultiGameHub';
    hub.style.cssText = 'width:100%;max-width:340px;margin:8px auto;font-family:system-ui,-apple-system,sans-serif;user-select:none;-webkit-user-select:none;';

    if (gridWrapper && gridWrapper.parentElement) {
        if (statusElem) statusElem.style.display = 'none';
        gridWrapper.style.display = 'none';
        const nextEl = gridWrapper.nextElementSibling;
        if (nextEl && nextEl.tagName === 'BUTTON' && /reset|ulang|main/i.test(nextEl.innerText)) {
            nextEl.style.display = 'none';
        }
        gridWrapper.parentElement.insertBefore(hub, gridWrapper);
    } else if (statusElem && statusElem.parentElement) {
        statusElem.style.display = 'none';
        statusElem.parentElement.insertBefore(hub, statusElem);
    }
    return hub;
}

function mgInjectStyles() {
    if (document.getElementById('mgStyles')) return;
    const st = document.createElement('style');
    st.id = 'mgStyles';
    st.textContent = `
    .mgh-card{opacity:0;transform:translateY(14px);animation:mghIn .5s ease forwards;transition:transform .12s,box-shadow .2s}
    .mgh-card:hover{box-shadow:0 6px 18px rgba(15,23,42,.14)}
    .mgh-card:active{transform:scale(.97)!important}
    .mgh-ico{animation:mghFloat 2.4s ease-in-out infinite}
    .mgh-title{background:linear-gradient(90deg,#6366f1,#ec4899,#f59e0b,#6366f1);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:mghShine 4s linear infinite}
    @keyframes mghIn{to{opacity:1;transform:none}}
    @keyframes mghFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(-8deg)}}
    @keyframes mghShine{to{background-position:200% 0}}
    @keyframes mgFade{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:none}}
    .mg-stage{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:#020617;color:#fff;
      font-family:system-ui,-apple-system,sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
      padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);animation:mgFade .25s ease}
    .mg-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(15,23,42,.92);flex-shrink:0}
    .mg-bar button{background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;cursor:pointer}
    .mg-bar button:active{transform:scale(.94)}
    .mg-pill{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:5px 9px;font-size:12px;font-weight:800;white-space:nowrap}
    .mg-title{flex:1;text-align:center;font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mg-stage canvas{flex:1;min-height:0;width:100%;display:block;touch-action:none;outline:none}
    @media (max-width:430px){.mg-best{display:none}.mg-title{font-size:12px}}
    `;
    document.head.appendChild(st);
}

function mountGameHub() {
    stopActiveLoop();
    mgInjectStyles();
    const hub = getOrCreateHubContainer();
    if (!hub) return;

    hub.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:14px;">
            <div style="text-align:center;margin-bottom:10px;">
                <div class="mgh-title" style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">Mini-Game Standby</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Terbuka layar penuh • portrait &amp; landscape</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                ${MG_ORDER.map((id, i) => {
                    const g = GAMES[id];
                    const best = mgBestGet(id);
                    return `
                    <button type="button" class="mgh-card" onclick="launchMiniGame('${id}')"
                        style="animation-delay:${i * 90}ms;display:flex;align-items:center;gap:12px;width:100%;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                        <div class="mgh-ico" style="width:38px;height:38px;border-radius:10px;background:${g.color}22;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;animation-delay:${i * 300}ms;">${g.icon}</div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.2;">${g.title}</div>
                            <div style="font-size:11px;color:#64748b;margin-top:2px;">${g.desc}</div>
                            ${best ? `<div style="font-size:10px;color:${g.color};font-weight:700;margin-top:2px;">🏆 Rekor: ${best}</div>` : ''}
                        </div>
                        <span style="font-size:12px;font-weight:700;color:${g.color};">Main &rarr;</span>
                    </button>`;
                }).join('')}
            </div>
        </div>`;
}

function launchMiniGame(gameId) {
    openStage(gameId);
}

// ------------------------------------------
// Engine panggung layar penuh
// ------------------------------------------
function mgEnterFs(S) {
    try {
        const f = S.ov.requestFullscreen || S.ov.webkitRequestFullscreen;
        if (f && !document.fullscreenElement && !document.webkitFullscreenElement) Promise.resolve(f.call(S.ov)).catch(() => {});
    } catch (e) {}
}
function mgToggleFs(S) {
    try {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else mgEnterFs(S);
    } catch (e) {}
}

function openStage(id) {
    const def = GAMES[id];
    if (!def) return;
    stopActiveLoop();
    mgInjectStyles();

    const ov = document.createElement('div');
    ov.className = 'mg-stage';
    ov.id = 'cbtStage';
    ov.innerHTML = `
        <div class="mg-bar">
            <button type="button" id="mgBack">&larr; Menu</button>
            <span class="mg-title">${def.icon} ${def.title}</span>
            <span class="mg-pill" id="mgScore">0</span>
            <span class="mg-pill mg-best" id="mgBest">🏆 0</span>
            <button type="button" id="mgFs" title="Layar penuh">⛶</button>
        </div>
        <canvas id="mgCanvas"></canvas>`;
    document.body.appendChild(ov);
    mgPrevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const cv = ov.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const S = {
        id, def, game: def, ov, cv, ctx, W: 300, H: 300, state: 'ready', t: 0, overT: 0, last: 0,
        score: 0, best: mgBestGet(id), newBest: false, shake: 0, flash: 0,
        parts: [], rings: [], floats: [], stars: [], keys: {}, ptr: { x: 0, y: 0, down: false, has: false },
        cleanup: [], dead: false
    };
    mgS = S;
    activeMiniGame = id;

    const scoreEl = ov.querySelector('#mgScore');
    const bestEl = ov.querySelector('#mgBest');
    S.refresh = () => { scoreEl.textContent = 'Skor: ' + S.score; bestEl.textContent = '🏆 ' + S.best; };

    // --- API efek untuk game ---
    S.setScore = n => { S.score = n; S.refresh(); };
    S.add = n => { S.score += n; S.refresh(); };
    S.burst = (x, y, c, n = 12, spd = 200) => {
        for (let i = 0; i < n && S.parts.length < 450; i++) {
            const a = mgRnd(0, 6.283), v = mgRnd(0.3, 1) * spd, l = mgRnd(0.4, 0.9);
            S.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 300, life: l, max: l, c, s: mgRnd(2, 4.5) });
        }
    };
    S.ring = (x, y, c) => S.rings.push({ x, y, r: 6, life: 0.5, max: 0.5, c });
    S.float = (x, y, text, c = '#fff', size = 18) => S.floats.push({ x, y, text, c, size, life: 1 });
    S.end = () => {
        if (S.state !== 'play') return;
        S.state = 'over';
        S.overT = S.t;
        if (S.score > S.best) { S.best = S.score; S.newBest = true; mgBestSet(id, S.best); }
        S.refresh();
    };

    // --- ukuran & resize ---
    const resize = () => {
        const r = cv.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const ow = S.W, oh = S.H, d = Math.min(window.devicePixelRatio || 1, 2);
        cv.width = Math.round(r.width * d);
        cv.height = Math.round(r.height * d);
        ctx.setTransform(d, 0, 0, d, 0, 0);
        S.W = r.width; S.H = r.height;
        const n = Math.floor(S.W * S.H / 4500);
        S.stars = Array.from({ length: n }, () => ({ x: mgRnd(0, S.W), y: mgRnd(0, S.H), z: Math.random() }));
        if (S.game.resize) S.game.resize(S, ow, oh);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    S.cleanup.push(() => { ro.disconnect(); window.removeEventListener('resize', resize); window.removeEventListener('orientationchange', resize); });

    // --- input ---
    const pos = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch (_) {}
        const p = pos(e);
        S.ptr.x = p.x; S.ptr.y = p.y; S.ptr.down = true; S.ptr.has = true;
        mgAction(S, p.x, p.y, false);
    });
    cv.addEventListener('pointermove', e => {
        const p = pos(e);
        S.ptr.x = p.x; S.ptr.y = p.y;
        if (e.pointerType === 'mouse' || S.ptr.down) S.ptr.has = true;
    });
    const up = () => { S.ptr.down = false; };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);

    keydownHandler = e => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        const first = !e.repeat;
        S.keys[e.code] = true;
        if (first && ['Space', 'ArrowUp', 'KeyW', 'Enter'].includes(e.code)) mgAction(S, null, null, true);
    };
    const keyup = e => { S.keys[e.code] = false; };
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', keyup);
    S.cleanup.push(() => document.removeEventListener('keyup', keyup));

    ov.querySelector('#mgBack').onclick = () => closeStage();
    ov.querySelector('#mgFs').onclick = () => mgToggleFs(S);

    mgEnterFs(S);
    resize();
    S.game.init(S);
    S.refresh();
    gameLoopId = requestAnimationFrame(mgTick);
}

function mgAction(S, x, y, key) {
    if (S.state === 'ready') {
        mgStart(S);
        if (S.game.startPress && S.game.press) S.game.press(S, x, y, key);
        return;
    }
    if (S.state === 'over') { if (S.t - S.overT > 0.7) mgStart(S); return; }
    if (S.game.press) S.game.press(S, x, y, key);
}

function mgStart(S) {
    S.parts = []; S.rings = []; S.floats = [];
    S.score = 0; S.newBest = false; S.shake = 0; S.flash = 0;
    S.state = 'play';
    S.game.init(S);
    S.refresh();
}

function mgTick(t) {
    const S = mgS;
    if (!S || S.dead) return;
    gameLoopId = requestAnimationFrame(mgTick);
    const dt = Math.min(0.033, Math.max(0, (t - (S.last || t)) / 1000));
    S.last = t;
    S.t += dt;
    if (S.state === 'play') S.game.update(S, dt);
    mgFx(S, dt);
    mgRender(S);
}

function mgFx(S, dt) {
    for (const p of S.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
    S.parts = S.parts.filter(p => p.life > 0);
    for (const r of S.rings) { r.r += 240 * dt; r.life -= dt; }
    S.rings = S.rings.filter(r => r.life > 0);
    for (const f of S.floats) { f.y -= 42 * dt; f.life -= dt * 0.9; }
    S.floats = S.floats.filter(f => f.life > 0);
    S.shake = Math.max(0, S.shake * (1 - dt * 9));
    S.flash = Math.max(0, S.flash - dt * 2.2);
    const dir = S.game.dir;
    if (dir) {
        for (const s of S.stars) {
            if (dir === 'down') { s.y += (20 + s.z * 110) * dt; if (s.y > S.H) { s.y = 0; s.x = mgRnd(0, S.W); } }
            else { s.x -= (20 + s.z * 90) * dt; if (s.x < 0) { s.x = S.W; s.y = mgRnd(0, S.H); } }
        }
    }
}

function mgSpace(S) {
    const { ctx, W, H } = S;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#020617'); g.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    for (const s of S.stars) {
        ctx.globalAlpha = (0.3 + s.z * 0.7) * (0.75 + 0.25 * Math.sin(S.t * 3 + s.x));
        ctx.fillRect(s.x, s.y, s.z * 2 + 0.6, s.z * 2 + 0.6);
    }
    ctx.globalAlpha = 1;
}

function mgRender(S) {
    const { ctx, W, H } = S;
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    if (S.game.bg === 'space') mgSpace(S);
    if (S.shake > 0.3) ctx.translate(mgRnd(-S.shake, S.shake), mgRnd(-S.shake, S.shake));
    S.game.draw(S, ctx);
    ctx.textBaseline = 'alphabetic';

    for (const r of S.rings) {
        ctx.globalAlpha = Math.max(0, r.life / r.max);
        ctx.strokeStyle = r.c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.283); ctx.stroke();
    }
    for (const p of S.parts) {
        const k = Math.max(0, p.life / p.max);
        ctx.globalAlpha = k; ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (0.4 + 0.6 * k), 0, 6.283); ctx.fill();
    }
    ctx.textAlign = 'center';
    for (const f of S.floats) {
        ctx.globalAlpha = Math.min(1, f.life * 2);
        ctx.font = `800 ${f.size}px system-ui`;
        ctx.fillStyle = f.c; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 3;
        ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (S.flash > 0) { ctx.fillStyle = `rgba(239,68,68,${S.flash * 0.4})`; ctx.fillRect(0, 0, W, H); }
    mgOverlay(S);
}

function mgPill(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); }
    else ctx.fillRect(x, y, w, h);
}

function mgOverlay(S) {
    if (S.state === 'play') return;
    const { ctx, W, H } = S;
    const over = S.state === 'over';
    ctx.save();
    ctx.fillStyle = 'rgba(2,6,23,.62)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const f = mgClamp(Math.min(W, H) / 12, 18, 38), cy = H / 2;
    ctx.font = `${f * 1.8}px serif`;
    ctx.fillText(over ? '💥' : S.def.icon, W / 2, cy - f * 2.6 + Math.sin(S.t * 4) * 6);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${f}px system-ui`;
    ctx.fillText(over ? 'Permainan Selesai!' : S.def.title, W / 2, cy - f * 0.8);
    ctx.font = `600 ${f * 0.48}px system-ui`; ctx.fillStyle = '#cbd5e1';
    if (over) {
        ctx.fillText(`Skor ${S.score}  •  Rekor ${S.best}`, W / 2, cy + f * 0.1);
        if (S.newBest) { ctx.fillStyle = '#fde047'; ctx.fillText('🎉 Rekor baru!', W / 2, cy + f * 0.75); }
    } else {
        ctx.fillText(S.def.hint, W / 2, cy + f * 0.1);
    }
    const bw = f * 7.2, bh = f * 1.25, by = cy + f * 1.5;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(S.t * 5);
    mgPill(ctx, W / 2 - bw / 2, by, bw, bh, S.def.color);
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = `800 ${f * 0.5}px system-ui`;
    ctx.fillText(over ? 'Ketuk untuk main lagi' : 'Ketuk untuk mulai', W / 2, by + bh / 2);
    ctx.restore();
}

// ==========================================
// GAME 1: PENJAGA GALAKSI
// ==========================================
GAMES.meteor = {
    title: 'Penjaga Galaksi', icon: '☄️', color: '#ef4444',
    desc: 'Hancurkan meteor & kalahkan boss', hint: 'Geser untuk bergerak • tembak otomatis • ←/→ di keyboard',
    bg: 'space', dir: 'down',
    init(S) {
        this.s = { x: S.W / 2, y: S.H - 80, bul: [], met: [], pw: [], eb: [], boss: null, lives: 3, fire: 0, sp: 0.6,
            kills: 0, tri: 0, sh: 0, inv: 0, lv: 1, bossLv: 0 };
    },
    resize(S, ow) { if (this.s && ow) this.s.x *= S.W / ow; },
    hurt(S) {
        const g = this.s;
        if (g.sh > 0) { g.sh = 0; S.ring(g.x, g.y, '#38bdf8'); S.float(g.x, g.y - 30, 'Perisai pecah!', '#7dd3fc', 16); g.inv = 0.8; return; }
        g.lives--; g.inv = 1.3; S.shake = 12; S.flash = 1;
        S.burst(g.x, g.y, '#f87171', 20, 260);
        if (g.lives <= 0) { S.burst(g.x, g.y, '#fde047', 40, 360); S.ring(g.x, g.y, '#fff'); S.end(); }
    },
    kill(S, m) {
        const g = this.s;
        S.add(m.max * 10); g.kills++; S.shake = Math.max(S.shake, 5);
        S.burst(m.x, m.y, '#fb923c', 14, 220); S.burst(m.x, m.y, '#fde047', 6, 160); S.ring(m.x, m.y, '#fdba74');
        if (m.r > 26) {
            for (const d of [-1, 1]) g.met.push(this.mk(m.x + d * 14, m.y, m.r * 0.6, 1, m.vy * 1.1, d * mgRnd(40, 90)));
        }
        if (Math.random() < 0.14) g.pw.push({ x: m.x, y: m.y, t: ['t', 's', 'h'][Math.floor(Math.random() * 3)] });
    },
    mk(x, y, r, hp, vy, vx) {
        return { x, y, r, hp, max: hp, vy, vx, a: 0, vr: mgRnd(-2, 2), hit: 0, shape: Array.from({ length: 9 }, () => mgRnd(0.82, 1.1)) };
    },
    update(S, dt) {
        const g = this.s, W = S.W, H = S.H, k = S.keys;
        g.y = H - Math.min(90, H * 0.2);
        if (k.ArrowLeft || k.KeyA) { g.x -= 460 * dt; S.ptr.has = false; }
        if (k.ArrowRight || k.KeyD) { g.x += 460 * dt; S.ptr.has = false; }
        if (S.ptr.has) g.x += (S.ptr.x - g.x) * Math.min(1, dt * 16);
        g.x = mgClamp(g.x, 22, W - 22);
        g.inv -= dt; g.tri -= dt;
        g.lv = 1 + Math.floor(g.kills / 8);

        // tembak
        g.fire -= dt;
        if (g.fire <= 0) {
            g.fire = 0.2;
            g.bul.push({ x: g.x, y: g.y - 18, vx: 0, vy: -640 });
            if (g.tri > 0) g.bul.push({ x: g.x - 8, y: g.y - 12, vx: -130, vy: -620 }, { x: g.x + 8, y: g.y - 12, vx: 130, vy: -620 });
        }
        for (const b of g.bul) { b.x += b.vx * dt; b.y += b.vy * dt; }
        g.bul = g.bul.filter(b => b.y > -20 && b.x > -20 && b.x < W + 20);

        // boss
        if (g.lv % 3 === 0 && g.bossLv !== g.lv && !g.boss) {
            g.bossLv = g.lv;
            g.boss = { x: W / 2, y: -70, hp: 25 + g.lv * 4, max: 25 + g.lv * 4, t: 0, sh: 1.5, hit: 0 };
            S.float(W / 2, H * 0.35, '⚠ BOSS!', '#fca5a5', 28); S.shake = 8;
        }
        // spawn meteor
        if (!g.boss) {
            g.sp -= dt;
            if (g.sp <= 0) {
                g.sp = Math.max(0.35, 1.0 - g.lv * 0.07);
                const r = mgRnd(15, 38), hp = r > 30 ? 3 : r > 22 ? 2 : 1;
                g.met.push(this.mk(mgRnd(r, W - r), -r, r, hp, mgRnd(80, 140) + g.lv * 14, mgRnd(-30, 30)));
            }
        }
        // meteor
        for (let i = g.met.length - 1; i >= 0; i--) {
            const m = g.met[i];
            m.x += m.vx * dt; m.y += m.vy * dt; m.a += m.vr * dt; m.hit -= dt;
            if (m.x < m.r || m.x > W - m.r) m.vx *= -1;
            let dead = false;
            for (let j = g.bul.length - 1; j >= 0; j--) {
                const b = g.bul[j];
                if (Math.hypot(m.x - b.x, m.y - b.y) < m.r + 4) {
                    g.bul.splice(j, 1); m.hp--; m.hit = 0.1;
                    S.burst(b.x, b.y, '#fde047', 4, 120);
                    if (m.hp <= 0) { dead = true; break; }
                }
            }
            if (dead) { this.kill(S, m); g.met.splice(i, 1); continue; }
            if (g.inv <= 0 && Math.hypot(m.x - g.x, m.y - g.y) < m.r + 14) {
                g.met.splice(i, 1); S.burst(m.x, m.y, '#fb923c', 16, 220); this.hurt(S);
                if (S.state !== 'play') return;
                continue;
            }
            if (m.y - m.r > H) {
                g.met.splice(i, 1);
                if (g.inv <= 0) { this.hurt(S); if (S.state !== 'play') return; }
            }
        }
        // boss logic
        const b = g.boss;
        if (b) {
            b.t += dt; b.hit -= dt;
            b.y += (H * 0.16 - b.y) * dt * 2;
            b.x = W / 2 + Math.sin(b.t * 0.9) * (W * 0.35 - 30);
            b.sh -= dt;
            if (b.sh <= 0) {
                b.sh = Math.max(0.8, 1.4 - g.lv * 0.04);
                for (const a of [-0.35, 0, 0.35]) g.eb.push({ x: b.x, y: b.y + 24, vx: Math.sin(a) * 220, vy: Math.cos(a) * 230 });
            }
            for (let j = g.bul.length - 1; j >= 0; j--) {
                const bl = g.bul[j];
                if (Math.abs(bl.x - b.x) < 48 && Math.abs(bl.y - b.y) < 26) {
                    g.bul.splice(j, 1); b.hp--; b.hit = 0.08; S.burst(bl.x, bl.y, '#fde047', 3, 120);
                }
            }
            if (b.hp <= 0) {
                S.add(300); g.kills += 3; S.shake = 18;
                for (let i = 0; i < 4; i++) S.burst(b.x + mgRnd(-40, 40), b.y + mgRnd(-15, 15), ['#fb923c', '#fde047', '#f87171'][i % 3], 20, 320);
                S.ring(b.x, b.y, '#fff'); S.float(b.x, b.y + 40, 'BOSS HANCUR! +300', '#fde047', 22);
                g.pw.push({ x: b.x, y: b.y, t: 'h' }, { x: b.x - 30, y: b.y, t: 't' });
                g.boss = null;
            }
        }
        // peluru musuh
        for (let i = g.eb.length - 1; i >= 0; i--) {
            const e = g.eb[i]; e.x += e.vx * dt; e.y += e.vy * dt;
            if (g.inv <= 0 && Math.hypot(e.x - g.x, e.y - g.y) < 16) { g.eb.splice(i, 1); this.hurt(S); if (S.state !== 'play') return; continue; }
            if (e.y > H + 20 || e.x < -20 || e.x > W + 20) g.eb.splice(i, 1);
        }
        // power-up
        for (let i = g.pw.length - 1; i >= 0; i--) {
            const p = g.pw[i]; p.y += 110 * dt;
            if (Math.hypot(p.x - g.x, p.y - g.y) < 28) {
                if (p.t === 't') { g.tri = 8; S.float(g.x, g.y - 34, 'Tembakan Ganda!', '#fde047', 15); }
                else if (p.t === 's') { g.sh = 1; S.float(g.x, g.y - 34, 'Perisai!', '#7dd3fc', 15); }
                else { g.lives = Math.min(5, g.lives + 1); S.float(g.x, g.y - 34, '+1 Nyawa', '#fda4af', 15); }
                S.ring(p.x, p.y, '#fff'); S.burst(p.x, p.y, '#fff', 8, 140);
                g.pw.splice(i, 1);
            } else if (p.y > H + 20) g.pw.splice(i, 1);
        }
        // api roket
        if (Math.random() < 0.7) S.parts.push({ x: g.x + mgRnd(-4, 4), y: g.y + 14, vx: mgRnd(-15, 15), vy: mgRnd(80, 160), g: 0, life: 0.3, max: 0.3, c: '#fb923c', s: 3 });
    },
    draw(S, ctx) {
        const g = this.s, W = S.W;
        // meteor
        for (const m of g.met) {
            ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.a);
            ctx.beginPath();
            m.shape.forEach((k, i) => { const a = i / m.shape.length * 6.283; const px = Math.cos(a) * m.r * k, py = Math.sin(a) * m.r * k; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
            ctx.closePath();
            const gr = ctx.createRadialGradient(-m.r * 0.3, -m.r * 0.3, 2, 0, 0, m.r);
            gr.addColorStop(0, m.hit > 0 ? '#fff' : '#fdba74'); gr.addColorStop(1, m.hit > 0 ? '#fecaca' : '#9a3412');
            ctx.fillStyle = gr; ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,.22)';
            ctx.beginPath(); ctx.arc(m.r * 0.25, m.r * 0.15, m.r * 0.2, 0, 6.283); ctx.fill();
            ctx.beginPath(); ctx.arc(-m.r * 0.3, m.r * 0.3, m.r * 0.12, 0, 6.283); ctx.fill();
            ctx.restore();
        }
        // power-up
        ctx.textAlign = 'center';
        for (const p of g.pw) {
            ctx.font = '24px serif';
            ctx.fillText(p.t === 't' ? '⚡' : p.t === 's' ? '🛡️' : '❤️', p.x, p.y + 8 + Math.sin(S.t * 6) * 3);
        }
        // boss
        const b = g.boss;
        if (b) {
            ctx.save(); ctx.translate(b.x, b.y);
            ctx.fillStyle = b.hit > 0 ? '#fff' : '#7c3aed';
            ctx.beginPath(); ctx.moveTo(-52, -6); ctx.lineTo(-24, -26); ctx.lineTo(24, -26); ctx.lineTo(52, -6); ctx.lineTo(30, 24); ctx.lineTo(-30, 24); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(0, -2, 12 + Math.sin(S.t * 6) * 2, 0, 6.283); ctx.fill();
            ctx.restore();
            const bw = Math.min(W * 0.6, 260);
            ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(W / 2 - bw / 2, 44, bw, 8);
            ctx.fillStyle = '#f43f5e'; ctx.fillRect(W / 2 - bw / 2, 44, bw * Math.max(0, b.hp / b.max), 8);
        }
        // peluru
        ctx.fillStyle = '#fde047';
        for (const bl of g.bul) ctx.fillRect(bl.x - 2, bl.y, 4, 12);
        ctx.fillStyle = '#f472b6';
        for (const e of g.eb) { ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, 6.283); ctx.fill(); }
        // pesawat
        if (S.state === 'play' || S.state === 'ready') {
            ctx.save(); ctx.translate(g.x, g.y);
            if (g.inv > 0 && Math.floor(S.t * 20) % 2) ctx.globalAlpha = 0.4;
            const fl = 8 + Math.random() * 10;
            ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.moveTo(-6, 12); ctx.lineTo(6, 12); ctx.lineTo(0, 12 + fl); ctx.fill();
            ctx.fillStyle = '#38bdf8'; ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(15, 14); ctx.lineTo(0, 8); ctx.lineTo(-15, 14); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#e0f2fe'; ctx.beginPath(); ctx.arc(0, -2, 4, 0, 6.283); ctx.fill();
            if (g.sh > 0) { ctx.strokeStyle = `rgba(56,189,248,${0.6 + 0.3 * Math.sin(S.t * 8)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 28, 0, 6.283); ctx.stroke(); }
            ctx.restore();
        }
        // HUD
        ctx.textAlign = 'left'; ctx.font = '18px system-ui'; ctx.fillStyle = '#fff';
        ctx.fillText('❤️'.repeat(Math.max(0, g.lives)), 12, 28);
        ctx.textAlign = 'right'; ctx.font = '800 13px system-ui'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(`LEVEL ${g.lv}${g.tri > 0 ? '  ⚡' + Math.ceil(g.tri) : ''}`, W - 12, 26);
    }
};

// ==========================================
// GAME 2: LARI PETUALANG
// ==========================================
GAMES.runner = {
    title: 'Lari Petualang', icon: '🏃', color: '#f59e0b',
    desc: 'Lompati rintangan, kumpulkan bintang', hint: 'Ketuk = lompat (bisa 2x) • tahan area bawah / ↓ = menunduk',
    startPress: true,
    init(S) {
        this.s = { y: 0, vy: 0, jumps: 0, duck: false, dist: 0, sp: 300, obs: [], coins: [], next: 500, cn: 400, stars: 0, air: false };
    },
    press(S, x, y, key) {
        const g = this.s, u = mgClamp(S.H / 360, 0.7, 1.8);
        if (!key && y > S.H * 0.72) return;
        if (g.jumps < 2) {
            g.vy = (g.jumps ? 760 : 820) * u; g.jumps++; g.air = true;
            S.burst(S.W * 0.18, S.H * 0.8 - g.y, '#fde68a', 6, 120);
            if (g.jumps === 2) S.ring(S.W * 0.18, S.H * 0.8 - g.y, '#fde68a');
        }
    },
    update(S, dt) {
        const g = this.s, W = S.W, H = S.H, u = mgClamp(H / 360, 0.7, 1.8), gy = H * 0.8, k = S.keys;
        g.sp = (300 + Math.min(260, g.dist / (60 * u) * 1)) * u;
        g.dist += g.sp * dt;
        g.duck = !!(k.ArrowDown || k.KeyS || (S.ptr.down && S.ptr.y > H * 0.72)) && g.y <= 0;
        // fisika
        g.vy -= 2400 * u * dt; g.y += g.vy * dt;
        if (g.y <= 0) {
            if (g.air) { S.burst(W * 0.18, gy, '#d6b98c', 8, 120); g.air = false; }
            g.y = 0; g.vy = 0; g.jumps = 0;
        }
        if (g.y <= 0 && Math.random() < 0.5) S.parts.push({ x: W * 0.18 - 10, y: gy - 2, vx: -g.sp * 0.3, vy: -mgRnd(10, 50), g: 100, life: 0.35, max: 0.35, c: '#d6b98c', s: 2.5 });
        // spawn
        g.next -= g.sp * dt;
        if (g.next <= 0) {
            g.next = g.sp * mgRnd(0.85, 1.5);
            const r = Math.random(), x = W + 60;
            if (g.dist > 1500 * u && r < 0.25) g.obs.push({ t: 'bird', x, y: gy - 62 * u, w: 40 * u, h: 28 * u });
            else if (r < 0.55) g.obs.push({ t: 'cactus', x, y: gy - 46 * u, w: 28 * u, h: 46 * u });
            else if (r < 0.8) g.obs.push({ t: 'rock', x, y: gy - 30 * u, w: 38 * u, h: 30 * u });
            else g.obs.push({ t: 'cactus2', x, y: gy - 46 * u, w: 56 * u, h: 46 * u });
        }
        g.cn -= g.sp * dt;
        if (g.cn <= 0) {
            g.cn = g.sp * mgRnd(1.4, 2.8);
            const lvl = [20, 90, 150][Math.floor(Math.random() * 3)] * u;
            for (let i = 0; i < 4; i++) g.coins.push({ x: W + 60 + i * 38 * u, y: lvl + Math.sin(i) * 8 * u });
        }
        for (const o of g.obs) o.x -= g.sp * dt;
        for (const c of g.coins) c.x -= g.sp * dt;
        g.obs = g.obs.filter(o => o.x > -100);
        // tabrakan
        const px = W * 0.18, pw = 30 * u, ph = g.duck ? 26 * u : 46 * u, pb = gy - g.y;
        const box = { x: px - pw / 2 + 5, y: pb - ph + 4, w: pw - 10, h: ph - 8 };
        for (const o of g.obs) {
            if (box.x < o.x + o.w - 5 && box.x + box.w > o.x + 5 && box.y < o.y + o.h - 4 && box.y + box.h > o.y + 4) {
                S.shake = 16; S.flash = 1; S.burst(px, pb - ph / 2, '#fbbf24', 28, 320); S.ring(px, pb - ph / 2, '#fff');
                S.end(); return;
            }
        }
        for (let i = g.coins.length - 1; i >= 0; i--) {
            const c = g.coins[i], cy = gy - c.y;
            if (Math.hypot(c.x - px, cy - (pb - ph / 2)) < 30 * u) {
                g.stars++; S.burst(c.x, cy, '#fde047', 8, 160); S.float(c.x, cy - 16, '+5', '#fde047', 16); g.coins.splice(i, 1);
            } else if (c.x < -40) g.coins.splice(i, 1);
        }
        S.setScore(Math.floor(g.dist / (25 * u)) + g.stars * 5);
    },
    draw(S, ctx) {
        const g = this.s, W = S.W, H = S.H, u = mgClamp(H / 360, 0.7, 1.8), gy = H * 0.8;
        const night = 0.5 - 0.5 * Math.cos(6.283 * g.dist / (6000 * u));
        const sky = ctx.createLinearGradient(0, 0, 0, gy);
        sky.addColorStop(0, mgMix([125, 211, 252], [11, 16, 38], night));
        sky.addColorStop(1, mgMix([254, 243, 199], [30, 27, 75], night));
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        if (night > 0.3) {
            ctx.fillStyle = '#fff';
            for (const s of S.stars) { if (s.y > gy) continue; ctx.globalAlpha = night * (0.4 + 0.5 * Math.sin(S.t * 2 + s.x)); ctx.fillRect(s.x, s.y, 1.6, 1.6); }
            ctx.globalAlpha = 1;
        }
        ctx.textAlign = 'center'; ctx.font = `${50 * u}px serif`;
        ctx.fillText(night > 0.5 ? '🌙' : '☀️', W * 0.82, H * 0.2);
        ctx.globalAlpha = 0.75; ctx.font = `${44 * u}px serif`;
        for (let i = 0; i < 4; i++) {
            const span = W + 140, x = (((i * W / 3.2 - g.dist * 0.08) % span) + span) % span - 70;
            ctx.fillText('☁️', x, H * (0.14 + 0.07 * (i % 3)) + 30);
        }
        ctx.globalAlpha = 1;
        // gunung
        [{ k: 0.15, h: 90, c1: [100, 116, 139], c2: [30, 41, 59], p: 120 }, { k: 0.35, h: 55, c1: [71, 85, 105], c2: [15, 23, 42], p: 70 }].forEach(l => {
            ctx.fillStyle = mgMix(l.c1, l.c2, night);
            ctx.beginPath(); ctx.moveTo(0, gy);
            for (let x = 0; x <= W + 8; x += 8) {
                const o = x + g.dist * l.k;
                ctx.lineTo(x, gy - (l.h * u * 0.6) - Math.sin(o / (l.p * u)) * l.h * u * 0.35 - Math.sin(o / (l.p * u * 0.37)) * l.h * u * 0.12);
            }
            ctx.lineTo(W, gy); ctx.closePath(); ctx.fill();
        });
        // tanah
        ctx.fillStyle = mgMix([120, 53, 15], [30, 20, 15], night); ctx.fillRect(0, gy, W, H - gy);
        ctx.fillStyle = mgMix([101, 163, 13], [20, 83, 45], night); ctx.fillRect(0, gy, W, 7 * u);
        ctx.fillStyle = 'rgba(0,0,0,.18)';
        const step = 60 * u;
        for (let x = -(g.dist % step); x < W; x += step) ctx.fillRect(x, gy + 22 * u, 24 * u, 3 * u);
        // koin
        ctx.textBaseline = 'middle'; ctx.font = `${26 * u}px serif`;
        for (const c of g.coins) ctx.fillText('⭐', c.x, gy - c.y + Math.sin(S.t * 6 + c.x * 0.05) * 3);
        // rintangan
        ctx.textBaseline = 'bottom';
        for (const o of g.obs) {
            if (o.t === 'cactus') { ctx.font = `${o.h * 1.15}px serif`; ctx.fillText('🌵', o.x + o.w / 2, o.y + o.h + 3 * u); }
            else if (o.t === 'cactus2') { ctx.font = `${o.h * 1.15}px serif`; ctx.fillText('🌵', o.x + o.w * 0.27, o.y + o.h + 3 * u); ctx.fillText('🌵', o.x + o.w * 0.73, o.y + o.h + 3 * u); }
            else if (o.t === 'rock') { ctx.font = `${o.h * 1.2}px serif`; ctx.fillText('🪨', o.x + o.w / 2, o.y + o.h + 3 * u); }
            else { ctx.font = `${o.h * 1.5}px serif`; ctx.fillText('🦅', o.x + o.w / 2, o.y + o.h + 6 * u + Math.sin(S.t * 14) * 3 * u); }
        }
        // pemain
        const px = W * 0.18, pb = gy - g.y;
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(px, gy + 3 * u, 20 * u * (1 - Math.min(0.6, g.y / (200 * u))), 4 * u, 0, 0, 6.283); ctx.fill();
        ctx.save(); ctx.translate(px, pb);
        if (g.y > 0) ctx.rotate(mgClamp(-g.vy * 0.0003, -0.3, 0.3));
        else ctx.translate(0, Math.sin(S.t * 18) * 2 * u);
        if (g.duck) ctx.scale(1.2, 0.58);
        ctx.font = `${46 * u}px serif`; ctx.textBaseline = 'bottom'; ctx.fillText('🏃', 0, 4 * u);
        ctx.restore();
        ctx.textBaseline = 'alphabetic';
        // HUD
        ctx.textAlign = 'left'; ctx.font = '800 13px system-ui'; ctx.fillStyle = night > 0.5 ? '#e2e8f0' : '#0f172a';
        ctx.fillText(`⭐ ${g.stars}`, 12, 26);
    }
};

// ==========================================
// GAME 3: ROKET TERBANG
// ==========================================
GAMES.rocket = {
    title: 'Roket Terbang', icon: '🚀', color: '#8b5cf6',
    desc: 'Terobos celah asteroid & ambil bintang', hint: 'Ketuk / Spasi agar roket naik',
    bg: 'space', dir: 'left', startPress: true,
    init(S) {
        this.s = { y: S.H / 2, vy: 0, pipes: [], st: [], spawn: 0.4, n: 0, trail: 0 };
    },
    resize(S, ow, oh) {
        const g = this.s; if (!g || !ow) return;
        g.y *= S.H / oh;
        g.pipes.forEach(p => { p.x *= S.W / ow; p.gy *= S.H / oh; p.gh *= S.H / oh; p.amp *= S.H / oh; });
        g.st.forEach(s => { s.x *= S.W / ow; s.y *= S.H / oh; });
    },
    press(S) { this.s.vy = -0.95 * S.H; S.ring(S.W * 0.22, this.s.y, 'rgba(255,255,255,.6)'); },
    gapY(p, S) { return mgClamp(p.gy + Math.sin(S.t * 1.5 + p.ph) * p.amp, 24, S.H - 24 - p.gh); },
    update(S, dt) {
        const g = this.s, W = S.W, H = S.H, rx = W * 0.22, r = Math.max(9, H * 0.03);
        g.vy = Math.min(g.vy + 3.0 * H * dt, 1.4 * H); g.y += g.vy * dt;
        const speed = H * 0.5 + Math.min(H * 0.35, g.n * H * 0.012);
        g.spawn -= dt;
        if (g.spawn <= 0) {
            g.spawn = Math.max(1.05, 1.6 - g.n * 0.02);
            const gh = Math.max(H * 0.3 - g.n * H * 0.003, H * 0.24);
            g.pipes.push({ x: W + 40, w: Math.max(46, H * 0.14), gy: mgRnd(H * 0.2, H * 0.8 - gh), gh, ph: mgRnd(0, 6), amp: g.n > 5 ? H * 0.07 : 0, passed: false });
            if (Math.random() < 0.65) g.st.push({ x: W + 40 + speed * g.spawn * 0.5, y: mgRnd(H * 0.2, H * 0.8) });
        }
        for (const p of g.pipes) {
            p.x -= speed * dt;
            const gy = this.gapY(p, S);
            if (!p.passed && p.x + p.w < rx - r) { p.passed = true; g.n++; S.add(1); }
            if (Math.abs(rx - (p.x + p.w / 2)) < p.w / 2 + r * 0.7 && (g.y - r * 0.7 < gy || g.y + r * 0.7 > gy + p.gh)) {
                this.crash(S, rx); return;
            }
        }
        g.pipes = g.pipes.filter(p => p.x > -p.w - 20);
        for (let i = g.st.length - 1; i >= 0; i--) {
            const s = g.st[i]; s.x -= speed * dt;
            if (Math.hypot(s.x - rx, s.y - g.y) < r + 14) { S.add(3); S.burst(s.x, s.y, '#fde047', 10, 180); S.ring(s.x, s.y, '#fde047'); S.float(s.x, s.y - 18, '+3', '#fde047', 17); g.st.splice(i, 1); }
            else if (s.x < -30) g.st.splice(i, 1);
        }
        if (g.y < r || g.y > H - r) { this.crash(S, rx); return; }
        g.trail -= dt;
        if (g.trail <= 0) { g.trail = 0.025; S.parts.push({ x: rx - 14, y: g.y + mgRnd(-3, 3), vx: -speed * 0.7, vy: mgRnd(-25, 25), g: 0, life: 0.4, max: 0.4, c: Math.random() < 0.5 ? '#fb923c' : '#fde047', s: 3.5 }); }
    },
    crash(S, rx) {
        S.shake = 16; S.flash = 1;
        S.burst(rx, this.s.y, '#f43f5e', 26, 320); S.burst(rx, this.s.y, '#fde047', 16, 260); S.ring(rx, this.s.y, '#fff');
        S.end();
    },
    draw(S, ctx) {
        const g = this.s, W = S.W, H = S.H, rx = W * 0.22, r = Math.max(9, H * 0.03);
        for (const p of g.pipes) {
            const gy = this.gapY(p, S);
            const gr = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
            gr.addColorStop(0, '#64748b'); gr.addColorStop(0.5, '#475569'); gr.addColorStop(1, '#1e293b');
            ctx.fillStyle = gr;
            ctx.fillRect(p.x, 0, p.w, gy); ctx.fillRect(p.x, gy + p.gh, p.w, H - gy - p.gh);
            ctx.fillRect(p.x - 5, gy - 16, p.w + 10, 16); ctx.fillRect(p.x - 5, gy + p.gh, p.w + 10, 16);
            ctx.fillStyle = 'rgba(0,0,0,.22)';
            for (let i = 0; i < 4; i++) {
                ctx.beginPath(); ctx.arc(p.x + p.w * (0.3 + (i % 2) * 0.4), (gy / 4) * (i + 0.5), p.w * 0.12, 0, 6.283); ctx.fill();
                ctx.beginPath(); ctx.arc(p.x + p.w * (0.65 - (i % 2) * 0.4), gy + p.gh + ((H - gy - p.gh) / 4) * (i + 0.5), p.w * 0.1, 0, 6.283); ctx.fill();
            }
            ctx.strokeStyle = 'rgba(167,139,250,.7)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(p.x - 5, gy); ctx.lineTo(p.x + p.w + 5, gy); ctx.moveTo(p.x - 5, gy + p.gh); ctx.lineTo(p.x + p.w + 5, gy + p.gh); ctx.stroke();
        }
        ctx.textAlign = 'center'; ctx.font = '26px serif';
        for (const s of g.st) ctx.fillText('⭐', s.x, s.y + 9 + Math.sin(S.t * 5 + s.x) * 3);
        if (S.state !== 'over') {
            ctx.save(); ctx.translate(rx, g.y); ctx.rotate(mgClamp(g.vy / (H * 1.4), -0.5, 0.9));
            const k = r / 10;
            ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.moveTo(-12 * k, -4 * k); ctx.lineTo(-12 * k - (8 + Math.random() * 8) * k, 0); ctx.lineTo(-12 * k, 4 * k); ctx.fill();
            ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.ellipse(0, 0, 15 * k, 8 * k, 0, 0, 6.283); ctx.fill();
            ctx.fillStyle = '#f8fafc'; ctx.beginPath(); ctx.moveTo(10 * k, -6 * k); ctx.lineTo(19 * k, 0); ctx.lineTo(10 * k, 6 * k); ctx.fill();
            ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.arc(3 * k, -1 * k, 3.5 * k, 0, 6.283); ctx.fill();
            ctx.fillStyle = '#be123c'; ctx.beginPath(); ctx.moveTo(-8 * k, -6 * k); ctx.lineTo(-14 * k, -13 * k); ctx.lineTo(-2 * k, -6 * k); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-8 * k, 6 * k); ctx.lineTo(-14 * k, 13 * k); ctx.lineTo(-2 * k, 6 * k); ctx.fill();
            ctx.restore();
        }
    }
};

// ==========================================
// GAME 4: SUSUN MENARA
// ==========================================
GAMES.tower = {
    title: 'Susun Menara', icon: '🏗️', color: '#3b82f6',
    desc: 'Tumpuk balok, raih combo PERFECT', hint: 'Ketuk / Spasi untuk menjatuhkan balok • tepat = PERFECT',
    init(S) {
        const bw = Math.min(S.W * 0.55, 230);
        this.s = { stack: [{ x: (S.W - bw) / 2, w: bw }], deb: [], cam: 0, combo: 0, bw0: bw, x: 0, w: bw, dir: 1, endT: 0 };
        this.spawn(S);
    },
    resize(S, ow) {
        const g = this.s; if (!g || !ow) return; const k = S.W / ow;
        g.stack.forEach(b => { b.x *= k; b.w *= k; }); g.x *= k; g.w *= k; g.bw0 *= k;
        g.deb.forEach(d => { d.x *= k; d.w *= k; });
    },
    bh(S) { return mgClamp(S.H / 14, 18, 34); },
    baseY(S) { return S.H - this.bh(S) * 2.2; },
    hue(i) { return (200 + i * 14) % 360; },
    spawn(S) {
        const g = this.s, top = g.stack[g.stack.length - 1];
        g.w = top.w; g.dir = g.stack.length % 2 ? 1 : -1;
        g.x = g.dir > 0 ? -g.w : S.W;
    },
    curY(S) { return this.baseY(S) - this.s.stack.length * this.bh(S); },
    press(S) {
        const g = this.s;
        if (g.endT > 0) return;
        const top = g.stack[g.stack.length - 1], bh = this.bh(S), n = g.stack.length;
        const l = Math.max(top.x, g.x), r = Math.min(top.x + top.w, g.x + g.w), ow = r - l;
        const wy = this.curY(S);
        if (ow <= 0) {
            g.deb.push({ x: g.x, w: g.w, y: wy, vy: 0, vx: g.dir * 60, h: this.hue(n) });
            S.shake = 10; S.flash = 0.6; g.endT = 0.8; return;
        }
        let nx = l, nw = ow;
        if (Math.abs(g.x - top.x) < Math.max(5, bh * 0.25)) {
            g.combo++;
            nx = top.x; nw = top.w;
            if (g.combo >= 3 && nw < g.bw0) { const add = Math.min(bh * 0.6, g.bw0 - nw); nx -= add / 2; nw += add; }
            const cx = nx + nw / 2, sy = wy + g.cam;
            S.add(1 + g.combo); S.ring(cx, sy, '#fff'); S.burst(cx, sy, '#fde047', 14, 220);
            S.float(cx, sy - 20, g.combo > 1 ? `PERFECT x${g.combo}!` : 'PERFECT!', '#fde047', 20); S.shake = 3;
        } else {
            g.combo = 0; S.add(1);
            if (g.x < top.x) g.deb.push({ x: g.x, w: top.x - g.x, y: wy, vy: 0, vx: -50, h: this.hue(n) });
            else g.deb.push({ x: top.x + top.w, w: g.x + g.w - (top.x + top.w), y: wy, vy: 0, vx: 50, h: this.hue(n) });
        }
        g.stack.push({ x: nx, w: nw });
        this.spawn(S);
    },
    update(S, dt) {
        const g = this.s, W = S.W, bh = this.bh(S), n = g.stack.length;
        for (const d of g.deb) { d.vy += 1600 * dt; d.y += d.vy * dt; d.x += d.vx * dt; }
        g.deb = g.deb.filter(d => d.y + g.cam < S.H + 80);
        const target = Math.max(0, S.H * 0.4 - (this.baseY(S) - n * bh));
        g.cam += (target - g.cam) * Math.min(1, dt * 5);
        if (g.endT > 0) { g.endT -= dt; if (g.endT <= 0) S.end(); return; }
        const sp = Math.min(W * 0.45 + n * W * 0.012, W * 1.2);
        g.x += g.dir * sp * dt;
        if (g.x + g.w > W && g.dir > 0) g.dir = -1;
        if (g.x < 0 && g.dir < 0) g.dir = 1;
    },
    draw(S, ctx) {
        const g = this.s, W = S.W, H = S.H, bh = this.bh(S), n = g.stack.length, base = this.baseY(S);
        const k = Math.min(1, n / 40);
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, mgMix([14, 165, 233], [2, 6, 23], k)); sky.addColorStop(1, mgMix([186, 230, 253], [49, 46, 129], k));
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        if (n > 8) { ctx.fillStyle = '#fff'; for (const s of S.stars) { ctx.globalAlpha = Math.min(1, (n - 8) / 25) * (0.4 + 0.5 * Math.sin(S.t * 2 + s.x)); ctx.fillRect(s.x, s.y, 1.8, 1.8); } ctx.globalAlpha = 1; }
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, base + bh + g.cam, W, H);
        const block = (x, y, w, h, hue) => {
            ctx.fillStyle = `hsl(${hue},75%,56%)`; ctx.fillRect(x, y, w, bh - 1);
            ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x, y, w, 4);
            ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x, y + bh - 5, w, 4);
        };
        g.stack.forEach((b, i) => block(b.x, base - i * bh + g.cam, b.w, bh, this.hue(i)));
        for (const d of g.deb) block(d.x, d.y + g.cam, d.w, bh, d.h);
        if (g.endT <= 0 && S.state !== 'over') block(g.x, this.curY(S) + g.cam, g.w, bh, this.hue(n));
        ctx.textAlign = 'left'; ctx.font = '800 14px system-ui'; ctx.fillStyle = '#fff';
        ctx.fillText(`🏗️ Lantai ${n - 1}`, 12, 26);
        if (g.combo > 1) { ctx.textAlign = 'right'; ctx.fillStyle = '#fde047'; ctx.fillText(`🔥 Combo x${g.combo}`, W - 12, 26); }
    }
};

// ==========================================
// GAME 5: PERTAHANAN BENTENG
// ==========================================
GAMES.castle = {
    title: 'Pertahanan Benteng', icon: '🏰', color: '#10b981',
    desc: 'Panah musuh sebelum menyerbu benteng', hint: 'Ketuk / tahan layar untuk memanah • Spasi = bidik otomatis',
    init(S) {
        this.s = { hp: 10, wave: 1, left: 7, sp: 1, en: [], ar: [], cd: 0, bossP: false, wait: 0 };
    },
    resize(S, ow) { const g = this.s; if (g && ow) { const k = S.W / ow; g.en.forEach(e => e.x *= k); } },
    geo(S) {
        const u = mgClamp(S.H / 360, 0.7, 1.8), gy = S.H * 0.82;
        return { u, gy, cx: Math.max(46 * u, S.W * 0.09), oy: gy - 92 * u };
    },
    shoot(S, tx, ty) {
        const g = this.s, o = this.geo(S);
        if (g.cd > 0) return;
        g.cd = 0.24;
        tx = Math.max(tx, o.cx + 40);
        const a = Math.atan2(ty - o.oy, tx - o.cx);
        g.ar.push({ x: o.cx + 20, y: o.oy, vx: Math.cos(a) * 1000, vy: Math.sin(a) * 1000, a });
        S.burst(o.cx + 20, o.oy, '#fde68a', 3, 90);
    },
    press(S, x, y, key) {
        const g = this.s, o = this.geo(S);
        if (key || x === null) {
            let best = null;
            for (const e of g.en) if (!best || e.x < best.x) best = e;
            if (best) this.shoot(S, best.x, o.gy - best.off - best.r);
            else this.shoot(S, S.W * 0.7, o.gy - 20 * o.u);
        } else this.shoot(S, x, y);
    },
    spawn(S) {
        const g = this.s, o = this.geo(S), u = o.u, w = g.wave, r = Math.random();
        let e;
        if (g.bossP) { g.bossP = false; e = { t: '🐉', hp: 20 + w * 2, sp: 28, r: 44 * u, off: 0, pts: 200, dmg: 3, boss: true }; S.float(S.W / 2, S.H * 0.3, '⚠ NAGA MUNCUL!', '#fca5a5', 26); S.shake = 8; }
        else if (w >= 2 && r < 0.25) e = { t: '🦇', hp: 1, sp: 130 + w * 6, r: 16 * u, off: mgRnd(70, 170) * u, pts: 15, dmg: 1, bat: true };
        else if (w >= 3 && r < 0.55) e = { t: '👹', hp: 3, sp: 38 + w * 2, r: 24 * u, off: 0, pts: 20, dmg: 1 };
        else e = { t: '👺', hp: 1, sp: 60 + w * 3, r: 18 * u, off: 0, pts: 10, dmg: 1 };
        e.max = e.hp; e.x = S.W + 40; e.hit = 0; e.ph = mgRnd(0, 6);
        g.en.push(e);
    },
    update(S, dt) {
        const g = this.s, o = this.geo(S), W = S.W;
        g.cd -= dt;
        if (S.ptr.down) this.shoot(S, S.ptr.x, S.ptr.y);
        // gelombang
        if (g.wait > 0) { g.wait -= dt; if (g.wait <= 0) { g.wave++; g.left = 5 + g.wave * 2; g.bossP = g.wave % 5 === 0; g.hp = Math.min(10, g.hp + 1); S.float(W / 2, S.H * 0.3, `Gelombang ${g.wave}`, '#a7f3d0', 24); } }
        else {
            g.sp -= dt;
            if (g.sp <= 0 && (g.left > 0 || g.bossP)) { g.sp = Math.max(0.5, 1.4 - g.wave * 0.07); if (!g.bossP) g.left--; this.spawn(S); }
            if (g.left <= 0 && !g.bossP && g.en.length === 0) { g.wait = 2; S.add(25); S.float(W / 2, S.H * 0.4, 'Gelombang selesai! +25', '#fde047', 20); }
        }
        // panah
        for (const a of g.ar) { a.x += a.vx * dt; a.y += a.vy * dt; }
        g.ar = g.ar.filter(a => a.x < W + 30 && a.y > -30 && a.y < S.H + 30);
        // musuh
        for (let i = g.en.length - 1; i >= 0; i--) {
            const e = g.en[i];
            e.x -= e.sp * dt; e.hit -= dt;
            const cyOff = e.bat ? e.off + Math.sin(S.t * 5 + e.ph) * 14 * o.u : e.off;
            const ey = o.gy - cyOff - e.r;
            let dead = false;
            for (let j = g.ar.length - 1; j >= 0; j--) {
                const a = g.ar[j];
                if (Math.hypot(a.x - e.x, a.y - ey) < e.r + 6) {
                    g.ar.splice(j, 1); e.hp--; e.hit = 0.1; S.burst(a.x, a.y, '#fde047', 4, 140);
                    if (e.hp <= 0) { dead = true; break; }
                }
            }
            if (dead) {
                S.add(e.pts); S.burst(e.x, ey, e.boss ? '#fb923c' : '#a7f3d0', e.boss ? 36 : 14, e.boss ? 340 : 220); S.ring(e.x, ey, '#fff');
                S.float(e.x, ey - e.r, '+' + e.pts, '#fde047', e.boss ? 22 : 15); if (e.boss) S.shake = 16;
                g.en.splice(i, 1); continue;
            }
            if (e.x < o.cx + 28 * o.u) {
                g.hp -= e.dmg; S.shake = 10; S.flash = 0.8; S.burst(o.cx + 20, ey, '#f87171', 14, 220);
                g.en.splice(i, 1);
                if (g.hp <= 0) { S.burst(o.cx, o.gy - 60 * o.u, '#fde047', 40, 360); S.ring(o.cx, o.gy - 60 * o.u, '#fff'); S.end(); return; }
            } else e.cy = ey;
        }
    },
    draw(S, ctx) {
        const g = this.s, W = S.W, H = S.H, o = this.geo(S), u = o.u, gy = o.gy;
        const sky = ctx.createLinearGradient(0, 0, 0, gy);
        sky.addColorStop(0, '#312e81'); sky.addColorStop(1, '#fda4af');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        for (const s of S.stars) { if (s.y > gy * 0.6) continue; ctx.globalAlpha = 0.3 + 0.5 * Math.sin(S.t * 2 + s.x); ctx.fillRect(s.x, s.y, 1.6, 1.6); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#4c1d95'; ctx.beginPath(); ctx.moveTo(0, gy);
        for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, gy - 50 * u - Math.sin(x / (90 * u)) * 26 * u);
        ctx.lineTo(W, gy); ctx.fill();
        ctx.fillStyle = '#14532d'; ctx.fillRect(0, gy, W, H - gy);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(0, gy, W, 6 * u);
        // benteng
        const cx = o.cx;
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(cx - 26 * u, gy - 84 * u, 52 * u, 84 * u);
        ctx.fillStyle = '#64748b';
        for (let i = 0; i < 4; i++) ctx.fillRect(cx - 26 * u + i * 14 * u, gy - 96 * u, 10 * u, 12 * u);
        ctx.fillStyle = '#334155'; ctx.fillRect(cx - 8 * u, gy - 30 * u, 16 * u, 30 * u);
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(cx - 26 * u, gy - 84 * u, 6 * u, 84 * u);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${22 * u}px serif`;
        ctx.fillText('🏹', cx + 4 * u, o.oy);
        // panah
        ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3;
        for (const a of g.ar) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - Math.cos(a.a) * 18, a.y - Math.sin(a.a) * 18); ctx.stroke(); }
        // musuh
        for (const e of g.en) {
            const cy = e.cy !== undefined ? e.cy : gy - e.off - e.r;
            ctx.save(); ctx.translate(e.x, cy);
            if (e.hit > 0) ctx.globalAlpha = 0.5;
            if (!e.bat) ctx.translate(0, Math.abs(Math.sin(S.t * 8 + e.ph)) * -3 * u);
            ctx.font = `${e.r * 2}px serif`; ctx.fillText(e.t, 0, 0);
            ctx.restore();
            if (e.hp < e.max) {
                ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(e.x - e.r, cy - e.r - 10, e.r * 2, 4);
                ctx.fillStyle = '#f43f5e'; ctx.fillRect(e.x - e.r, cy - e.r - 10, e.r * 2 * (e.hp / e.max), 4);
            }
        }
        ctx.textBaseline = 'alphabetic';
        // HUD
        ctx.textAlign = 'left'; ctx.font = '800 14px system-ui'; ctx.fillStyle = '#fff';
        ctx.fillText('❤️'.repeat(Math.max(0, g.hp)), 12, 26);
        ctx.textAlign = 'right'; ctx.fillText(`Gelombang ${g.wave}`, W - 12, 26);
    }
};

// ==========================================
// GAME 6: BALAP MOTOR
// ==========================================
function mgRR(ctx, x, y, w, h, r, c) {
    ctx.fillStyle = c; ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
}

GAMES.racer = {
    title: 'Balap Motor', icon: '🏍️', color: '#f97316',
    desc: 'Salip mobil, ambil nitro & bintang', hint: 'Ketuk kiri/kanan layar atau ←/→ untuk pindah jalur',
    init(S) {
        this.s = { lane: 1, x: this.laneX(S, 1), v: 0, dist: 0, dsc: 0, obs: [], pk: [], trees: [], next: H0(S) * 0.5, tn: 0, nitro: 0, slip: 0, stars: 0, kl: false, kr: false, tilt: 0 };
        function H0(S) { return S.H; }
    },
    geo(S) {
        const lw = mgClamp(Math.min(S.W * 0.3, S.H * 0.22), 40, 120);
        return { lw, rw: lw * 3, left: (S.W - lw * 3) / 2, py: S.H * 0.78, s: lw / 60 };
    },
    laneX(S, l) { const o = this.geo(S); return o.left + o.lw * (l + 0.5); },
    resize(S, ow, oh) {
        const g = this.s; if (!g || !ow) return;
        const k = S.H / oh;
        g.obs.forEach(o => o.y *= k); g.pk.forEach(o => o.y *= k);
        g.trees.forEach(t => { t.y *= k; t.x *= S.W / ow; });
        g.x = this.laneX(S, g.lane);
    },
    press(S, x, y, key) {
        if (key || x === null) return;
        const g = this.s;
        if (x < S.W / 2) g.lane = Math.max(0, g.lane - 1); else g.lane = Math.min(2, g.lane + 1);
    },
    update(S, dt) {
        const g = this.s, o = this.geo(S), H = S.H, W = S.W, k = S.keys;
        const kl = !!(k.ArrowLeft || k.KeyA), kr = !!(k.ArrowRight || k.KeyD);
        if (kl && !g.kl) g.lane = Math.max(0, g.lane - 1);
        if (kr && !g.kr) g.lane = Math.min(2, g.lane + 1);
        g.kl = kl; g.kr = kr;
        g.nitro -= dt; g.slip -= dt;
        let v = H * (0.7 + Math.min(0.6, g.dist / (H * 70)));
        if (g.nitro > 0) v *= 1.45;
        if (g.slip > 0) v *= 0.65;
        g.v = v; g.dist += v * dt;
        const dx = this.laneX(S, g.lane) - g.x;
        g.x += dx * Math.min(1, dt * 12); g.tilt = mgClamp(dx / o.lw, -1, 1);
        if (g.slip > 0) g.x += Math.sin(S.t * 30) * o.lw * 0.02;
        const nd = Math.floor(g.dist / (H * 0.25));
        if (nd > g.dsc) { S.add(nd - g.dsc); g.dsc = nd; }
        const px = g.x, py = o.py;

        // spawn
        g.next -= v * dt;
        if (g.next <= 0) {
            g.next = H * mgRnd(0.32, 0.55);
            const lane = Math.floor(Math.random() * 3), r = Math.random(), cols = ['#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#14b8a6'];
            if (r < 0.1) g.pk.push({ t: 'nitro', lane, y: -40 });
            else if (r < 0.35) for (let i = 0; i < 3; i++) g.pk.push({ t: 'star', lane, y: -40 - i * o.lw * 0.75 });
            else if (r < 0.5 && g.dist > H * 8) g.obs.push({ t: 'oil', lane, y: -40, k: 0 });
            else {
                const mk = (ln) => {
                    const truck = Math.random() < 0.25 && g.dist > H * 10;
                    const wr = truck ? 0.7 : 0.62;
                    return { t: truck ? 'truck' : 'car', lane: ln, wr, hr: wr * (truck ? 3 : 1.9), y: -wr * (truck ? 3 : 1.9) * o.lw, k: truck ? mgRnd(0.2, 0.35) : mgRnd(0.25, 0.5), c: cols[Math.floor(Math.random() * cols.length)], passed: false };
                };
                g.obs.push(mk(lane));
                if (Math.random() < 0.3 && g.dist > H * 15) g.obs.push(mk((lane + 1 + Math.floor(Math.random() * 2)) % 3));
            }
        }
        // pemandangan
        g.tn -= v * dt;
        if (g.tn <= 0) {
            g.tn = H * mgRnd(0.12, 0.3);
            const space = o.left - 24;
            if (space > 16) {
                const side = Math.random() < 0.5;
                g.trees.push({ x: side ? mgRnd(10, o.left - 12) : mgRnd(o.left + o.rw + 12, W - 10), y: -40, e: ['🌲', '🌳', '🌴', '🪨'][Math.floor(Math.random() * 4)] });
            }
        }
        for (const t of g.trees) t.y += v * dt;
        g.trees = g.trees.filter(t => t.y < H + 60);

        // pickup
        for (let i = g.pk.length - 1; i >= 0; i--) {
            const p = g.pk[i]; p.y += v * dt;
            const cx = this.laneX(S, p.lane);
            if (Math.abs(cx - px) < o.lw * 0.4 && Math.abs(p.y - py) < o.lw * 0.45) {
                if (p.t === 'star') { g.stars++; S.add(5); S.float(cx, p.y - 14, '+5', '#fde047', 15); S.burst(cx, p.y, '#fde047', 8, 150); }
                else { g.nitro = 3.5; S.float(cx, p.y - 20, '⚡ NITRO!', '#fb923c', 22); S.ring(px, py, '#fb923c'); S.shake = 5; }
                g.pk.splice(i, 1);
            } else if (p.y > H + 60) g.pk.splice(i, 1);
        }
        // rintangan
        const hw = 8 * o.s, hh = 26 * o.s;
        for (let i = g.obs.length - 1; i >= 0; i--) {
            const c = g.obs[i], cx = this.laneX(S, c.lane);
            c.y += v * (1 - (c.k || 0)) * dt;
            const cw = (c.wr || 0) * o.lw, ch = (c.hr || 0) * o.lw;
            if (c.t === 'oil') {
                if (!c.done && Math.abs(cx - px) < o.lw * 0.35 && Math.abs(c.y - py) < o.lw * 0.3) { c.done = true; g.slip = 1.2; S.shake = 5; S.float(px, py - 44, 'Licin!', '#fbbf24', 16); }
            } else {
                if (Math.abs(cx - px) < cw * 0.46 + hw && Math.abs(c.y - py) < ch * 0.46 + hh) {
                    if (g.nitro > 0) {
                        S.burst(cx, c.y, '#fb923c', 22, 320); S.ring(cx, c.y, '#fff'); S.add(10); S.float(cx, c.y - 20, '+10 SERUDUK!', '#fde047', 16); S.shake = 9;
                        g.obs.splice(i, 1); continue;
                    }
                    S.shake = 18; S.flash = 1; S.burst(px, py, '#f87171', 24, 320); S.burst(px, py, '#fde047', 14, 260); S.ring(px, py, '#fff');
                    S.end(); return;
                }
                if (!c.passed && c.y > py + ch * 0.5 + hh) {
                    c.passed = true;
                    if (Math.abs(cx - px) < o.lw * 1.15) { S.add(3); S.float(px, py - 54, 'Nyaris! +3', '#a7f3d0', 15); }
                }
            }
            if (c.y > H + 200) g.obs.splice(i, 1);
        }
        // knalpot
        if (g.nitro > 0) S.parts.push({ x: px + mgRnd(-3, 3), y: py + 30 * o.s, vx: mgRnd(-30, 30), vy: mgRnd(150, 300), g: 0, life: 0.35, max: 0.35, c: Math.random() < 0.5 ? '#fb923c' : '#fde047', s: 4 });
        else if (Math.random() < 0.3) S.parts.push({ x: px, y: py + 30 * o.s, vx: mgRnd(-15, 15), vy: 90, g: 0, life: 0.35, max: 0.35, c: 'rgba(203,213,225,.7)', s: 3 });
    },
    draw(S, ctx) {
        const g = this.s, o = this.geo(S), W = S.W, H = S.H, lw = o.lw, d = g.dist;
        ctx.fillStyle = '#166534'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(255,255,255,.05)';
        for (let y = -120 + (d % 120); y < H; y += 120) ctx.fillRect(0, y, W, 60);
        ctx.fillStyle = '#334155'; ctx.fillRect(o.left, 0, o.rw, H);
        // trotoar merah-putih
        const cw = 8 * o.s, step = 30, base = d % (step * 2);
        for (let y = -step * 2 + base; y < H; y += step) {
            const idx = Math.round((y - base) / step), c = idx % 2 === 0 ? '#ef4444' : '#f8fafc';
            ctx.fillStyle = c; ctx.fillRect(o.left - cw, y, cw, step); ctx.fillRect(o.left + o.rw, y, cw, step);
        }
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        for (let l = 1; l <= 2; l++) for (let y = -60 + (d % 60); y < H; y += 60) ctx.fillRect(o.left + lw * l - 2, y, 4, 30);
        // pepohonan
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `${lw * 0.7}px serif`;
        for (const t of g.trees) ctx.fillText(t.e, t.x, t.y);
        // item
        for (const p of g.pk) {
            const cx = this.laneX(S, p.lane);
            if (p.t === 'star') { ctx.font = `${lw * 0.45}px serif`; ctx.fillText('⭐', cx, p.y + Math.sin(S.t * 6 + p.y * 0.05) * 3); }
            else {
                ctx.fillStyle = `rgba(251,146,60,${0.25 + 0.15 * Math.sin(S.t * 8)})`; ctx.beginPath(); ctx.arc(cx, p.y, lw * 0.36, 0, 6.283); ctx.fill();
                ctx.font = `${lw * 0.5}px serif`; ctx.fillText('⚡', cx, p.y);
            }
        }
        // rintangan
        for (const c of g.obs) {
            const cx = this.laneX(S, c.lane), w = c.wr * lw, h = c.hr * lw;
            if (c.t === 'oil') {
                ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.ellipse(cx, c.y, lw * 0.36, lw * 0.22, 0, 0, 6.283); ctx.fill();
                ctx.fillStyle = 'rgba(129,140,248,.35)'; ctx.beginPath(); ctx.ellipse(cx - lw * 0.08, c.y - lw * 0.05, lw * 0.14, lw * 0.07, 0, 0, 6.283); ctx.fill();
                continue;
            }
            ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(cx - w / 2 + 3, c.y - h / 2 + 4, w, h);
            if (c.t === 'truck') {
                mgRR(ctx, cx - w / 2, c.y - h / 2, w, h, w * 0.1, '#e2e8f0');
                mgRR(ctx, cx - w / 2, c.y - h / 2, w, h * 0.28, w * 0.1, c.c);
                mgRR(ctx, cx - w * 0.38, c.y - h / 2 + h * 0.06, w * 0.76, h * 0.12, 3, '#0f172a');
            } else {
                mgRR(ctx, cx - w / 2, c.y - h / 2, w, h, w * 0.2, c.c);
                mgRR(ctx, cx - w * 0.38, c.y - h * 0.26, w * 0.76, h * 0.18, 3, '#0f172a');
                mgRR(ctx, cx - w * 0.38, c.y + h * 0.1, w * 0.76, h * 0.14, 3, '#1e293b');
            }
            ctx.fillStyle = '#ef4444'; ctx.fillRect(cx - w * 0.42, c.y + h / 2 - 6, w * 0.24, 5); ctx.fillRect(cx + w * 0.18, c.y + h / 2 - 6, w * 0.24, 5);
        }
        // motor pemain
        if (S.state !== 'over') {
            const s = o.s;
            ctx.save(); ctx.translate(g.x, o.py); ctx.rotate(g.tilt * 0.35); ctx.scale(s, s);
            if (g.nitro > 0) {
                ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.moveTo(-5, 30); ctx.lineTo(5, 30); ctx.lineTo(0, 30 + 16 + Math.random() * 12); ctx.fill();
            }
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-4, 14, 8, 18); ctx.fillRect(-4, -36, 8, 14);
            ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.ellipse(0, -2, 9, 26, 0, 0, 6.283); ctx.fill();
            ctx.fillStyle = '#cbd5e1'; ctx.fillRect(-17, -20, 34, 4);
            ctx.fillStyle = '#1d4ed8'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, 6.283); ctx.fill();
            ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(0, -4, 7, 0, 6.283); ctx.fill();
            ctx.fillStyle = '#0f172a'; ctx.fillRect(-5, -8, 10, 3);
            ctx.restore();
        }
        if (g.nitro > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
            for (let i = 0; i < 14; i++) { const x = mgRnd(0, W), y = mgRnd(0, H); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke(); }
        }
        // HUD
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.font = '800 14px system-ui'; ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 3;
        const kmh = `${Math.round(g.v / H * 150)} km/j`;
        ctx.strokeText(kmh, 12, 26); ctx.fillText(kmh, 12, 26);
        ctx.textAlign = 'right'; ctx.strokeText(`⭐ ${g.stars}`, W - 12, 26); ctx.fillText(`⭐ ${g.stars}`, W - 12, 26);
        if (g.nitro > 0) {
            const bw = Math.min(W * 0.4, 160);
            ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(W / 2 - bw / 2, 14, bw, 8);
            ctx.fillStyle = '#fb923c'; ctx.fillRect(W / 2 - bw / 2, 14, bw * Math.min(1, g.nitro / 3.5), 8);
        }
    }
};
