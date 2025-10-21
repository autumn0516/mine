// 游戏配置
const CONFIG = {
    easy: { rows: 8, cols: 8, mines: 10 },
    medium: { rows: 10, cols: 10, mines: 20 },
    hard: { rows: 12, cols: 12, mines: 30 }
};

// 游戏模式
let gameMode = 'solo'; // solo 或 online

// 单人游戏状态
let soloGameState = {
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

// 联机游戏状态
let onlineGameState = {
    board: [],
    revealed: [],
    config: null,
    myScore: 0,
    leaderboard: [],
    currentSkill: null,
    skillTarget: null
};

// DOM 元素
const elements = {
    board: document.getElementById('game-board'),
    minesCount: document.getElementById('mines-count'),
    timer: document.getElementById('timer'),
    scoreCount: document.getElementById('score-count'),
    newGameBtn: document.getElementById('new-game'),
    diffBtns: document.querySelectorAll('.diff-btn'),
    modal: document.getElementById('modal'),
    modalIcon: document.getElementById('modal-icon'),
    modalTitle: document.getElementById('modal-title'),
    modalMessage: document.getElementById('modal-message'),
    modalBtn: document.getElementById('modal-btn'),
    particlesCanvas: document.getElementById('particles'),
    fireworksCanvas: document.getElementById('fireworks'),
    leaderboard: document.getElementById('leaderboard'),
    leaderboardList: document.getElementById('leaderboard-list'),
    skillsBar: document.getElementById('skills-bar'),
    skillModal: document.getElementById('skill-modal'),
    finalLeaderboard: document.getElementById('final-leaderboard')
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

// ========== 单人模式 ==========

// 初始化单人游戏
function initGame(difficulty = 'easy') {
    gameMode = 'solo';

    const config = CONFIG[difficulty];
    soloGameState = {
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
        soloGameState.board[i] = [];
        soloGameState.revealed[i] = [];
        soloGameState.flagged[i] = [];
        for (let j = 0; j < config.cols; j++) {
            soloGameState.board[i][j] = 0;
            soloGameState.revealed[i][j] = false;
            soloGameState.flagged[i][j] = false;
        }
    }

    // 随机放置地雷
    let minesPlaced = 0;
    while (minesPlaced < config.mines) {
        const row = Math.floor(Math.random() * config.rows);
        const col = Math.floor(Math.random() * config.cols);

        if (soloGameState.board[row][col] !== -1) {
            soloGameState.board[row][col] = -1;
            minesPlaced++;
        }
    }

    // 计算每个格子周围的地雷数
    for (let i = 0; i < config.rows; i++) {
        for (let j = 0; j < config.cols; j++) {
            if (soloGameState.board[i][j] !== -1) {
                let count = 0;
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        const ni = i + di;
                        const nj = j + dj;
                        if (ni >= 0 && ni < config.rows && nj >= 0 && nj < config.cols) {
                            if (soloGameState.board[ni][nj] === -1) {
                                count++;
                            }
                        }
                    }
                }
                soloGameState.board[i][j] = count;
            }
        }
    }

    renderBoard();
    updateSoloUI();
}

// 渲染棋盘
function renderBoard() {
    elements.board.innerHTML = '';

    const state = gameMode === 'solo' ? soloGameState : onlineGameState;
    const cols = gameMode === 'solo' ? state.cols : state.config.cols;
    const rows = gameMode === 'solo' ? state.rows : state.config.rows;

    elements.board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = i;
            cell.dataset.col = j;

            // 触摸事件处理
            let pressTimer = null;
            let isLongPress = false;

            cell.addEventListener('touchstart', (e) => {
                e.preventDefault();
                isLongPress = false;

                pressTimer = setTimeout(() => {
                    isLongPress = true;

                    if (gameMode === 'solo') {
                        handleSoloFlag(i, j);
                    }

                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, 500);
            });

            cell.addEventListener('touchend', (e) => {
                e.preventDefault();
                clearTimeout(pressTimer);

                if (!isLongPress) {
                    handleCellClick(i, j);
                }
            });

            cell.addEventListener('touchmove', () => {
                clearTimeout(pressTimer);
            });

            // 鼠标事件（桌面端）
            cell.addEventListener('click', () => handleCellClick(i, j));
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (gameMode === 'solo') {
                    handleSoloFlag(i, j);
                }
            });

            elements.board.appendChild(cell);
        }
    }

    updateCells();
}

