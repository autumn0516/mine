// 游戏配置
const CONFIG = {
    easy: { rows: 8, cols: 8, mines: 10 },
    medium: { rows: 10, cols: 10, mines: 20 },
    hard: { rows: 12, cols: 12, mines: 30 }
};

// 游戏状态
let gameState = {
    board: [],
    revealed: [],
    flagged: [],
    rows: 0,
    cols: 0,
    mines: 0,
    gameOver: false,
    gameWon: false,
    flagCount: 0,
    timerInterval: null,
    startTime: null,
    difficulty: 'easy'
};

// DOM 元素
const elements = {
    board: document.getElementById('game-board'),
    minesCount: document.getElementById('mines-count'),
    timer: document.getElementById('timer'),
    flagsCount: document.getElementById('flags-count'),
    newGameBtn: document.getElementById('new-game'),
    diffBtns: document.querySelectorAll('.diff-btn'),
    modal: document.getElementById('modal'),
    modalIcon: document.getElementById('modal-icon'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalBtn: document.getElementById('modal-btn'),
    particlesCanvas: document.getElementById('particles'),
    fireworksCanvas: document.getElementById('fireworks')
};

// 初始化粒子背景
function initParticles() {
    const canvas = elements.particlesCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const particleCount = 50;

    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
        }
    }

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        // 连接粒子
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 255, 255, ${0.2 * (1 - distance / 100)})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });
}

// 烟花效果
function launchFireworks() {
    const canvas = elements.fireworksCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.classList.add('show');

    const particles = [];

    class FireworkParticle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 8;
            this.vy = (Math.random() - 0.5) * 8;
            this.alpha = 1;
            this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.1;
            this.alpha -= 0.01;
        }

        draw() {
            ctx.save();
            ctx.globalAlpha = this.alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function createFirework() {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height * 0.5;

        for (let i = 0; i < 50; i++) {
            particles.push(new FireworkParticle(x, y));
        }
    }

    let fireworkCount = 0;
    const maxFireworks = 5;

    function animate() {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        particles.forEach((particle, index) => {
            particle.update();
            particle.draw();

            if (particle.alpha <= 0) {
                particles.splice(index, 1);
            }
        });

        if (particles.length > 0) {
            requestAnimationFrame(animate);
        } else if (fireworkCount < maxFireworks) {
            setTimeout(() => {
                createFirework();
                fireworkCount++;
                animate();
            }, 500);
        } else {
            canvas.classList.remove('show');
            fireworkCount = 0;
        }
    }

    createFirework();
    animate();
}

// 初始化游戏
function initGame(difficulty = 'easy') {
    const config = CONFIG[difficulty];
    gameState = {
        board: [],
        revealed: [],
        flagged: [],
        rows: config.rows,
        cols: config.cols,
        mines: config.mines,
        gameOver: false,
        gameWon: false,
        flagCount: 0,
        timerInterval: null,
        startTime: null,
        difficulty: difficulty
    };

    // 创建空棋盘
    for (let i = 0; i < config.rows; i++) {
        gameState.board[i] = [];
        gameState.revealed[i] = [];
        gameState.flagged[i] = [];
        for (let j = 0; j < config.cols; j++) {
            gameState.board[i][j] = 0;
            gameState.revealed[i][j] = false;
            gameState.flagged[i][j] = false;
        }
    }

    // 随机放置地雷
    let minesPlaced = 0;
    while (minesPlaced < config.mines) {
        const row = Math.floor(Math.random() * config.rows);
        const col = Math.floor(Math.random() * config.cols);

        if (gameState.board[row][col] !== -1) {
            gameState.board[row][col] = -1;
            minesPlaced++;
        }
    }

    // 计算每个格子周围的地雷数
    for (let i = 0; i < config.rows; i++) {
        for (let j = 0; j < config.cols; j++) {
            if (gameState.board[i][j] !== -1) {
                let count = 0;
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni >= 0 && ni < config.rows && nj >= 0 && nj < config.cols) {
                            if (gameState.board[ni][nj] === -1) {
                                count++;
                            }
                        }
                    }
                }
                gameState.board[i][j] = count;
            }
        }
    }

    renderBoard();
    updateUI();
}

// 渲染棋盘
function renderBoard() {
    elements.board.innerHTML = '';
    elements.board.style.gridTemplateColumns = `repeat(${gameState.cols}, 1fr)`;

    for (let i = 0; i < gameState.rows; i++) {
        for (let j = 0; j < gameState.cols; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = i;
            cell.dataset.col = j;

            // 触摸事件处理（支持长按）
            let pressTimer = null;
            let isLongPress = false;

            // 触摸开始
            cell.addEventListener('touchstart', (e) => {
                e.preventDefault();
                isLongPress = false;

                pressTimer = setTimeout(() => {
                    isLongPress = true;
                    handleFlag(i, j);
                    // 触觉反馈
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, 500);
            });

            // 触摸结束
            cell.addEventListener('touchend', (e) => {
                e.preventDefault();
                clearTimeout(pressTimer);

                if (!isLongPress) {
                    handleClick(i, j);
                }
            });

            // 触摸移动时取消长按
            cell.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });

            // 鼠标事件（桌面端）
            cell.addEventListener('click', () => handleClick(i, j));
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                handleFlag(i, j);
            });

            elements.board.appendChild(cell);
        }
    }

    updateCells();
}

