// Sudoku game single-file implementation
// Board represented as array of 81 numbers (0 = empty)

const boardEl = document.getElementById('board');
const difficultyEl = document.getElementById('difficulty');
const newBtn = document.getElementById('newBtn');
const solveBtn = document.getElementById('solveBtn');
const checkBtn = document.getElementById('checkBtn');
const hintBtn = document.getElementById('hintBtn');
const undoBtn = document.getElementById('undoBtn');
const numpadEl = document.getElementById('numpad');
const timeEl = document.getElementById('time');
const mistakesEl = document.getElementById('mistakes');
const statusMsg = document.getElementById('statusMsg');

// The solved Sudoku (the "answer key")
let solution = new Array(81).fill(0);
// The current state of the board (what the player sees)
let state = new Array(81).fill(0);
// Marks which cells are given at the start
let prefilled = new Array(81).fill(false);
// Currently selected cell index
let selected = -1;
// Number of incorrect inputs
let mistakes = 0;
// Timer interval handle
let timer = null;
// When the game started
let startTime = null;
// For undo feature
let history = [];

// build board cells
for (let i = 0; i < 81; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 1;
    input.inputMode = 'numeric';
    input.pattern = '[1-9]';
    input.autocomplete = 'off';
    cell.appendChild(input);
    boardEl.appendChild(cell);

    // click/select
    cell.addEventListener('click', (e) => {
        if (selected !== -1) boardEl.children[selected].classList.remove('highlight');
        selected = i;
        cell.classList.add('highlight');
        input.focus();
    });

    // keyboard input
    input.addEventListener('input', (e) => {
        const val = input.value.replace(/[^1-9]/g, '');
        input.value = val;
        const idx = parseInt(cell.dataset.index);
        if (prefilled[idx]) { input.value = ''; return; }
        const prev = state[idx];
        const num = val ? parseInt(val) : 0;
        if (prev !== num) { history.push({ idx, prev }); }
        state[idx] = num;
        updateConflicts();
        if (num && solution[idx] !== num) { mistakes++; mistakesEl.textContent = mistakes; cell.classList.add('conflict'); status('Wrong number'); }
        else { cell.classList.remove('conflict'); status(''); }
        checkWin();
    });

    // handle backspace/delete
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' || e.key === 'Delete') {
            const idx = parseInt(cell.dataset.index);
            if (prefilled[idx]) { e.preventDefault(); return; }
            history.push({ idx, prev: state[idx] });
            state[idx] = 0; input.value = ''; updateConflicts();
        }
    });
}

// draw thicker block borders precisely
(function applyBlockBorders() {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const idx = r * 9 + c;
            const el = boardEl.children[idx];
            const styles = [];
            if (c % 3 === 0) styles.push('border-left:2px solid rgba(255,255,255,0.06)');
            if (r % 3 === 0) styles.push('border-top:2px solid rgba(255,255,255,0.06)');
            if (c === 8) styles.push('border-right:2px solid rgba(255,255,255,0.06)');
            if (r === 8) styles.push('border-bottom:2px solid rgba(255,255,255,0.06)');
            el.style.cssText += ';' + styles.join(';');
        }
    }
})();

// helper: shuffle array
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// generate a complete solved sudoku via backtracking
function generateSolved() {
    const grid = new Array(81).fill(0);
    const rows = Array.from({ length: 9 }, () => new Set());
    const cols = Array.from({ length: 9 }, () => new Set());
    const blocks = Array.from({ length: 9 }, () => new Set());

    function blockIndex(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

    function place(pos) {
        if (pos === 81) return true;
        const r = Math.floor(pos / 9), c = pos % 9;
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const n of nums) {
            if (rows[r].has(n) || cols[c].has(n) || blocks[blockIndex(r, c)].has(n)) continue;
            grid[pos] = n; rows[r].add(n); cols[c].add(n); blocks[blockIndex(r, c)].add(n);
            if (place(pos + 1)) return true;
            grid[pos] = 0; rows[r].delete(n); cols[c].delete(n); blocks[blockIndex(r, c)].delete(n);
        }
        return false;
    }
    place(0);
    return grid;
}

// solve via backtracking (used to verify uniqueness when generating puzzles and to provide 'solve')
function solve(grid) {
    const g = grid.slice();
    function findEmpty() { for (let i = 0; i < 81; i++) if (g[i] === 0) return i; return -1; }
    function valid(pos, val) {
        const r = Math.floor(pos / 9), c = pos % 9; const br = Math.floor(r / 3), bc = Math.floor(c / 3);
        for (let i = 0; i < 9; i++) { if (g[r * 9 + i] === val) return false; if (g[i * 9 + c] === val) return false; }
        for (let rr = br * 3; rr < br * 3 + 3; rr++) for (let cc = bc * 3; cc < bc * 3 + 3; cc++) if (g[rr * 9 + cc] === val) return false;
        return true;
    }
    function backtrack() {
        const pos = findEmpty();
        if (pos === -1) return true;
        for (let n = 1; n <= 9; n++) {
            if (!valid(pos, n)) continue;
            g[pos] = n;
            if (backtrack()) return true;
            g[pos] = 0;
        }
        return false;
    }
    const solvable = backtrack();
    return solvable ? g : null;
}

// remove numbers from solved board to make puzzle (naive approach)
function makePuzzle(solved, removals) {
    const puzzle = solved.slice();
    const order = shuffle(Array.from({ length: 81 }, (_, i) => i));
    let removed = 0;
    for (const idx of order) {
        if (removed >= removals) break;
        const backup = puzzle[idx]; puzzle[idx] = 0;
        // quick uniqueness check -- run solver and ensure at least one solution exists.
        const attempt = solve(puzzle);
        if (!attempt) { puzzle[idx] = backup; continue; }
        removed++;
    }
    return puzzle;
}