// 更新单元格显示
function updateCells() {
    const cells = elements.board.querySelectorAll('.cell');

    if (gameMode === 'solo') {
        updateSoloCells(cells);
    } else {
        updateOnlineCells(cells);
    }
}

function updateSoloCells(cells) {
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        cell.className = 'cell';
        cell.textContent = '';

        if (soloGameState.flagged[row][col]) {
            cell.classList.add('flagged');
            cell.textContent = '🚩';
        } else if (soloGameState.revealed[row][col]) {
            cell.classList.add('revealed');

            if (soloGameState.board[row][col] === -1) {
                cell.classList.add('mine');
                cell.textContent = '💣';
            } else if (soloGameState.board[row][col] > 0) {
                cell.textContent = soloGameState.board[row][col];
                cell.dataset.count = soloGameState.board[row][col];
            }
        }

        // 游戏结束时显示所有地雷
        if (soloGameState.gameOver && soloGameState.board[row][col] === -1 && !soloGameState.flagged[row][col]) {
            cell.classList.add('mine');
            cell.textContent = '💣';
        }

        // 显示错误的旗帜
        if (soloGameState.gameOver && soloGameState.flagged[row][col] && soloGameState.board[row][col] !== -1) {
            cell.classList.add('wrong-flag');
            cell.textContent = '❌';
        }
    });
}

function handleCellClick(row, col) {
    if (gameMode === 'solo') {
        handleSoloClick(row, col);
    } else {
        handleOnlineClick(row, col);
    }
}

function handleSoloClick(row, col) {
    if (soloGameState.gameOver || soloGameState.gameWon) return;
    if (soloGameState.flagged[row][col]) return;
    if (soloGameState.revealed[row][col]) return;

    // 开始计时
    if (!soloGameState.startTime) {
        startTimer();
    }

    // 点击地雷
    if (soloGameState.board[row][col] === -1) {
        soloGameOver(false);
        return;
    }

    // 揭示格子
    revealCell(row, col);

    // 检查是否获胜
    checkWin();
}

function handleSoloFlag(row, col) {
    if (soloGameState.gameOver || soloGameState.gameWon) return;
    if (soloGameState.revealed[row][col]) return;

    soloGameState.flagged[row][col] = !soloGameState.flagged[row][col];

    if (soloGameState.flagged[row][col]) {
        soloGameState.flagCount++;
    } else {
        soloGameState.flagCount--;
    }

    updateCells();
    updateSoloUI();
}

function revealCell(row, col) {
    if (row < 0 || row >= soloGameState.rows || col < 0 || col >= soloGameState.cols) return;
    if (soloGameState.revealed[row][col]) return;
    if (soloGameState.flagged[row][col]) return;

    soloGameState.revealed[row][col] = true;

    // 如果是空格，递归揭示周围格子
    if (soloGameState.board[row][col] === 0) {
        for (let di = -1; di <= 1; di++) {
            for (let dj = -1; dj <= 1; dj++) {
                revealCell(row + di, col + dj);
            }
        }
    }

    updateCells();
}

function checkWin() {
    let revealedCount = 0;

    for (let i = 0; i < soloGameState.rows; i++) {
        for (let j = 0; j < soloGameState.cols; j++) {
            if (soloGameState.revealed[i][j]) {
                revealedCount++;
            }
        }
    }

    const totalCells = soloGameState.rows * soloGameState.cols;
    const safeCells = totalCells - soloGameState.mines;

    if (revealedCount === safeCells) {
        soloGameOver(true);
    }
}

function soloGameOver(won) {
    soloGameState.gameOver = true;
    soloGameState.gameWon = won;

    stopTimer();
    updateCells();

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

        elements.finalLeaderboard.innerHTML = '';
        elements.modal.classList.add('show');
    }, 500);
}

