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

// Penanda peralihan tampilan game <-> menu. app.js membacanya agar peralihan
// internal ini tidak dihitung sebagai pelanggaran (lihat isGameTransition di app.js).
function mgGuard(ms = 1500) {
    try { window.cbtGameGuardUntil = Math.max(window.cbtGameGuardUntil || 0, Date.now() + ms); } catch (e) {}
}

// ------------------------------------------
// Helper gambar vektor (pengganti emoji: tegas, tidak transparan, arah pasti)
// ------------------------------------------
function mgCirc(ctx, x, y, r, f, s) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = f; ctx.fill();
    if (s) { ctx.strokeStyle = s; ctx.lineWidth = 2; ctx.stroke(); }
}
function mgRRs(ctx, x, y, w, h, r, f, s) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fillStyle = f; ctx.fill();
    if (s) { ctx.strokeStyle = s; ctx.lineWidth = 2; ctx.stroke(); }
}
function mgPoly(ctx, pts, f, s) {
    ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
    ctx.closePath(); ctx.fillStyle = f; ctx.fill();
    if (s) { ctx.strokeStyle = s; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); }
}
function mgStar(ctx, x, y, r, c = '#fde047') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? r * 0.45 : r;
        if (i) ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); else ctx.moveTo(x + Math.cos(a) * k, y + Math.sin(a) * k);
    }
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.strokeStyle = '#b45309'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.lineJoin = 'round'; ctx.stroke();
}
function mgHeart(ctx, x, y, r, c = '#ef4444') {
    ctx.beginPath(); ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.8, y - r * 1.2, x, y - r * 0.45);
    ctx.bezierCurveTo(x + r * 0.8, y - r * 1.2, x + r * 1.6, y - r * 0.1, x, y + r * 0.9);
    ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
}
function mgBolt(ctx, x, y, r, c = '#fde047') {
    mgPoly(ctx, [[x + r * 0.2, y - r], [x - r * 0.6, y + r * 0.1], [x - r * 0.05, y + r * 0.1], [x - r * 0.25, y + r], [x + r * 0.6, y - r * 0.2], [x + r * 0.05, y - r * 0.2]], c, '#92400e');
}
function mgShield(ctx, x, y, r, c = '#38bdf8') {
    ctx.beginPath(); ctx.moveTo(x - r * 0.8, y - r * 0.8); ctx.lineTo(x + r * 0.8, y - r * 0.8); ctx.lineTo(x + r * 0.8, y + r * 0.1);
    ctx.quadraticCurveTo(x + r * 0.7, y + r * 0.8, x, y + r); ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.8, x - r * 0.8, y + r * 0.1); ctx.closePath();
    ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = '#075985'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
}
const MG_PW = { multi: '#f59e0b', rapid: '#eab308', bomb: '#ef4444', freeze: '#38bdf8', heal: '#f43f5e', shield: '#22d3ee' };
function mgPower(ctx, t, x, y, r) {
    mgCirc(ctx, x, y, r, 'rgba(15,23,42,.92)');
    ctx.strokeStyle = MG_PW[t]; ctx.lineWidth = Math.max(2, r * 0.14); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke();
    const k = r * 0.6;
    if (t === 'multi') {
        ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2;
        for (const a of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.moveTo(x - k * 0.2, y + k * 0.8); ctx.lineTo(x + Math.sin(a) * k * 1.3, y - Math.cos(a) * k); ctx.stroke(); }
    } else if (t === 'rapid') mgBolt(ctx, x, y, k);
    else if (t === 'bomb') {
        mgCirc(ctx, x, y + k * 0.2, k * 0.8, '#6b7280', '#e5e7eb');
        ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + k * 0.4, y - k * 0.4); ctx.lineTo(x + k * 0.8, y - k * 0.9); ctx.stroke();
        mgStar(ctx, x + k * 0.9, y - k * 1.0, k * 0.3);
    } else if (t === 'freeze') {
        ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 2.5;
        for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * k, y - Math.sin(a) * k); ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); ctx.stroke(); }
    } else if (t === 'heal') mgHeart(ctx, x, y, k * 0.9);
    else mgShield(ctx, x, y, k);
}