// render board to UI
function render() {
    for (let i = 0; i < 81; i++) {
        const el = boardEl.children[i];
        const input = el.firstElementChild;
        if (prefilled[i]) {
            el.classList.add('prefilled'); input.value = state[i] || '';
            input.disabled = true; input.style.fontWeight = '700';
        } else {
            el.classList.remove('prefilled'); input.disabled = false; input.value = state[i] || '';
        }
        el.classList.remove('conflict');
    }
    updateConflicts();
}

function updateConflicts() {
    // remove conflict marks
    for (let i = 0; i < 81; i++) boardEl.children[i].classList.remove('conflict');
    // check rows, cols, blocks
    for (let i = 0; i < 81; i++) {
        const val = state[i]; if (!val) continue;
        const r = Math.floor(i / 9), c = i % 9, br = Math.floor(r / 3), bc = Math.floor(c / 3);
        for (let j = 0; j < 9; j++) {
            const rc = r * 9 + j; if (rc !== i && state[rc] === val) boardEl.children[i].classList.add('conflict');
            const cc = j * 9 + c; if (cc !== i && state[cc] === val) boardEl.children[i].classList.add('conflict');
        }
        for (let rr = br * 3; rr < br * 3 + 3; rr++) for (let cc = bc * 3; cc < bc * 3 + 3; cc++) {
            const k = rr * 9 + cc; if (k !== i && state[k] === val) boardEl.children[i].classList.add('conflict');
        }
    }
}

function status(msg) {
    statusMsg.textContent = msg || '';
}

function checkWin() {
    if (state.every((v, i) => v !== 0 && v === solution[i])) {
        status('🎉 Puzzle complete — well done!');
        clearInterval(timer); timer = null;
    }
}

function startTimer() {
    clearInterval(timer); startTime = Date.now(); timer = setInterval(() => {
        const s = Math.floor((Date.now() - startTime) / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        timeEl.textContent = mm + ':' + ss;
    }, 250);
}

// Public actions
function newPuzzle() {
    const removals = parseInt(difficultyEl.value, 10);
    status('Generating puzzle...');
    // generate solved board
    const solved = generateSolved();
    solution = solved.slice();
    // create puzzle
    const puzzle = makePuzzle(solved, removals);
    state = puzzle.slice();
    prefilled = puzzle.map(v => v !== 0);
    mistakes = 0; mistakesEl.textContent = '0'; history = [];
    render(); startTimer(); status('New puzzle — good luck!');
}

function revealSolution() {
    state = solution.slice(); render(); updateConflicts(); status('Solution revealed'); clearInterval(timer); timer = null;
}

function giveHint() {
    // reveal one empty or incorrect cell
    const incorrect = [];
    for (let i = 0; i < 81; i++) {
        if (state[i] === 0 || state[i] !== solution[i]) incorrect.push(i);
    }
    if (incorrect.length === 0) { status('No hints — puzzle seems complete'); return; }
    const idx = incorrect[Math.floor(Math.random() * incorrect.length)];
    history.push({ idx, prev: state[idx] });
    state[idx] = solution[idx];
    prefilled[idx] = false; // hint is not locked
    render(); updateConflicts(); checkWin(); status('Hint revealed');
}

function undo() {
    const entry = history.pop(); if (!entry) { status('Nothing to undo'); return; }
    state[entry.idx] = entry.prev; render(); updateConflicts(); status('Undo');
}

// build number pad
for (let n = 1; n <= 9; n++) {
    const b = document.createElement('div'); b.className = 'num-btn'; b.textContent = n; b.dataset.num = n;
    b.addEventListener('click', () => {
        if (selected === -1) { status('Select a cell first'); return; }
        const el = boardEl.children[selected]; const idx = selected; if (prefilled[idx]) { status('Cell is locked'); return; }
        const prev = state[idx]; history.push({ idx, prev });
        state[idx] = n; el.firstElementChild.value = n; updateConflicts(); if (solution[idx] !== n) { mistakes++; mistakesEl.textContent = mistakes; el.classList.add('conflict'); status('Wrong number'); } else { el.classList.remove('conflict'); status(''); }
        checkWin();
    });
    numpadEl.appendChild(b);
}

// wire buttons
newBtn.addEventListener('click', newPuzzle);
solveBtn.addEventListener('click', () => { if (confirm('Reveal full solution?')) revealSolution(); });
checkBtn.addEventListener('click', () => {
    updateConflicts(); const bad = [...boardEl.children].filter(c => c.classList.contains('conflict'));
    if (bad.length) status('There are conflicts — red cells are wrong.'); else status('No conflicts found.');
});
hintBtn.addEventListener('click', giveHint);
undoBtn.addEventListener('click', undo);

// keyboard support: numbers and arrows
window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return; // handled by input
    if (e.key >= '1' && e.key <= '9') {
        if (selected === -1) return; const idx = selected; if (prefilled[idx]) return; history.push({ idx, prev: state[idx] }); state[idx] = parseInt(e.key); boardEl.children[idx].firstElementChild.value = e.key; updateConflicts(); if (solution[idx] !== state[idx]) { mistakes++; mistakesEl.textContent = mistakes; boardEl.children[idx].classList.add('conflict'); }
        checkWin();
    }
    const nav = { 'ArrowLeft': -1, 'ArrowRight': 1, 'ArrowUp': -9, 'ArrowDown': 9 };
    if (nav[e.key] && selected !== -1) {
        e.preventDefault(); const nx = selected + nav[e.key]; if (nx >= 0 && nx < 81) { if (selected !== -1) boardEl.children[selected].classList.remove('highlight'); selected = nx; boardEl.children[selected].classList.add('highlight'); }
    }
});

// initialize
newPuzzle();