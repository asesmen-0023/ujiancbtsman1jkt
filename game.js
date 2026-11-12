// ==========================================
// HUB 5 MINI-GAME STANDBY UJIAN (TANPA UBAH HTML)
// 1. 2048 | 2. Tembak Meteor | 3. Susun Menara
// 4. Pasangan Memori | 5. Roket Terbang
// ==========================================

let activeMiniGame = null;
let gameLoopId = null;
let keydownHandler = null;

function stopActiveLoop() {
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
        gameLoopId = null;
    }
    if (keydownHandler) {
        document.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
}

// Dipanggil otomatis oleh app.js saat ujian selesai
function resetGame() {
    stopActiveLoop();
    activeMiniGame = null;
    mountGameHub();
}

// Menemukan dan mengganti wadah Tic-Tac-Toe lama di index.html tanpa merusak tombol Tutup/Logout
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

        // Sembunyikan tombol reset bawaan Tic-Tac-Toe jika berada tepat di bawah grid
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

function mountGameHub() {
    stopActiveLoop();
    const hub = getOrCreateHubContainer();
    if (!hub) return;

    const games = [
        { id: '2048', title: '2048', desc: 'Gabungkan angka hingga 2048', icon: '🔢', color: '#f59e0b' },
        { id: 'meteor', title: 'Tembak Meteor', desc: 'Hancurkan meteor sebelum jatuh', icon: '☄️', color: '#ef4444' },
        { id: 'tower', title: 'Susun Menara', desc: 'Tumpuk balok setinggi mungkin', icon: '🏗️', color: '#3b82f6' },
        { id: 'memory', title: 'Pasangan Memori', desc: 'Cocokkan kartu simbol yang sama', icon: '🃏', color: '#10b981' },
        { id: 'rocket', title: 'Roket Terbang', desc: 'Terbangkan roket melewati celah', icon: '🚀', color: '#8b5cf6' }
    ];

    hub.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:14px;">
            <div style="text-align:center;margin-bottom:10px;">
                <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Pilih Mini-Game Standby</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:8px;">
                ${games.map(g => `
                    <button type="button" onclick="launchMiniGame('${g.id}')"
                        style="display:flex;align-items:center;gap:12px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;cursor:pointer;text-align:left;box-shadow:0 1px 2px rgba(0,0,0,0.04);transition:transform 0.1s;">
                        <div style="width:36px;height:36px;border-radius:10px;background:${g.color}18;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">
                            ${g.icon}
                        </div>
                        <div style="flex:1;min-width:0;">
                            <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.2;">${g.title}</div>
                            <div style="font-size:11px;color:#64748b;margin-top:2px;">${g.desc}</div>
                        </div>
                        <span style="font-size:12px;font-weight:700;color:${g.color};">Main &rarr;</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

function launchMiniGame(gameId) {
    stopActiveLoop();
    activeMiniGame = gameId;
    const hub = getOrCreateHubContainer();
    if (!hub) return;

    if (gameId === '2048') renderGame2048(hub);
    else if (gameId === 'meteor') renderGameMeteor(hub);
    else if (gameId === 'tower') renderGameTower(hub);
    else if (gameId === 'memory') renderGameMemory(hub);
    else if (gameId === 'rocket') renderGameRocket(hub);
}

function buildHeaderBar(title, scoreId = 'mgScore') {
    return `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <button type="button" onclick="mountGameHub()"
                style="background:#e2e8f0;color:#1e293b;border:none;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:700;cursor:pointer;">
                &larr; Menu
            </button>
            <span style="font-size:13px;font-weight:800;color:#0f172a;">${title}</span>
            <span id="${scoreId}" style="background:#0f172a;color:#fff;border-radius:8px;padding:4px 9px;font-size:11px;font-weight:700;">Skor: 0</span>
        </div>
    `;
}

// ==========================================
// GAME 1: 2048
// ==========================================
function renderGame2048(container) {
    let board = Array.from({ length: 4 }, () => Array(4).fill(0));
    let score = 0;

    const tileColors = {
        0: '#cbd5e1', 2: '#f1f5f9', 4: '#fef3c7', 8: '#fed7aa',
        16: '#fdba74', 32: '#fb923c', 64: '#f97316', 128: '#fde047',
        256: '#facc15', 512: '#eab308', 1024: '#38bdf8', 2048: '#22c55e'
    };

    function addTile() {
        const empty = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                if (board[r][c] === 0) empty.push([r, c]);
            }
        }
        if (empty.length > 0) {
            const [r, c] = empty[Math.floor(Math.random() * empty.length)];
            board[r][c] = Math.random() < 0.9 ? 2 : 4;
        }
    }

    function slideRow(row) {
        let arr = row.filter(v => v !== 0);
        for (let i = 0; i < arr.length - 1; i++) {
            if (arr[i] === arr[i + 1]) {
                arr[i] *= 2;
                score += arr[i];
                arr[i + 1] = 0;
            }
        }
        arr = arr.filter(v => v !== 0);
        while (arr.length < 4) arr.push(0);
        return arr;
    }

    function move(dir) {
        const old = JSON.stringify(board);
        if (dir === 'left') {
            for (let r = 0; r < 4; r++) board[r] = slideRow(board[r]);
        } else if (dir === 'right') {
            for (let r = 0; r < 4; r++) board[r] = slideRow([...board[r]].reverse()).reverse();
        } else if (dir === 'up') {
            for (let c = 0; c < 4; c++) {
                const col = slideRow([board[0][c], board[1][c], board[2][c], board[3][c]]);
                for (let r = 0; r < 4; r++) board[r][c] = col[r];
            }
        } else if (dir === 'down') {
            for (let c = 0; c < 4; c++) {
                const col = slideRow([board[3][c], board[2][c], board[1][c], board[0][c]]).reverse();
                for (let r = 0; r < 4; r++) board[r][c] = col[r];
            }
        }
        if (JSON.stringify(board) !== old) {
            addTile();
            draw();
        }
    }

    function draw() {
        const scoreEl = document.getElementById('mgScore');
        if (scoreEl) scoreEl.innerText = `Skor: ${score}`;
        const gridEl = document.getElementById('grid2048');
        if (!gridEl) return;

        gridEl.innerHTML = board.flat().map(val => {
            const bg = tileColors[val] || '#0f172a';
            const fg = val <= 4 ? '#1e293b' : (val >= 2048 ? '#ffffff' : '#0f172a');
            return `<div style="height:56px;border-radius:8px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${val >= 1000 ? '15px' : '18px'};">
                ${val || ''}
            </div>`;
        }).join('');
    }

    container.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;">
            ${buildHeaderBar('2048')}
            <div id="grid2048" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;background:#94a3b8;padding:6px;border-radius:12px;touch-action:none;"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <span style="font-size:10px;color:#64748b;">Geser layar atau gunakan panah</span>
                <button type="button" id="reset2048Btn" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Ulang</button>
            </div>
        </div>
    `;

    const gridEl = document.getElementById('grid2048');
    let sx = 0, sy = 0;
    gridEl.addEventListener('touchstart', e => {
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
    }, { passive: true });
    gridEl.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
        else move(dy > 0 ? 'down' : 'up');
    }, { passive: true });

    keydownHandler = e => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            e.preventDefault();
            move(e.key.replace('Arrow', '').toLowerCase());
        }
    };
    document.addEventListener('keydown', keydownHandler);

    document.getElementById('reset2048Btn').onclick = () => renderGame2048(container);

    addTile();
    addTile();
    draw();
}

