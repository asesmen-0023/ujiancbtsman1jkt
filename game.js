let gameState = ["", "", "", "", "", "", "", "", ""];
let currentPlayer = "X";
let gameActive = true;

function toggleGameModal(show) {
    if (typeof playSound === 'function') playSound('click');
    const modal = document.getElementById('gameModal');
    if (show) modal?.classList.remove('hidden');
    else modal?.classList.add('hidden');
}

function makeMove(index) {
    if (gameState[index] !== "" || !gameActive) return;
    if (typeof playSound === 'function') playSound('click');

    gameState[index] = currentPlayer;
    const cells = document.querySelectorAll('.cell');
    if (cells[index]) cells[index].innerText = currentPlayer;

    if (checkWin()) {
        const statusElem = document.getElementById('gameStatus');
        if (statusElem) statusElem.innerText = `Pemain ${currentPlayer} Menang! 🎉`;
        gameActive = false;
        return;
    }

    if (!gameState.includes("")) {
        const statusElem = document.getElementById('gameStatus');
        if (statusElem) statusElem.innerText = `Hasil Seri! 🤝`;
        gameActive = false;
        return;
    }

    currentPlayer = currentPlayer === "X" ? "O" : "X";
    const statusElem = document.getElementById('gameStatus');
    if (statusElem) statusElem.innerText = `Giliran Pemain: ${currentPlayer}`;
}

function checkWin() {
    const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    return wins.some(w => w.every(i => gameState[i] === currentPlayer));
}

function resetGame() {
    if (typeof playSound === 'function') playSound('click');
    gameState = ["", "", "", "", "", "", "", "", ""];
    currentPlayer = "X";
    gameActive = true;
    document.querySelectorAll('.cell').forEach(c => c.innerText = "");
    const statusElem = document.getElementById('gameStatus');
    if (statusElem) statusElem.innerText = `Giliran Pemain: X`;
}