// ---- Sprite musuh: semua MENGHADAP KIRI (menuju benteng), titik asal = tengah badan ----
function mgSpriteGob(ctx, r, t, o) {
    const s = r / 18, sw = Math.sin(t * 10) * 5 * s;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.leg; ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.moveTo(-3 * s, 10 * s); ctx.lineTo(-3 * s + sw, 18 * s); ctx.moveTo(4 * s, 10 * s); ctx.lineTo(4 * s - sw, 18 * s); ctx.stroke();
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(-10 * s, 6 * s); ctx.lineTo(-25 * s, -6 * s - Math.sin(t * 10) * 2 * s); ctx.stroke();
    if (o.club) mgCirc(ctx, -25 * s, -7 * s, 5 * s, '#78350f', '#451a03');
    mgRRs(ctx, -10 * s, -3 * s, 20 * s, 17 * s, 5 * s, o.cloth, '#1c1917');
    if (o.armor) mgRRs(ctx, -10 * s, -3 * s, 20 * s, 8 * s, 3 * s, '#94a3b8', '#334155');
    if (!o.noEars) {
        mgPoly(ctx, [[-8 * s, -12 * s], [-21 * s, -17 * s], [-9 * s, -5 * s]], o.skin, '#14532d');
        mgPoly(ctx, [[6 * s, -13 * s], [15 * s, -19 * s], [8 * s, -5 * s]], o.skin, '#14532d');
    }
    mgCirc(ctx, -1 * s, -10 * s, 10 * s, o.skin, '#14532d');
    if (o.helm) {
        ctx.beginPath(); ctx.arc(-1 * s, -12 * s, 11 * s, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#94a3b8'; ctx.fill();
        ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.stroke(); mgRRs(ctx, -3 * s, -24 * s, 4 * s, 9 * s, 2 * s, '#ef4444');
    }
    mgCirc(ctx, -6 * s, -10 * s, 3.2 * s, '#fff', '#111'); mgCirc(ctx, -7 * s, -10 * s, 1.5 * s, '#dc2626');
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-11 * s, -15 * s); ctx.lineTo(-3 * s, -12 * s); ctx.stroke();
    if (o.tusk) mgPoly(ctx, [[-9 * s, -3 * s], [-11 * s, -10 * s], [-5 * s, -4 * s]], '#fff', '#111');
    if (o.shield) { mgCirc(ctx, -14 * s, 5 * s, 8 * s, '#64748b', '#1e293b'); mgCirc(ctx, -14 * s, 5 * s, 2.5 * s, '#fbbf24'); }
}
function mgSpriteBat(ctx, r, t) {
    const s = r / 16, f = Math.sin(t * 16);
    for (const d of [1, -1]) mgPoly(ctx, [[d * 2 * s, -2 * s], [d * 18 * s, (-16 - f * 10) * s], [d * 25 * s, (2 - f * 6) * s], [d * 15 * s, 0], [d * 10 * s, 8 * s], [d * 4 * s, 3 * s]], '#7c3aed', '#2e1065');
    mgCirc(ctx, 0, 3 * s, 8 * s, '#4c1d95', '#2e1065');
    mgPoly(ctx, [[-6 * s, -8 * s], [-9 * s, -17 * s], [-2 * s, -10 * s]], '#5b21b6', '#2e1065');
    mgPoly(ctx, [[2 * s, -10 * s], [5 * s, -17 * s], [6 * s, -7 * s]], '#5b21b6', '#2e1065');
    mgCirc(ctx, -1 * s, -4 * s, 7 * s, '#5b21b6', '#2e1065');
    mgCirc(ctx, -4 * s, -5 * s, 2.4 * s, '#fff', '#111'); mgCirc(ctx, 1 * s, -5 * s, 2.4 * s, '#fff', '#111');
    mgCirc(ctx, -4.6 * s, -5 * s, 1.1 * s, '#dc2626'); mgCirc(ctx, 0.4 * s, -5 * s, 1.1 * s, '#dc2626');
    mgPoly(ctx, [[-4 * s, 0], [-3 * s, 4 * s], [-2 * s, 0]], '#fff'); mgPoly(ctx, [[0, 0], [1 * s, 4 * s], [2 * s, 0]], '#fff');
}
function mgSpriteFire(ctx, r, t) {
    const s = r / 20, f = Math.sin(t * 12);
    mgPoly(ctx, [[8 * s, 0], [26 * s, (-8 + f * 3) * s], [21 * s, 0], [28 * s, (8 - f * 3) * s], [8 * s, 5 * s]], '#f97316', '#9a3412');
    mgPoly(ctx, [[0, -4 * s], [10 * s, (-24 - f * 10) * s], [17 * s, -6 * s]], '#fbbf24', '#b45309');
    ctx.beginPath(); ctx.ellipse(0, 2 * s, 14 * s, 9 * s, 0, 0, 6.283); ctx.fillStyle = '#ef4444'; ctx.fill(); ctx.strokeStyle = '#7f1d1d'; ctx.lineWidth = 2; ctx.stroke();
    mgPoly(ctx, [[-14 * s, -8 * s], [-12 * s, -17 * s], [-8 * s, -9 * s], [-4 * s, -15 * s], [-3 * s, -8 * s]], '#fbbf24', '#b45309');
    mgCirc(ctx, -12 * s, -3 * s, 8 * s, '#f97316', '#9a3412');
    mgPoly(ctx, [[-19 * s, -5 * s], [-29 * s, -2 * s], [-19 * s, 0]], '#fde047', '#a16207');
    mgCirc(ctx, -14 * s, -6 * s, 2.6 * s, '#fff', '#111'); mgCirc(ctx, -14.8 * s, -6 * s, 1.2 * s, '#111');
}
function mgSpriteDragon(ctx, r, t) {
    const s = r / 46, f = Math.sin(t * 5);
    mgPoly(ctx, [[5 * s, -10 * s], [30 * s, (-60 - f * 14) * s], [54 * s, (-30 - f * 10) * s], [40 * s, -10 * s], [20 * s, 0]], '#15803d', '#052e16');
    ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 12 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(25 * s, 5 * s); ctx.quadraticCurveTo(55 * s, 22 * s, 62 * s, (-10 + f * 8) * s); ctx.stroke();
    mgRRs(ctx, -16 * s, 14 * s, 9 * s, 16 * s, 3 * s, '#15803d', '#052e16'); mgRRs(ctx, 8 * s, 14 * s, 9 * s, 16 * s, 3 * s, '#15803d', '#052e16');
    ctx.beginPath(); ctx.ellipse(0, 5 * s, 31 * s, 20 * s, 0, 0, 6.283); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#052e16'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-4 * s, 13 * s, 21 * s, 8 * s, 0, 0, 6.283); ctx.fillStyle = '#bbf7d0'; ctx.fill();
    ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 12 * s; ctx.beginPath(); ctx.moveTo(-22 * s, 0); ctx.lineTo(-32 * s, -10 * s); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-38 * s, -12 * s, 17 * s, 11 * s, -0.15, 0, 6.283); ctx.fillStyle = '#22c55e'; ctx.fill(); ctx.strokeStyle = '#052e16'; ctx.lineWidth = 2.5; ctx.stroke();
    mgPoly(ctx, [[-34 * s, -20 * s], [-28 * s, -34 * s], [-26 * s, -20 * s]], '#fde68a', '#92400e');
    mgPoly(ctx, [[-42 * s, -21 * s], [-42 * s, -34 * s], [-36 * s, -21 * s]], '#fde68a', '#92400e');
    mgCirc(ctx, -42 * s, -14 * s, 3.6 * s, '#fde047', '#111'); mgCirc(ctx, -43 * s, -14 * s, 1.5 * s, '#111');
    mgCirc(ctx, -52 * s, -11 * s, 1.6 * s, '#052e16');
    if (f > 0) mgPoly(ctx, [[-54 * s, -6 * s], [-66 * s, (-2 + f * 3) * s], [-54 * s, 0]], '#fb923c');
    mgPoly(ctx, [[-5 * s, -5 * s], [15 * s, (-50 - f * 12) * s], [40 * s, (-22 - f * 8) * s], [22 * s, 0]], '#4ade80', '#052e16');
}