// ==========================================
// GAME 2: TEMBAK METEOR
// ==========================================
function renderGameMeteor(container) {
    container.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;">
            ${buildHeaderBar('Tembak Meteor')}
            <canvas id="meteorCanvas" width="300" height="270" style="width:100%;background:#0f172a;border-radius:12px;display:block;touch-action:none;"></canvas>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <span style="font-size:10px;color:#64748b;">Geser pesawat (tembak otomatis)</span>
                <button type="button" id="resetMeteorBtn" style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Ulang</button>
            </div>
        </div>
    `;

    const canvas = document.getElementById('meteorCanvas');
    const ctx = canvas.getContext('2d');
    let shipX = 150, score = 0, gameOver = false, frame = 0;
    let bullets = [], meteors = [];

    function moveShip(clientX) {
        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * canvas.width;
        shipX = Math.max(18, Math.min(canvas.width - 18, x));
    }

    canvas.addEventListener('touchmove', e => { e.preventDefault(); moveShip(e.touches[0].clientX); }, { passive: false });
    canvas.addEventListener('touchstart', e => { moveShip(e.touches[0].clientX); }, { passive: true });
    canvas.addEventListener('mousemove', e => { if (e.buttons === 1 || e.pointerType === 'mouse') moveShip(e.clientX); });

    keydownHandler = e => {
        if (e.key === 'ArrowLeft') shipX = Math.max(18, shipX - 18);
        if (e.key === 'ArrowRight') shipX = Math.min(canvas.width - 18, shipX + 18);
    };
    document.addEventListener('keydown', keydownHandler);
    document.getElementById('resetMeteorBtn').onclick = () => renderGameMeteor(container);

    function loop() {
        if (activeMiniGame !== 'meteor') return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!gameOver) {
            frame++;
            if (frame % 14 === 0) bullets.push({ x: shipX, y: 232 });
            if (frame % 42 === 0) {
                meteors.push({
                    x: 20 + Math.random() * 260,
                    y: -15,
                    r: 12 + Math.random() * 8,
                    spd: 1.6 + Math.min(2.5, score * 0.04)
                });
            }

            bullets.forEach(b => b.y -= 6);
            bullets = bullets.filter(b => b.y > -10);

            meteors.forEach(m => m.y += m.spd);

            // Deteksi tembakan kena meteor
            for (let i = meteors.length - 1; i >= 0; i--) {
                const m = meteors[i];
                for (let j = bullets.length - 1; j >= 0; j--) {
                    const b = bullets[j];
                    if (Math.hypot(m.x - b.x, m.y - b.y) < m.r + 4) {
                        meteors.splice(i, 1);
                        bullets.splice(j, 1);
                        score += 10;
                        const sEl = document.getElementById('mgScore');
                        if (sEl) sEl.innerText = `Skor: ${score}`;
                        break;
                    }
                }
                if (m && (m.y + m.r > 245 && Math.abs(m.x - shipX) < m.r + 12 || m.y > canvas.height + 10)) {
                    gameOver = true;
                }
            }
        }

        // Gambar pesawat
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(shipX, 232);
        ctx.lineTo(shipX - 14, 256);
        ctx.lineTo(shipX + 14, 256);
        ctx.closePath();
        ctx.fill();

        // Gambar peluru
        ctx.fillStyle = '#fde047';
        bullets.forEach(b => ctx.fillRect(b.x - 2, b.y, 4, 10));

        // Gambar meteor
        meteors.forEach(m => {
            ctx.fillStyle = '#f97316';
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
            ctx.fill();
        });

        if (gameOver) {
            ctx.fillStyle = 'rgba(15,23,42,0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Permainan Selesai!', 150, 125);
            ctx.font = '13px system-ui';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(`Skor Akhir: ${score}`, 150, 150);
            return;
        }

        gameLoopId = requestAnimationFrame(loop);
    }
    loop();
}

// ==========================================
// GAME 3: SUSUN MENARA (STACK TOWER)
// ==========================================
function renderGameTower(container) {
    container.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;">
            ${buildHeaderBar('Susun Menara')}
            <canvas id="towerCanvas" width="300" height="270" style="width:100%;background:#1e293b;border-radius:12px;display:block;cursor:pointer;touch-action:manipulation;"></canvas>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <span style="font-size:10px;color:#64748b;">Ketuk layar / Spasi untuk menjatuhkan balok</span>
                <button type="button" id="resetTowerBtn" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Ulang</button>
            </div>
        </div>
    `;

    const canvas = document.getElementById('towerCanvas');
    const ctx = canvas.getContext('2d');
    const colors = ['#38bdf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa'];
    let stack = [{ x: 90, w: 120, y: 245, color: colors[0] }];
    let current = { x: 0, w: 120, y: 223, dir: 2.5, color: colors[1] };
    let score = 0, gameOver = false;

    function dropBlock() {
        if (gameOver) return;
        const top = stack[stack.length - 1];
        const overlapStart = Math.max(top.x, current.x);
        const overlapEnd = Math.min(top.x + top.w, current.x + current.w);
        const overlapW = overlapEnd - overlapStart;

        if (overlapW <= 4) {
            gameOver = true;
            return;
        }

        score++;
        const sEl = document.getElementById('mgScore');
        if (sEl) sEl.innerText = `Skor: ${score}`;

        stack.push({ x: overlapStart, w: overlapW, y: current.y, color: current.color });
        if (stack.length > 9) {
            stack.shift();
            stack.forEach(b => b.y += 22);
        }

        const nextY = stack[stack.length - 1].y - 22;
        current = {
            x: 0,
            w: overlapW,
            y: nextY,
            dir: (2.5 + Math.min(3, score * 0.15)) * (score % 2 === 0 ? 1 : -1),
            color: colors[(score + 1) % colors.length]
        };
        if (current.dir < 0) current.x = canvas.width - current.w;
    }

    canvas.addEventListener('pointerdown', e => { e.preventDefault(); dropBlock(); });
    keydownHandler = e => { if (e.code === 'Space') { e.preventDefault(); dropBlock(); } };
    document.addEventListener('keydown', keydownHandler);
    document.getElementById('resetTowerBtn').onclick = () => renderGameTower(container);

    function loop() {
        if (activeMiniGame !== 'tower') return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        stack.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.fillRect(b.x, b.y, b.w, 20);
        });

        if (!gameOver) {
            current.x += current.dir;
            if (current.x <= 0 || current.x + current.w >= canvas.width) current.dir *= -1;
            ctx.fillStyle = current.color;
            ctx.fillRect(current.x, current.y, current.w, 20);
        } else {
            ctx.fillStyle = 'rgba(15,23,42,0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Menara Runtuh!', 150, 125);
            ctx.font = '13px system-ui';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(`Tinggi Menara: ${score} Lantai`, 150, 150);
            return;
        }

        gameLoopId = requestAnimationFrame(loop);
    }
    loop();
}