// 更新单元格显示
function updateCells() {
    const cells = elements.board.querySelectorAll('.cell');

    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        cell.className = 'cell';
        cell.textContent = '';

        if (gameState.flagged[row][col]) {
            cell.classList.add('flagged');
            cell.textContent = '🚩';
        } else if (gameState.revealed[row][col]) {
            cell.classList.add('revealed');

            if (gameState.board[row][col] === -1) {
                cell.classList.add('mine');
                cell.textContent = '💣';
            } else if (gameState.board[row][col] > 0) {
                cell.textContent = gameState.board[row][col];
                cell.dataset.count = gameState.board[row][col];
            }
        }

        // 游戏结束时显示所有地雷
        if (gameState.gameOver && gameState.board[row][col] === -1 && !gameState.flagged[row][col]) {
            cell.classList.add('mine');
            cell.textContent = '💣';
        }

        // 显示错误的旗帜
        if (gameState.gameOver && gameState.flagged[row][col] && gameState.board[row][col] !== -1) {
            cell.classList.add('wrong-flag');
            cell.textContent = '❌';
        }
    });
}

// 处理点击
function handleClick(row, col) {
    if (gameState.gameOver || gameState.gameWon) return;
    if (gameState.flagged[row][col]) return;
    if (gameState.revealed[row][col]) return;

    // 开始计时
    if (!gameState.startTime) {
        startTimer();
    }

    // 点击地雷
    if (gameState.board[row][col] === -1) {
        gameOver(false);
        return;
    }

    // 揭示格子
    revealCell(row, col);

    // 检查是否获胜
    checkWin();
}

// 处理插旗
function handleFlag(row, col) {
    if (gameState.gameOver || gameState.gameWon) return;
    if (gameState.revealed[row][col]) return;

    gameState.flagged[row][col] = !gameState.flagged[row][col];

    if (gameState.flagged[row][col]) {
        gameState.flagCount++;
    } else {
        gameState.flagCount--;
    }

    updateCells();
    updateUI();
}

// 揭示单元格
function revealCell(row, col) {
    if (row < 0 || row >= gameState.rows || col < 0 || col >= gameState.cols) return;
    if (gameState.revealed[row][col]) return;
    if (gameState.flagged[row][col]) return;

    gameState.revealed[row][col] = true;

    // 如果是空格，递归揭示周围格子
    if (gameState.board[row][col] === 0) {
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                revealCell(row + di, col + dj);
            }
        }
    }

    updateCells();
}

// 检查胜利
function checkWin() {
    let revealedCount = 0;

    for (let i = 0; i < gameState.rows; i++) {
        for (let j = 0; j < gameState.cols; j++) {
            if (gameState.revealed[i][j]) {
                revealedCount++;
            }
        }
    }

    const totalCells = gameState.rows * gameState.cols;
    const safeCells = totalCells - gameState.mines;

    if (revealedCount === safeCells) {
        gameOver(true);
    }
}

// 游戏结束
function gameOver(won) {
    gameState.gameOver = true;
    gameState.gameWon = won;

    stopTimer();
    updateCells();

    // 显示弹窗
    setTimeout(() => {
        if (won) {
            elements.modalIcon.textContent = '🎉';
            elements.modalTitle.textContent = '恭喜胜利！';
            elements.modalMessage.textContent = `用时 ${elements.timer.textContent} 秒，成功排除所有地雷！`;
            launchFireworks();
        } else {
            elements.modalIcon.textContent = '💥';
            elements.modalTitle.textContent = '游戏结束';
            elements.modalMessage.textContent = '不幸踩到地雷了，再试一次吧！';
        }

        elements.modal.classList.add('show');
    }, 500);
}

// 计时器
function startTimer() {
    gameState.startTime = Date.now();

    gameState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
        elements.timer.textContent = elapsed;
    }, 1000);
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

// 更新 UI
function updateUI() {
    elements.minesCount.textContent = gameState.mines;
    elements.flagsCount.textContent = gameState.flagCount;
}

// 事件监听
elements.newGameBtn.addEventListener('click', () => {
    stopTimer();
    elements.timer.textContent = '0';
    initGame(gameState.difficulty);
});

elements.diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        elements.diffBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const difficulty = btn.dataset.level;
        stopTimer();
        elements.timer.textContent = '0';
        initGame(difficulty);
    });
});

elements.modalBtn.addEventListener('click', () => {
    elements.modal.classList.remove('show');
    stopTimer();
    elements.timer.textContent = '0';
    initGame(gameState.difficulty);
});

// 点击弹窗背景关闭
elements.modal.addEventListener('click', (e) => {
    if (e.target === elements.modal) {
        elements.modal.classList.remove('show');
    }
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initGame('easy');
});

// 防止双击缩放
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// 防止默认的长按菜单
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});