// ------------------------------------------
// Kontrol dasar
// ------------------------------------------
function stopActiveLoop() {
    if (gameLoopId) { cancelAnimationFrame(gameLoopId); gameLoopId = null; }
    if (keydownHandler) { document.removeEventListener('keydown', keydownHandler); keydownHandler = null; }
    closeStage();
}

function closeStage() {
    mgGuard(1500);
    if (!mgS) return;
    const S = mgS;
    mgS = null;
    S.dead = true;
    S.cleanup.forEach(f => { try { f(); } catch (e) {} });
    S.ov.remove();

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
      font-family:system-ui,-apple-system,sans-serif;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;overscroll-behavior:contain;
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
    mgGuard(1500);
    stopActiveLoop();
    mgInjectStyles();
    const hub = getOrCreateHubContainer();
    if (!hub) return;

    hub.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:14px;">
            <div style="text-align:center;margin-bottom:10px;">
                <div class="mgh-title" style="font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;">Mini-Game Standby</div>
                <div style="font-size:10px;color:#94a3b8;margin-top:2px;">SMAN 1 Jakarta</div>
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
function openStage(id) {
    const def = GAMES[id];
    if (!def) return;
    mgGuard(1500);
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

        </div>
        <canvas id="mgCanvas"></canvas>`;
    document.body.appendChild(ov);



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

    ov.querySelector('#mgBack').onclick = () => { mgGuard(1500); closeStage(); };



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
    const ry = cy - f * 2.6 + Math.sin(S.t * 4) * 6;
    mgCirc(ctx, W / 2, ry, f * 0.95, over ? '#ef4444' : S.def.color, '#fff');
    if (over) { ctx.fillStyle = '#fff'; ctx.font = `800 ${f * 1.2}px system-ui`; ctx.fillText('!', W / 2, ry + 2); } else mgStar(ctx, W / 2, ry, f * 0.6, '#fff');

    ctx.fillStyle = '#fff'; ctx.font = `800 ${f}px system-ui`;
    ctx.fillText(over ? 'Permainan Selesai!' : S.def.title, W / 2, cy - f * 0.8);
    ctx.font = `600 ${f * 0.48}px system-ui`; ctx.fillStyle = '#cbd5e1';
    if (over) {
        ctx.fillText(`Skor ${S.score}  •  Rekor ${S.best}`, W / 2, cy + f * 0.1);
        if (S.newBest) { ctx.fillStyle = '#fde047'; ctx.fillText('Rekor baru!', W / 2, cy + f * 0.75); }
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
            S.float(W / 2, H * 0.35, 'BOSS!', '#fca5a5', 28); S.shake = 8;
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
            mgPower(ctx, p.t === 't' ? 'multi' : p.t === 's' ? 'shield' : 'heal', p.x, p.y + Math.sin(S.t * 6) * 3, 15);
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
        for (let i = 0; i < g.lives; i++) mgHeart(ctx, 20 + i * 20, 24, 8);
        ctx.textAlign = 'right'; ctx.font = '800 13px system-ui'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(`LEVEL ${g.lv}${g.tri > 0 ? '  GANDA ' + Math.ceil(g.tri) + 's' : ''}`, W - 12, 26);
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
        const top = mgMix([125, 211, 252], [11, 16, 38], night);
        const sky = ctx.createLinearGradient(0, 0, 0, gy);
        sky.addColorStop(0, top); sky.addColorStop(1, mgMix([254, 243, 199], [30, 27, 75], night));
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        if (night > 0.3) {
            ctx.fillStyle = '#fff';
            for (const s of S.stars) { if (s.y > gy) continue; ctx.globalAlpha = night * (0.4 + 0.5 * Math.sin(S.t * 2 + s.x)); ctx.fillRect(s.x, s.y, 1.8, 1.8); }
            ctx.globalAlpha = 1;
        }
        // matahari / bulan
        const sx = W * 0.82, sy = H * 0.18;
        if (night > 0.5) { mgCirc(ctx, sx, sy, 22 * u, '#e2e8f0'); mgCirc(ctx, sx + 9 * u, sy - 5 * u, 19 * u, top); }
        else {
            ctx.strokeStyle = 'rgba(253,224,71,.4)'; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.arc(sx, sy, 30 * u, 0, 6.283); ctx.stroke();
            mgCirc(ctx, sx, sy, 24 * u, '#fde047');
        }
        // awan
        ctx.globalAlpha = 0.9 - night * 0.55;
        for (let i = 0; i < 4; i++) {
            const span = W + 140, x = (((i * W / 3.2 - g.dist * 0.08) % span) + span) % span - 70, y = H * (0.12 + 0.07 * (i % 3)) + 20;
            mgCirc(ctx, x, y, 14 * u, '#fff'); mgCirc(ctx, x + 15 * u, y + 3 * u, 11 * u, '#fff'); mgCirc(ctx, x - 15 * u, y + 4 * u, 10 * u, '#fff');
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
        // bintang koin
        for (const c of g.coins) mgStar(ctx, c.x, gy - c.y + Math.sin(S.t * 6 + c.x * 0.05) * 3, 13 * u);
        // rintangan
        for (const o of g.obs) {
            const cx = o.x + o.w / 2, yb = o.y + o.h;
            if (o.t === 'cactus') this.cactus(ctx, cx, yb, o.w, o.h);
            else if (o.t === 'cactus2') { this.cactus(ctx, o.x + o.w * 0.27, yb, o.w * 0.5, o.h); this.cactus(ctx, o.x + o.w * 0.73, yb, o.w * 0.5, o.h * 0.9); }
            else if (o.t === 'rock') mgPoly(ctx, [[o.x, yb], [o.x + o.w * 0.1, yb - o.h * 0.6], [o.x + o.w * 0.4, yb - o.h], [o.x + o.w * 0.75, yb - o.h * 0.8], [o.x + o.w, yb]], '#78716c', '#292524');
            else this.bird(ctx, cx, o.y + o.h / 2, o.w, o.h, S.t);
        }
        // pemain (menghadap KANAN)
        const px = W * 0.18, pb = gy - g.y;
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.ellipse(px, gy + 3 * u, 20 * u * (1 - Math.min(0.6, g.y / (200 * u))), 4 * u, 0, 0, 6.283); ctx.fill();
        ctx.save(); ctx.translate(px, pb);
        if (g.y > 0) ctx.rotate(mgClamp(-g.vy * 0.0002, -0.2, 0.2));
        else ctx.translate(0, -Math.abs(Math.sin(S.t * 16)) * 2 * u);
        if (g.duck) ctx.scale(1.2, 0.58);
        this.kid(ctx, u, S.t, g.y > 0);
        ctx.restore();
        // HUD
        mgStar(ctx, 20, 21, 9); ctx.textAlign = 'left'; ctx.font = '800 14px system-ui'; ctx.fillStyle = night > 0.5 ? '#e2e8f0' : '#0f172a';
        ctx.fillText(String(g.stars), 34, 26);
    },
    kid(ctx, u, t, air) {
        const sw = air ? 0 : Math.sin(t * 16);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const leg = (dx, col) => {
            const fx = air ? (dx > 0 ? 9 : -6) * u : dx * sw * 11 * u;
            const fy = air ? -(dx > 0 ? 8 : 6) * u : -Math.max(0, dx * sw) * 7 * u;
            ctx.strokeStyle = col; ctx.lineWidth = 6 * u; ctx.beginPath(); ctx.moveTo(0, -17 * u); ctx.lineTo(fx, fy); ctx.stroke();
            ctx.strokeStyle = '#111827'; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 5 * u, fy); ctx.stroke();
        };
        const arm = (dx, col) => {
            const a = air ? dx * 1.1 : dx * sw * 0.9;
            ctx.strokeStyle = col; ctx.lineWidth = 5 * u; ctx.beginPath(); ctx.moveTo(0, -34 * u); ctx.lineTo(Math.sin(a) * 11 * u + 2 * u, -34 * u + Math.cos(a) * 11 * u); ctx.stroke();
        };
        arm(-1, '#d6a77a'); leg(-1, '#1e3a8a');
        mgRRs(ctx, -14 * u, -36 * u, 8 * u, 15 * u, 2 * u, '#f59e0b', '#78350f');
        mgRRs(ctx, -8 * u, -39 * u, 17 * u, 23 * u, 5 * u, '#ef4444', '#7f1d1d');
        ctx.fillStyle = '#fff'; ctx.fillRect(-8 * u, -29 * u, 17 * u, 4 * u);
        mgCirc(ctx, 1 * u, -47 * u, 9 * u, '#fcd5a5', '#92400e');
        ctx.beginPath(); ctx.arc(1 * u, -49 * u, 9.6 * u, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#2563eb'; ctx.fill(); ctx.strokeStyle = '#1e3a8a'; ctx.lineWidth = 1.5; ctx.stroke();
        mgRRs(ctx, 3 * u, -52 * u, 13 * u, 4 * u, 2 * u, '#1d4ed8', '#1e3a8a');
        mgCirc(ctx, 5 * u, -46 * u, 1.9 * u, '#111827');
        leg(1, '#2563eb'); arm(1, '#fcd5a5');
    },
    cactus(ctx, x, yb, w, h) {
        const f = '#22c55e', s = '#14532d';
        mgRRs(ctx, x - w * 0.2, yb - h, w * 0.4, h, w * 0.2, f, s);
        mgRRs(ctx, x - w * 0.5, yb - h * 0.55, w * 0.34, h * 0.12, w * 0.06, f, s);
        mgRRs(ctx, x - w * 0.5, yb - h * 0.75, w * 0.14, h * 0.32, w * 0.07, f, s);
        mgRRs(ctx, x + w * 0.16, yb - h * 0.42, w * 0.34, h * 0.12, w * 0.06, f, s);
        mgRRs(ctx, x + w * 0.36, yb - h * 0.62, w * 0.14, h * 0.32, w * 0.07, f, s);
        ctx.fillStyle = '#bbf7d0';
        for (let i = 0; i < 4; i++) ctx.fillRect(x - 1, yb - h * (0.2 + i * 0.2), 2, 3);
    },
    bird(ctx, x, y, w, h, t) {
        const f = Math.sin(t * 14);
        ctx.save(); ctx.translate(x, y);
        mgPoly(ctx, [[w * 0.05, -h * 0.1], [w * 0.28, -h * (0.9 + f * 0.5)], [w * 0.4, -h * 0.05]], '#7c2d12', '#431407');
        ctx.beginPath(); ctx.ellipse(0, 0, w * 0.34, h * 0.32, 0, 0, 6.283); ctx.fillStyle = '#9a3412'; ctx.fill(); ctx.strokeStyle = '#431407'; ctx.lineWidth = 2; ctx.stroke();
        mgPoly(ctx, [[w * 0.3, 0], [w * 0.5, h * 0.15 + f * 3], [w * 0.28, h * 0.1]], '#9a3412', '#431407');
        mgCirc(ctx, -w * 0.3, -h * 0.12, h * 0.26, '#fef3c7', '#431407');
        mgPoly(ctx, [[-w * 0.42, -h * 0.14], [-w * 0.58, -h * 0.04], [-w * 0.42, h * 0.02]], '#facc15', '#a16207');
        mgCirc(ctx, -w * 0.33, -h * 0.17, h * 0.07, '#111827');
        mgPoly(ctx, [[-w * 0.05, 0], [w * 0.22, h * (0.8 - f * 0.3)], [w * 0.36, h * 0.05]], '#7c2d12', '#431407');
        ctx.restore();
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
        this.s = { y: S.H / 2, vy: 0, pipes: [], st: [], spawn: 1.0, n: 0, trail: 0 };
    },
    resize(S, ow, oh) {
        const g = this.s; if (!g || !ow) return;
        g.y *= S.H / oh;
        g.pipes.forEach(p => { p.x *= S.W / ow; p.gy *= S.H / oh; p.gh *= S.H / oh; p.amp *= S.H / oh; });
        g.st.forEach(s => { s.x *= S.W / ow; s.y *= S.H / oh; });
    },
    press(S) { this.s.vy = -0.62 * S.H; S.ring(S.W * 0.22, this.s.y, 'rgba(255,255,255,.6)'); },
    gapY(p, S) { return mgClamp(p.gy + Math.sin(S.t * 1.5 + p.ph) * p.amp, 24, S.H - 24 - p.gh); },
    update(S, dt) {
        const g = this.s, W = S.W, H = S.H, rx = W * 0.22, r = Math.max(9, H * 0.03);
        g.vy = Math.min(g.vy + 1.5 * H * dt, 0.8 * H); g.y += g.vy * dt;
        const speed = H * 0.38 + Math.min(H * 0.22, g.n * H * 0.007);
        g.spawn -= dt;
        if (g.spawn <= 0) {
            g.spawn = Math.max(1.4, 2.0 - g.n * 0.02);
            const gh = Math.max(H * 0.36 - g.n * H * 0.002, H * 0.28);
            g.pipes.push({ x: W + 40, w: Math.max(46, H * 0.14), gy: mgRnd(H * 0.2, H * 0.8 - gh), gh, ph: mgRnd(0, 6), amp: g.n > 8 ? H * 0.07 : 0, passed: false });
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

        for (const s of g.st) mgStar(ctx, s.x, s.y + Math.sin(S.t * 5 + s.x) * 3, 14);
        if (S.state !== 'over') {
            ctx.save(); ctx.translate(rx, g.y); ctx.rotate(mgClamp(g.vy / (H * 0.8), -0.5, 0.9));
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
        ctx.fillText(`Lantai ${n - 1}`, 12, 26);
        if (g.combo > 1) { ctx.textAlign = 'right'; ctx.fillStyle = '#fde047'; ctx.fillText(`Combo x${g.combo}`, W - 12, 26); }
    }
};

// ==========================================
// GAME 5: PERTAHANAN BENTENG (v2: sprite vektor, power-up, musuh terbang)
// ==========================================
GAMES.castle = {
    title: 'Pertahanan Benteng', icon: '🏰', color: '#10b981',
    desc: 'Panah musuh darat & udara, ambil power-up', hint: 'Ketuk / tahan layar untuk memanah • ketuk bola power-up untuk mengambilnya',
    init(S) {
        this.s = { hp: 10, wave: 1, left: 7, sp: 1, en: [], ar: [], fb: [], it: [], cd: 0, bossP: false, wait: 0, multi: 0, rapid: 0, freeze: 0, shield: 0, aim: 0 };
    },
    resize(S, ow) {
        const g = this.s; if (!g || !ow) return; const k = S.W / ow;
        g.en.forEach(e => e.x *= k); g.fb.forEach(f => f.x *= k); g.it.forEach(i => i.x *= k);
    },
    geo(S) {
        const u = mgClamp(S.H / 360, 0.7, 1.8), gy = S.H * 0.82;
        return { u, gy, cx: Math.max(46 * u, S.W * 0.09), oy: gy - 92 * u };
    },
    shoot(S, tx, ty) {
        const g = this.s, o = this.geo(S);
        if (g.cd > 0) return;
        g.cd = g.rapid > 0 ? 0.11 : 0.26;
        const ox = o.cx + 14 * o.u, oy = o.oy;
        tx = Math.max(tx, ox + 40);
        const a = Math.atan2(ty - oy, tx - ox);
        g.aim = a;
        const n = g.multi > 0 ? 3 + 2 * Math.min(2, Math.floor(g.wave / 5)) : 1, d = 1 + Math.floor(g.wave / 8);
        for (let i = 0; i < n; i++) {
            const aa = a + (i - (n - 1) / 2) * 0.13;
            g.ar.push({ x: ox, y: oy, vx: Math.cos(aa) * 1000, vy: Math.sin(aa) * 1000, a: aa, d });
        }
        S.burst(ox, oy, '#fde68a', 3, 90);
    },
    press(S, x, y, key) {
        const g = this.s, o = this.geo(S);
        if (key || x === null) {
            let best = null;
            for (const e of g.en) if (!best || e.x < best.x) best = e;
            if (best) this.shoot(S, best.x, best.cy);
            else this.shoot(S, S.W * 0.7, o.gy - 20 * o.u);
            return;
        }
        for (let i = g.it.length - 1; i >= 0; i--) {
            const it = g.it[i];
            if (Math.hypot(x - it.x, y - it.y) < 40 * o.u) { this.collect(S, it); g.it.splice(i, 1); return; }
        }
        this.shoot(S, x, y);
    },
    collect(S, it) {
        const g = this.s, w = g.wave;
        let msg = '';
        if (it.t === 'multi') { g.multi = 8 + Math.min(6, Math.floor(w / 3)); msg = 'Panah Ganda!'; }
        else if (it.t === 'rapid') { g.rapid = 8; msg = 'Panah Cepat!'; }
        else if (it.t === 'freeze') { g.freeze = 4 + Math.min(3, Math.floor(w / 4)); msg = 'Musuh Membeku!'; }
        else if (it.t === 'heal') { g.hp = Math.min(10, g.hp + 2 + (w >= 10 ? 1 : 0)); msg = '+Nyawa'; }
        else if (it.t === 'shield') { g.shield += 3 + Math.floor(w / 5); msg = 'Perisai Benteng!'; }
        else {
            const d = 2 + Math.floor(w / 3);
            for (const e of g.en) { e.hp -= d; e.hit = 0.2; S.burst(e.x, e.cy || 0, '#fb923c', 10, 240); }
            g.fb.forEach(f => f.hp = 0);
            S.shake = 14; S.ring(it.x, it.y, '#fff'); msg = 'BOM!';
        }
        S.ring(it.x, it.y, MG_PW[it.t]); S.burst(it.x, it.y, MG_PW[it.t], 12, 200);
        S.float(it.x, it.y - 26, msg, MG_PW[it.t], 18);
    },
    drop(S, e) {
        const g = this.s, w = g.wave, o = this.geo(S);
        const n = e.boss ? 2 : 1;
        if (!e.boss && Math.random() > Math.min(0.35, 0.12 + w * 0.015)) return;
        const pool = ['heal', 'multi'];
        if (w >= 2) pool.push('rapid');
        if (w >= 3) pool.push('freeze');
        if (w >= 4) pool.push('bomb');
        if (w >= 5) pool.push('shield');
        for (let i = 0; i < n; i++) {
            let t = pool[Math.floor(Math.random() * pool.length)];
            if (e.boss && i === 1) t = 'heal';
            if (g.hp <= 4 && Math.random() < 0.4) t = 'heal';
            g.it.push({ t, x: mgClamp(e.x + i * 40 * o.u, o.cx + 60 * o.u, S.W - 20), y: e.cy, gy: o.gy - 24 * o.u, life: 9 });
        }
    },
    spawn(S) {
        const g = this.s, o = this.geo(S), u = o.u, w = g.wave, r = Math.random();
        let e;
        if (g.bossP) {
            g.bossP = false;
            e = { k: 'dragon', hp: 22 + w * 3, sp: 26, r: 46 * u, off: 70 * u, fly: true, pts: 200, dmg: 3, boss: true, fire: 2 };
            S.float(S.W / 2, S.H * 0.3, 'NAGA MUNCUL!', '#fca5a5', 26); S.shake = 8;
        }
        else if (w >= 2 && r < 0.22) e = { k: 'bat', hp: 1, sp: 130 + w * 5, r: 16 * u, off: mgRnd(70, 170) * u, fly: true, pts: 15, dmg: 1 };
        else if (w >= 4 && r < 0.36) e = { k: 'fire', hp: 2 + Math.floor(w / 6), sp: 80 + w * 3, r: 20 * u, off: mgRnd(100, 190) * u, fly: true, pts: 25, dmg: 1 };
        else if (w >= 6 && r < 0.5) e = { k: 'knight', hp: 5 + Math.floor(w / 4), sp: 34 + w * 1.5, r: 26 * u, off: 0, pts: 40, dmg: 1 };
        else if (w >= 3 && r < 0.7) e = { k: 'orc', hp: 3 + Math.floor(w / 5), sp: 38 + w * 2, r: 24 * u, off: 0, pts: 20, dmg: 1 };
        else e = { k: 'gob', hp: 1 + Math.floor(w / 7), sp: Math.min(130, 60 + w * 3), r: 18 * u, off: 0, pts: 10, dmg: 1 };
        e.max = e.hp; e.x = S.W + 50; e.hit = 0; e.ph = mgRnd(0, 6); e.cy = o.gy - e.off - e.r;
        g.en.push(e);
    },
    hurt(S, d) {
        const g = this.s, o = this.geo(S);
        if (g.shield > 0) { g.shield--; S.ring(o.cx, o.gy - 50 * o.u, '#22d3ee'); S.float(o.cx + 50 * o.u, o.gy - 100 * o.u, 'Perisai!', '#67e8f9', 16); S.shake = 4; return; }
        g.hp -= d; S.shake = 10; S.flash = 0.8;
        S.burst(o.cx + 20 * o.u, o.gy - 60 * o.u, '#f87171', 14, 220);
        if (g.hp <= 0) { S.burst(o.cx, o.gy - 60 * o.u, '#fde047', 40, 360); S.ring(o.cx, o.gy - 60 * o.u, '#fff'); S.end(); }
    },
    update(S, dt) {
        const g = this.s, o = this.geo(S), W = S.W, u = o.u, cx = o.cx;
        g.cd -= dt; g.multi -= dt; g.rapid -= dt; g.freeze -= dt;
        if (S.ptr.down) this.shoot(S, S.ptr.x, S.ptr.y);
        const f = g.freeze > 0 ? 0.3 : 1;

        // gelombang
        if (g.wait > 0) {
            g.wait -= dt;
            if (g.wait <= 0) {
                g.wave++; g.left = 5 + g.wave * 2; g.bossP = g.wave % 5 === 0;
                S.float(W / 2, S.H * 0.3, `Gelombang ${g.wave}`, '#a7f3d0', 24);
                if (g.bossP) S.float(W / 2, S.H * 0.38, 'Boss mendekat!', '#fca5a5', 16);
            }
        } else {
            g.sp -= dt;
            if (g.sp <= 0 && (g.left > 0 || g.bossP)) {
                g.sp = Math.max(0.45, 1.4 - g.wave * 0.06);
                const batch = Math.min(3, 1 + Math.floor(g.wave / 4));
                for (let b = 0; b < batch && (g.left > 0 || g.bossP); b++) { if (!g.bossP) g.left--; this.spawn(S); }
            }
            if (g.left <= 0 && !g.bossP && g.en.length === 0 && g.fb.length === 0) {
                g.wait = 2.2; S.add(25 + g.wave * 5);
                S.float(W / 2, S.H * 0.4, `Gelombang ${g.wave} selesai!`, '#fde047', 20);
            }
        }
        // panah (juga mengambil power-up)
        for (const a of g.ar) {
            a.x += a.vx * dt; a.y += a.vy * dt;
            for (let i = g.it.length - 1; i >= 0; i--) {
                const it = g.it[i];
                if (Math.hypot(a.x - it.x, a.y - it.y) < 18 * u) { this.collect(S, it); g.it.splice(i, 1); }
            }
        }
        g.ar = g.ar.filter(a => a.x < W + 30 && a.y > -30 && a.y < S.H + 30);
        // item
        for (let i = g.it.length - 1; i >= 0; i--) {
            const it = g.it[i]; it.life -= dt;
            if (it.y < it.gy) it.y = Math.min(it.gy, it.y + 140 * dt);
            if (it.life <= 0) g.it.splice(i, 1);
        }
        // bola api naga
        for (let i = g.fb.length - 1; i >= 0; i--) {
            const b = g.fb[i]; b.x += b.vx * f * dt; b.y += b.vy * f * dt;
            if (Math.random() < 0.6) S.parts.push({ x: b.x, y: b.y, vx: 60, vy: mgRnd(-20, 20), g: 0, life: 0.25, max: 0.25, c: '#fdba74', s: 3 });
            for (let j = g.ar.length - 1; j >= 0; j--) {
                const a = g.ar[j];
                if (Math.hypot(a.x - b.x, a.y - b.y) < b.r + 6) { g.ar.splice(j, 1); b.hp--; }
            }
            if (b.hp <= 0) { S.burst(b.x, b.y, '#fb923c', 10, 200); S.add(5); g.fb.splice(i, 1); continue; }
            if (b.x < cx + 24 * u) {
                g.fb.splice(i, 1); S.burst(b.x, b.y, '#fb923c', 14, 240);
                this.hurt(S, 1); if (S.state !== 'play') return;
            }
        }
        // musuh
        for (let i = g.en.length - 1; i >= 0; i--) {
            const e = g.en[i];
            e.x -= e.sp * f * dt; e.hit -= dt;
            e.cy = o.gy - e.off - e.r - (e.fly ? Math.sin(S.t * 4 + e.ph) * 10 * u : 0);
            if (e.boss) {
                e.fire -= dt * f;
                if (e.fire <= 0) {
                    e.fire = Math.max(1.3, 2.4 - g.wave * 0.04);
                    const tx = cx + 10 * u, ty = o.oy, a = Math.atan2(ty - e.cy, tx - e.x), sp = 220 + g.wave * 5;
                    g.fb.push({ x: e.x - 40 * u, y: e.cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 12 * u, hp: 1 });
                }
            }
            for (let j = g.ar.length - 1; j >= 0; j--) {
                const a = g.ar[j];
                if (Math.hypot(a.x - e.x, a.y - e.cy) < e.r + 6) { g.ar.splice(j, 1); e.hp -= a.d; e.hit = 0.1; S.burst(a.x, a.y, '#fde047', 4, 140); }
            }
            if (e.hp <= 0) {
                S.add(e.pts); S.burst(e.x, e.cy, e.boss ? '#fb923c' : '#a7f3d0', e.boss ? 36 : 14, e.boss ? 340 : 220); S.ring(e.x, e.cy, '#fff');
                S.float(e.x, e.cy - e.r, '+' + e.pts, '#fde047', e.boss ? 22 : 15); if (e.boss) S.shake = 16;
                this.drop(S, e); g.en.splice(i, 1); continue;
            }
            if (e.x < cx + 26 * u) {
                g.en.splice(i, 1); S.burst(e.x, e.cy, '#f87171', 10, 200);
                this.hurt(S, e.dmg); if (S.state !== 'play') return;
            }
        }
    },
    draw(S, ctx) {
        const g = this.s, W = S.W, H = S.H, o = this.geo(S), u = o.u, gy = o.gy, cx = o.cx;
        const sky = ctx.createLinearGradient(0, 0, 0, gy);
        sky.addColorStop(0, '#312e81'); sky.addColorStop(1, '#fda4af');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fff';
        for (const s of S.stars) { if (s.y > gy * 0.6) continue; ctx.globalAlpha = 0.3 + 0.5 * Math.sin(S.t * 2 + s.x); ctx.fillRect(s.x, s.y, 1.8, 1.8); }
        ctx.globalAlpha = 1;
        mgCirc(ctx, W * 0.8, H * 0.16, 20 * u, '#fef3c7');
        ctx.fillStyle = '#4c1d95'; ctx.beginPath(); ctx.moveTo(0, gy);
        for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, gy - 50 * u - Math.sin(x / (90 * u)) * 26 * u);
        ctx.lineTo(W, gy); ctx.fill();
        ctx.fillStyle = '#14532d'; ctx.fillRect(0, gy, W, H - gy);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(0, gy, W, 6 * u);

        // benteng
        const tw = 52 * u, th = 84 * u;
        mgRRs(ctx, cx - tw / 2, gy - th, tw, th, 2, '#94a3b8', '#334155');
        ctx.strokeStyle = 'rgba(51,65,85,.55)'; ctx.lineWidth = 1;
        for (let r = 1; r < 6; r++) {
            const y = gy - th + r * th / 6;
            ctx.beginPath(); ctx.moveTo(cx - tw / 2, y); ctx.lineTo(cx + tw / 2, y); ctx.stroke();
            for (let x = cx - tw / 2 + (r % 2) * tw / 6 + tw / 3; x < cx + tw / 2; x += tw / 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + th / 6); ctx.stroke(); }
        }
        for (let i = 0; i < 4; i++) mgRRs(ctx, cx - tw / 2 + i * (tw / 4) + 2 * u, gy - th - 12 * u, tw / 4 - 4 * u, 12 * u, 1, '#94a3b8', '#334155');
        ctx.beginPath(); ctx.moveTo(cx - 9 * u, gy); ctx.lineTo(cx - 9 * u, gy - 20 * u); ctx.arc(cx, gy - 20 * u, 9 * u, Math.PI, 0); ctx.lineTo(cx + 9 * u, gy); ctx.closePath();
        ctx.fillStyle = '#78350f'; ctx.fill(); ctx.strokeStyle = '#451a03'; ctx.lineWidth = 2; ctx.stroke();
        const ft = gy - th - 12 * u;
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - tw / 2 + 6 * u, ft); ctx.lineTo(cx - tw / 2 + 6 * u, ft - 28 * u); ctx.stroke();
        mgPoly(ctx, [[cx - tw / 2 + 6 * u, ft - 28 * u], [cx - tw / 2 + 26 * u, ft - 24 * u + Math.sin(S.t * 6) * 3 * u], [cx - tw / 2 + 6 * u, ft - 16 * u]], '#ef4444', '#7f1d1d');
        // pemanah
        const ax = cx + 2 * u, top = gy - th;
        mgRRs(ctx, ax - 6 * u, top - 22 * u, 12 * u, 20 * u, 3 * u, '#2563eb', '#1e3a8a');
        mgCirc(ctx, ax, top - 28 * u, 6.5 * u, '#fcd5a5', '#92400e');
        ctx.beginPath(); ctx.arc(ax, top - 29 * u, 7 * u, Math.PI, 0); ctx.closePath(); ctx.fillStyle = '#1e3a8a'; ctx.fill();
        ctx.save(); ctx.translate(ax + 4 * u, o.oy); ctx.rotate(g.aim);
        ctx.strokeStyle = '#92400e'; ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(0, 0, 13 * u, -1.15, 1.15); ctx.stroke();
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.cos(-1.15) * 13 * u, Math.sin(-1.15) * 13 * u); ctx.lineTo(g.cd <= 0 ? -5 * u : 0, 0); ctx.lineTo(Math.cos(1.15) * 13 * u, Math.sin(1.15) * 13 * u); ctx.stroke();
        if (g.cd <= 0) { ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5 * u, 0); ctx.lineTo(14 * u, 0); ctx.stroke(); }
        ctx.restore();
        if (g.shield > 0) {
            ctx.strokeStyle = `rgba(34,211,238,${0.5 + 0.3 * Math.sin(S.t * 6)})`; ctx.lineWidth = 4 * u;
            ctx.beginPath(); ctx.arc(cx, gy - 55 * u, 78 * u, -1.15, 1.15); ctx.stroke();
        }

        // item power-up
        for (const it of g.it) {
            if (it.life < 2 && Math.floor(S.t * 8) % 2) continue;
            mgPower(ctx, it.t, it.x, it.y + Math.sin(S.t * 5 + it.x) * 3, 15 * u);
        }
        // panah
        for (const a of g.ar) {
            ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.x - Math.cos(a.a) * 20, a.y - Math.sin(a.a) * 20); ctx.stroke();
            mgCirc(ctx, a.x, a.y, 3, '#e5e7eb');
        }
        // bola api
        for (const b of g.fb) {
            mgCirc(ctx, b.x, b.y, b.r, '#f97316'); mgCirc(ctx, b.x, b.y, b.r * 0.55, '#fde047');
        }
        // musuh (semua sprite menghadap kiri)
        for (const e of g.en) {
            const t = S.t + e.ph;
            ctx.save(); ctx.translate(e.x, e.cy);
            if (e.k === 'gob') mgSpriteGob(ctx, e.r, t, { skin: '#4ade80', cloth: '#92400e', leg: '#14532d' });
            else if (e.k === 'orc') mgSpriteGob(ctx, e.r, t, { skin: '#a3e635', cloth: '#7f1d1d', leg: '#365314', tusk: true, club: true });
            else if (e.k === 'knight') mgSpriteGob(ctx, e.r, t, { skin: '#fcd5a5', cloth: '#475569', leg: '#334155', helm: true, armor: true, shield: true, noEars: true });
            else if (e.k === 'bat') mgSpriteBat(ctx, e.r, t);
            else if (e.k === 'fire') mgSpriteFire(ctx, e.r, t);
            else mgSpriteDragon(ctx, e.r, t);
            if (e.hit > 0) mgCirc(ctx, 0, 0, e.r, 'rgba(255,255,255,.45)');
            if (g.freeze > 0) { mgCirc(ctx, 0, 0, e.r * 1.05, 'rgba(125,211,252,.35)', '#7dd3fc'); }
            ctx.restore();
            if (e.hp < e.max) {
                ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - e.r, e.cy - e.r - 12, e.r * 2, 5);
                ctx.fillStyle = '#f43f5e'; ctx.fillRect(e.x - e.r, e.cy - e.r - 12, e.r * 2 * Math.max(0, e.hp / e.max), 5);
            }
        }
        // HUD
        for (let i = 0; i < g.hp; i++) mgHeart(ctx, 18 + i * 17, 22, 7);
        let ix = 18;
        for (const [k, v] of [['multi', g.multi], ['rapid', g.rapid], ['freeze', g.freeze], ['shield', g.shield]]) {
            if (v <= 0) continue;
            mgPower(ctx, k, ix, 52, 10);
            ctx.textAlign = 'left'; ctx.font = '800 12px system-ui'; ctx.fillStyle = '#fff';
            ctx.fillText(k === 'shield' ? 'x' + v : Math.ceil(v) + 's', ix + 14, 56);
            ix += 52;
        }
        ctx.textAlign = 'right'; ctx.font = '800 14px system-ui'; ctx.fillStyle = '#fff';
        ctx.fillText(`Gelombang ${g.wave}`, W - 12, 26);
        ctx.font = '600 11px system-ui'; ctx.fillStyle = '#e2e8f0';
        ctx.fillText(`Musuh tersisa: ${g.left + g.en.length}`, W - 12, 44);
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
                g.trees.push({ x: side ? mgRnd(10, o.left - 12) : mgRnd(o.left + o.rw + 12, W - 10), y: -40, e: Math.floor(Math.random() * 3) });
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
                else { g.nitro = 3.5; S.float(cx, p.y - 20, 'NITRO!', '#fb923c', 22); S.ring(px, py, '#fb923c'); S.shake = 5; }
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
        for (const tr of g.trees) {
            const sz = lw * 0.5;
            if (tr.e === 0) { ctx.fillStyle = '#78350f'; ctx.fillRect(tr.x - 3, tr.y + sz * 0.5, 6, sz * 0.4); mgPoly(ctx, [[tr.x, tr.y - sz], [tr.x + sz * 0.6, tr.y + sz * 0.1], [tr.x - sz * 0.6, tr.y + sz * 0.1]], '#15803d', '#052e16'); mgPoly(ctx, [[tr.x, tr.y - sz * 0.5], [tr.x + sz * 0.75, tr.y + sz * 0.6], [tr.x - sz * 0.75, tr.y + sz * 0.6]], '#16a34a', '#052e16'); }
            else if (tr.e === 1) { ctx.fillStyle = '#78350f'; ctx.fillRect(tr.x - 3, tr.y, 6, sz * 0.7); mgCirc(ctx, tr.x, tr.y - sz * 0.2, sz * 0.6, '#22c55e', '#14532d'); }
            else mgPoly(ctx, [[tr.x - sz * 0.5, tr.y + sz * 0.3], [tr.x - sz * 0.3, tr.y - sz * 0.2], [tr.x + sz * 0.2, tr.y - sz * 0.3], [tr.x + sz * 0.5, tr.y + sz * 0.3]], '#78716c', '#292524');
        }

        // item
        for (const p of g.pk) {
            const cx = this.laneX(S, p.lane);
            if (p.t === 'star') mgStar(ctx, cx, p.y + Math.sin(S.t * 6 + p.y * 0.05) * 3, lw * 0.24);
            else {
                ctx.fillStyle = `rgba(251,146,60,${0.25 + 0.15 * Math.sin(S.t * 8)})`; ctx.beginPath(); ctx.arc(cx, p.y, lw * 0.36, 0, 6.283); ctx.fill();
                mgBolt(ctx, cx, p.y, lw * 0.26, '#fde047');
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
        ctx.strokeText(String(g.stars), W - 34, 26); ctx.fillText(String(g.stars), W - 34, 26); mgStar(ctx, W - 20, 21, 9);
        if (g.nitro > 0) {
            const bw = Math.min(W * 0.4, 160);
            ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(W / 2 - bw / 2, 14, bw, 8);
            ctx.fillStyle = '#fb923c'; ctx.fillRect(W / 2 - bw / 2, 14, bw * Math.min(1, g.nitro / 3.5), 8);
        }
    }
};