function startTimer() {
    soloGameState.startTime = Date.now();

    soloGameState.timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - soloGameState.startTime) / 1000);
        elements.timer.textContent = elapsed;
    }, 1000);
}

function stopTimer() {
    if (soloGameState.timerInterval) {
        clearInterval(soloGameState.timerInterval);
        soloGameState.timerInterval = null;
    }
}

function updateSoloUI() {
    elements.minesCount.textContent = soloGameState.mines;
    elements.scoreCount.textContent = soloGameState.flagCount;
}

// ========== 联机模式 ==========

// 初始化联机游戏（由 multiplayer.js 调用）
function initOnlineGame(gameState) {
    gameMode = 'online';

    onlineGameState = {
        board: gameState.board || [],
        revealed: gameState.revealed || [],
        config: gameState.config,
        myScore: 0,
        leaderboard: [],
        currentSkill: null,
        skillTarget: null
    };

    renderBoard();
    updateOnlineUI();
    setupSkillButtons();
}

function updateOnlineCells(cells) {
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);

        cell.className = 'cell';
        cell.textContent = '';

        const revealedBy = onlineGameState.revealed[row]?.[col];

        if (revealedBy) {
            cell.classList.add('revealed');

            const value = onlineGameState.board[row][col];

            if (value === -1) {
                cell.classList.add('mine');
                cell.textContent = '💣';
            } else if (value > 0) {
                cell.textContent = value;
                cell.dataset.count = value;
            }
        }
    });
}

function handleOnlineClick(row, col) {
    // 如果正在选择技能目标
    if (onlineGameState.currentSkill) {
        handleSkillTarget(row, col);
        return;
    }

    // 正常点击揭示
    if (typeof multiplayerClient !== 'undefined' && multiplayerClient.isOnline) {
        multiplayerClient.revealCell(row, col);
    }
}

// 处理服务器返回的揭示结果
function onCellRevealed(data) {
    const { playerId, result, leaderboard } = data;

    if (result.type === 'frozen') {
        showNotification('你被冰冻了！', 'error');
        return;
    }

    if (result.type === 'shielded') {
        showNotification('护盾抵挡了地雷！', 'success');
        const cells = elements.board.querySelectorAll('.cell');
        const cell = Array.from(cells).find(c =>
            parseInt(c.dataset.row) === result.row &&
            parseInt(c.dataset.col) === result.col
        );
        if (cell) {
            cell.classList.add('skill-effect-shield');
            setTimeout(() => cell.classList.remove('skill-effect-shield'), 500);
        }
    }

    if (result.type === 'mine') {
        // 更新揭示状态
        if (!onlineGameState.revealed[result.row]) {
            onlineGameState.revealed[result.row] = [];
        }
        onlineGameState.revealed[result.row][result.col] = playerId;
    }

    if (result.type === 'success' && result.revealed) {
        result.revealed.forEach(([r, c, v]) => {
            if (!onlineGameState.revealed[r]) {
                onlineGameState.revealed[r] = [];
            }
            onlineGameState.revealed[r][c] = playerId;
        });

        if (playerId === multiplayerClient.playerId) {
            onlineGameState.myScore = result.score;
        }
    }

    onlineGameState.leaderboard = leaderboard;
    updateCells();
    updateOnlineUI();
}

// 技能系统
function setupSkillButtons() {
    const skillButtons = document.querySelectorAll('.skill-btn');

    skillButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const skill = btn.dataset.skill;
            activateSkill(skill);
        });
    });
}