// ==========================================
// GAME 4: PASANGAN MEMORI
// ==========================================
function renderGameMemory(container) {
    const icons = ['📚', '🎓', '🔬', '🌍', '📐', '💡', '🏆', '🧭'];
    let deck = [...icons, ...icons].sort(() => Math.random() - 0.5);
    let flipped = [], matched = new Set(), moves = 0, lock = false;

    container.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;">
            ${buildHeaderBar('Pasangan Memori', 'mgMoves')}
            <div id="memoryGrid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <span style="font-size:10px;color:#64748b;">Cocokkan 8 pasang ikon</span>
                <button type="button" id="resetMemBtn" style="background:#10b981;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Ulang</button>
            </div>
        </div>
    `;

    const scoreEl = document.getElementById('mgMoves');
    if (scoreEl) scoreEl.innerText = 'Langkah: 0';

    function renderCards() {
        const grid = document.getElementById('memoryGrid');
        if (!grid) return;
        grid.innerHTML = deck.map((icon, idx) => {
            const isOpen = flipped.includes(idx) || matched.has(idx);
            const isDone = matched.has(idx);
            return `<button type="button" data-idx="${idx}"
                style="height:56px;border-radius:10px;border:1px solid ${isDone ? '#10b981' : '#cbd5e1'};background:${isOpen ? (isDone ? '#d1fae5' : '#ffffff') : '#1e293b'};font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                ${isOpen ? icon : '❓'}
            </button>`;
        }).join('');

        grid.querySelectorAll('button').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx, 10);
                if (lock || flipped.includes(idx) || matched.has(idx)) return;
                flipped.push(idx);
                renderCards();

                if (flipped.length === 2) {
                    moves++;
                    if (scoreEl) scoreEl.innerText = `Langkah: ${moves}`;
                    const [a, b] = flipped;
                    if (deck[a] === deck[b]) {
                        matched.add(a);
                        matched.add(b);
                        flipped = [];
                        renderCards();
                        if (matched.size === deck.length && scoreEl) {
                            scoreEl.innerText = `Selesai (${moves}) 🎉`;
                        }
                    } else {
                        lock = true;
                        setTimeout(() => {
                            flipped = [];
                            lock = false;
                            renderCards();
                        }, 600);
                    }
                }
            };
        });
    }

    document.getElementById('resetMemBtn').onclick = () => renderGameMemory(container);
    renderCards();
}

// ==========================================
// GAME 5: ROKET TERBANG (FLAPPY ROCKET)
// ==========================================
function renderGameRocket(container) {
    container.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:12px;">
            ${buildHeaderBar('Roket Terbang')}
            <canvas id="rocketCanvas" width="300" height="270" style="width:100%;background:#0f172a;border-radius:12px;display:block;cursor:pointer;touch-action:manipulation;"></canvas>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
                <span style="font-size:10px;color:#64748b;">Ketuk layar / Spasi agar roket naik</span>
                <button type="button" id="resetRocketBtn" style="background:#8b5cf6;color:#fff;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;">Ulang</button>
            </div>
        </div>
    `;

    const canvas = document.getElementById('rocketCanvas');
    const ctx = canvas.getContext('2d');
    let rocketY = 135, velY = 0, score = 0, frame = 0, gameOver = false;
    let pipes = [];

    function flap() {
        if (!gameOver) velY = -4.6;
    }

    canvas.addEventListener('pointerdown', e => { e.preventDefault(); flap(); });
    keydownHandler = e => { if (e.code === 'Space' || e.key === 'ArrowUp') { e.preventDefault(); flap(); } };
    document.addEventListener('keydown', keydownHandler);
    document.getElementById('resetRocketBtn').onclick = () => renderGameRocket(container);

    function loop() {
        if (activeMiniGame !== 'rocket') return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!gameOver) {
            frame++;
            velY += 0.24;
            rocketY += velY;

            if (frame % 95 === 0) {
                const gapY = 45 + Math.random() * 110;
                pipes.push({ x: 310, gapY, gapH: 78, passed: false });
            }

            pipes.forEach(p => {
                p.x -= 2.1;
                if (!p.passed && p.x + 28 < 60) {
                    p.passed = true;
                    score++;
                    const sEl = document.getElementById('mgScore');
                    if (sEl) sEl.innerText = `Skor: ${score}`;
                }
                if (60 + 10 > p.x && 60 - 10 < p.x + 28 && (rocketY - 9 < p.gapY || rocketY + 9 > p.gapY + p.gapH)) {
                    gameOver = true;
                }
            });
            pipes = pipes.filter(p => p.x > -40);

            if (rocketY < 8 || rocketY > canvas.height - 8) gameOver = true;
        }

        // Gambar rintangan
        ctx.fillStyle = '#10b981';
        pipes.forEach(p => {
            ctx.fillRect(p.x, 0, 28, p.gapY);
            ctx.fillRect(p.x, p.gapY + p.gapH, 28, canvas.height - (p.gapY + p.gapH));
        });

        // Gambar roket
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(60, rocketY, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.arc(64, rocketY, 3, 0, Math.PI * 2);
        ctx.fill();

        if (gameOver) {
            ctx.fillStyle = 'rgba(15,23,42,0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Roket Menabrak!', 150, 125);
            ctx.font = '13px system-ui';
            ctx.fillStyle = '#cbd5e1';
            ctx.fillText(`Skor Akhir: ${score}`, 150, 150);
            return;
        }

        gameLoopId = requestAnimationFrame(loop);
    }
    loop();
}