function activateSkill(skillName) {
    const skillCounts = {
        freeze: document.getElementById('freeze-count'),
        reveal: document.getElementById('reveal-count'),
        bomb: document.getElementById('bomb-count'),
        shield: document.getElementById('shield-count'),
        swap: document.getElementById('swap-count')
    };

    const count = parseInt(skillCounts[skillName].textContent);
    if (count <= 0) {
        showNotification('技能次数不足', 'error');
        return;
    }

    onlineGameState.currentSkill = skillName;

    // 冰冻和护盾技能直接使用
    if (skillName === 'freeze' || skillName === 'shield') {
        multiplayerClient.useSkill(skillName, {});
        onlineGameState.currentSkill = null;
    } else {
        // 其他技能需要选择目标
        elements.skillModal.classList.add('show');
        document.getElementById('skill-title').textContent = getSkillTitle(skillName);
        document.getElementById('skill-instruction').textContent = getSkillInstruction(skillName);
    }
}

function getSkillTitle(skill) {
    const titles = {
        reveal: '透视技能',
        bomb: '炸弹技能',
        swap: '交换技能'
    };
    return titles[skill] || '选择目标';
}

function getSkillInstruction(skill) {
    const instructions = {
        reveal: '点击一个格子查看周围 3x3 区域',
        bomb: '点击一个格子炸开周围 5x5 区域',
        swap: '点击两个格子进行交换'
    };
    return instructions[skill] || '请在棋盘上选择';
}

function handleSkillTarget(row, col) {
    const skill = onlineGameState.currentSkill;

    if (skill === 'swap') {
        if (!onlineGameState.skillTarget) {
            onlineGameState.skillTarget = { row1: row, col1: col };
            showNotification('请选择第二个格子', 'info');
        } else {
            multiplayerClient.useSkill(skill, {
                row1: onlineGameState.skillTarget.row1,
                col1: onlineGameState.skillTarget.col1,
                row2: row,
                col2: col
            });

            onlineGameState.currentSkill = null;
            onlineGameState.skillTarget = null;
            elements.skillModal.classList.remove('show');
        }
    } else {
        multiplayerClient.useSkill(skill, { row, col });
        onlineGameState.currentSkill = null;
        elements.skillModal.classList.remove('show');
    }
}

// 处理技能使用结果
function onSkillUsed(data) {
    const { playerId, skillName, result, leaderboard } = data;

    if (!result.success) {
        if (playerId === multiplayerClient.playerId) {
            showNotification(result.message, 'error');
        }
        return;
    }

    // 更新技能次数
    if (playerId === multiplayerClient.playerId) {
        const countElement = document.getElementById(`${skillName}-count`);
        if (countElement) {
            const newCount = parseInt(countElement.textContent) - 1;
            countElement.textContent = Math.max(0, newCount);

            // 禁用按钮
            if (newCount <= 0) {
                const skillBtn = document.querySelector(`[data-skill="${skillName}"]`);
                if (skillBtn) {
                    skillBtn.classList.add('disabled');
                }
            }
        }
    }

    // 应用技能效果
    switch (result.type) {
        case 'freeze':
            if (playerId !== multiplayerClient.playerId) {
                showNotification('你被冰冻了 3 秒！', 'error');
                // 冰冻效果
                elements.board.style.pointerEvents = 'none';
                setTimeout(() => {
                    elements.board.style.pointerEvents = 'auto';
                }, result.duration);
            } else {
                showNotification('冰冻技能已使用！', 'success');
            }
            break;

        case 'reveal':
            if (playerId === multiplayerClient.playerId) {
                showNotification('透视区域已显示', 'success');
                // 临时显示透视区域
                highlightCells(result.revealed, 'skill-effect-reveal');
            }
            break;

        case 'bomb':
            showNotification('炸弹爆炸！', 'info');
            result.revealed.forEach(([r, c, v]) => {
                if (!onlineGameState.revealed[r]) {
                    onlineGameState.revealed[r] = [];
                }
                onlineGameState.revealed[r][c] = playerId;
            });

            // 爆炸动画
            const bombCells = elements.board.querySelectorAll('.cell');
            const bombCell = Array.from(bombCells).find(c =>
                parseInt(c.dataset.row) === result.row &&
                parseInt(c.dataset.col) === result.col
            );
            if (bombCell) {
                bombCell.classList.add('skill-effect-bomb');
                setTimeout(() => bombCell.classList.remove('skill-effect-bomb'), 600);
            }
            break;

        case 'shield':
            if (playerId === multiplayerClient.playerId) {
                showNotification('护盾已激活！', 'success');
            }
            break;

        case 'swap':
            if (playerId === multiplayerClient.playerId) {
                showNotification('格子已交换', 'success');
            }
            break;
    }

    onlineGameState.leaderboard = leaderboard;
    updateCells();
    updateOnlineUI();
}

function highlightCells(positions, className) {
    const cells = elements.board.querySelectorAll('.cell');

    positions.forEach(([row, col, value]) => {
        const cell = Array.from(cells).find(c =>
            parseInt(c.dataset.row) === row &&
            parseInt(c.dataset.col) === col
        );

        if (cell && !cell.classList.contains('revealed')) {
            cell.classList.add(className);
            cell.textContent = value === -1 ? '💣' : (value || '');
            if (value > 0) {
                cell.dataset.count = value;
            }

            setTimeout(() => {
                cell.classList.remove(className);
                if (!onlineGameState.revealed[row]?.[col]) {
                    cell.textContent = '';
                    delete cell.dataset.count;
                }
            }, 3000);
        }
    });
}

function updateOnlineUI() {
    elements.minesCount.textContent = onlineGameState.config.mines;
    elements.scoreCount.textContent = onlineGameState.myScore;

    // 更新排行榜
    if (onlineGameState.leaderboard && onlineGameState.leaderboard.length > 0) {
        elements.leaderboardList.innerHTML = '';

        onlineGameState.leaderboard.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = `leaderboard-item rank-${player.rank}`;

            const rankIcons = ['🥇', '🥈', '🥉'];
            const rankIcon = rankIcons[index] || '🏅';

            item.innerHTML = `
                <div>
                    <span class="player-rank">${rankIcon}</span>
                    <span>${player.name}</span>
                </div>
                <span class="player-score">${player.score}分</span>
            `;

            elements.leaderboardList.appendChild(item);
        });
    }
}

// 游戏结束
function onGameEnd(data) {
    setTimeout(() => {
        elements.modalIcon.textContent = '🏆';
        elements.modalTitle.textContent = '游戏结束！';
        elements.modalMessage.textContent = '最终排名：';

        // 显示最终排行榜
        elements.finalLeaderboard.innerHTML = '';
        data.leaderboard.forEach((player, index) => {
            const rankIcons = ['🥇', '🥈', '🥉'];
            const rankIcon = rankIcons[index] || `#${index + 1}`;

            const item = document.createElement('div');
            item.style.cssText = 'display: flex; justify-content: space-between; padding: 10px; margin: 5px 0; background: rgba(255,255,255,0.1); border-radius: 8px;';
            item.innerHTML = `
                <span>${rankIcon} ${player.name}</span>
                <span style="color: #00f2fe; font-weight: 700;">${player.score}分</span>
            `;
            elements.finalLeaderboard.appendChild(item);
        });

        if (data.leaderboard[0]?.name === multiplayerClient.currentRoom?.players.find(p => p.id === multiplayerClient.playerId)?.name) {
            launchFireworks();
        }

        elements.modal.classList.add('show');
    }, 500);
}

// 事件监听器
document.addEventListener('DOMContentLoaded', () => {
    initParticles();

    // 新游戏按钮
    elements.newGameBtn.addEventListener('click', () => {
        if (gameMode === 'solo') {
            stopTimer();
            elements.timer.textContent = '0';
            initGame(soloGameState.difficulty);
        }
    });

    // 难度选择
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

    // 弹窗按钮
    elements.modalBtn.addEventListener('click', () => {
        elements.modal.classList.remove('show');

        if (gameMode === 'solo') {
            stopTimer();
            elements.timer.textContent = '0';
            initGame(soloGameState.difficulty);
        }
    });

    // 点击弹窗背景关闭
    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            elements.modal.classList.remove('show');
        }
    });

    // 取消技能
    document.getElementById('cancel-skill').addEventListener('click', () => {
        onlineGameState.currentSkill = null;
        onlineGameState.skillTarget = null;
        elements.skillModal.classList.remove('show');
    });
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
