// 联机对战客户端
class MultiplayerClient {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.roomId = null;
        this.isOnline = false;
        this.isHost = false;
        this.currentRoom = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.hostname || 'localhost';
            const port = window.location.port || '3000';

            this.ws = new WebSocket(`${protocol}//${host}:${port}`);

            this.ws.onopen = () => {
                console.log('WebSocket 连接成功');
                this.reconnectAttempts = 0;
                updateConnectionStatus(true);
                resolve();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket 错误:', error);
                updateConnectionStatus(false);
                reject(error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket 连接关闭');
                updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };
        });
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

            setTimeout(() => {
                this.connect().catch(() => {
                    console.log('重连失败');
                });
            }, 2000 * this.reconnectAttempts);
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    handleMessage(data) {
        console.log('收到消息:', data);

        switch (data.type) {
            case 'connected':
                this.playerId = data.playerId;
                this.isOnline = true;
                break;

            case 'roomCreated':
                this.roomId = data.roomId;
                this.isHost = true;
                this.currentRoom = data.room;
                showRoomWaiting(data.room);
                break;

            case 'roomUpdated':
                this.currentRoom = data.room;
                updatePlayerslist(data.room);
                break;

            case 'gameStarted':
                hideAllMenus();
                startOnlineGame(data.gameState);
                break;

            case 'cellRevealed':
                handleCellRevealed(data);
                break;

            case 'skillUsed':
                handleSkillUsed(data);
                break;

            case 'gameEnded':
                handleGameEnd(data);
                break;

            case 'error':
                showNotification(data.message, 'error');
                break;
        }
    }

    setName(name) {
        this.send({
            type: 'setName',
            name: name
        });
    }

    createRoom() {
        this.send({
            type: 'createRoom'
        });
    }

    joinRoom(roomId) {
        this.send({
            type: 'joinRoom',
            roomId: roomId
        });
    }

    startGame(config) {
        this.send({
            type: 'startGame',
            config: config
        });
    }

    revealCell(row, col) {
        this.send({
            type: 'revealCell',
            row: row,
            col: col
        });
    }

    useSkill(skillName, data) {
        this.send({
            type: 'useSkill',
            skillName: skillName,
            data: data
        });
    }

    leaveRoom() {
        this.roomId = null;
        this.isHost = false;
        this.currentRoom = null;
    }
}

// 全局联机客户端实例
const multiplayerClient = new MultiplayerClient();

// UI 更新函数
function updateConnectionStatus(connected) {
    const statusText = document.getElementById('status-text');
    if (statusText) {
        statusText.textContent = connected ? '🟢 已连接' : '🔴 未连接';
    }
}

function showRoomWaiting(room) {
    document.getElementById('online-lobby').style.display = 'none';
    document.getElementById('room-waiting').style.display = 'block';
    document.getElementById('current-room-id').textContent = room.id.substring(0, 8);

    if (multiplayerClient.isHost) {
        document.getElementById('start-game-btn').style.display = 'block';
    }

    updatePlayerslist(room);
}

function updatePlayerslist(room) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '';

    room.players.forEach((player, index) => {
        const playerCard = document.createElement('div');
        playerCard.className = 'player-card';

        const isHost = player.id === room.hostId;
        const crown = isHost ? '👑 ' : '';

        playerCard.innerHTML = `
            <div class="player-info">
                <span class="player-icon">${getPlayerIcon(index)}</span>
                <span class="player-name">${crown}${player.name}</span>
            </div>
            <div class="player-ready">准备中</div>
        `;

        playersList.appendChild(playerCard);
    });
}

function getPlayerIcon(index) {
    const icons = ['🔥', '⚡', '💎', '🌟'];
    return icons[index % icons.length];
}

function hideAllMenus() {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('online-lobby').style.display = 'none';
    document.getElementById('room-waiting').style.display = 'none';
}

function showMainMenu() {
    hideAllMenus();
    document.getElementById('main-menu').style.display = 'block';
    document.getElementById('game-container').style.display = 'none';
}

function showOnlineLobby() {
    hideAllMenus();
    document.getElementById('online-lobby').style.display = 'block';
}

function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 事件监听器
document.addEventListener('DOMContentLoaded', () => {
    // 单人模式按钮
    document.getElementById('solo-mode-btn').addEventListener('click', () => {
        hideAllMenus();
        document.getElementById('game-container').style.display = 'block';
        document.getElementById('mode-text').textContent = '单人模式';
        document.getElementById('difficulty-selector').style.display = 'flex';
        document.getElementById('skills-bar').style.display = 'none';
        document.getElementById('leaderboard').style.display = 'none';
        document.getElementById('score-label').textContent = '🚩 旗帜';

        if (typeof initGame === 'function') {
            initGame('easy');
        }
    });

    // 联机模式按钮
    document.getElementById('online-mode-btn').addEventListener('click', async () => {
        showOnlineLobby();

        try {
            await multiplayerClient.connect();
        } catch (error) {
            showNotification('无法连接到服务器，请确保服务器正在运行', 'error');
        }
    });

    // 返回主菜单
    document.getElementById('back-to-menu-btn').addEventListener('click', () => {
        showMainMenu();
        if (multiplayerClient.ws) {
            multiplayerClient.ws.close();
        }
    });

    // 创建房间
    document.getElementById('create-room-btn').addEventListener('click', () => {
        const playerName = document.getElementById('player-name').value.trim();
        if (!playerName) {
            showNotification('请输入昵称', 'error');
            return;
        }

        multiplayerClient.setName(playerName);
        multiplayerClient.createRoom();
    });

    // 加入房间
    document.getElementById('join-room-btn').addEventListener('click', () => {
        const playerName = document.getElementById('player-name').value.trim();
        if (!playerName) {
            showNotification('请输入昵称', 'error');
            return;
        }

        document.getElementById('room-input').style.display = 'block';
    });

    // 确认加入房间
    document.getElementById('confirm-join-btn').addEventListener('click', () => {
        const roomId = document.getElementById('room-id-input').value.trim();
        if (!roomId) {
            showNotification('请输入房间 ID', 'error');
            return;
        }

        const playerName = document.getElementById('player-name').value.trim();
        multiplayerClient.setName(playerName);
        multiplayerClient.joinRoom(roomId);
    });

    // 复制房间 ID
    document.getElementById('copy-room-id').addEventListener('click', () => {
        const roomId = document.getElementById('current-room-id').textContent;
        navigator.clipboard.writeText(multiplayerClient.roomId).then(() => {
            showNotification('房间 ID 已复制', 'success');
        });
    });

    // 开始游戏
    document.getElementById('start-game-btn').addEventListener('click', () => {
        const config = {
            rows: 10,
            cols: 10,
            mines: 20
        };

        multiplayerClient.startGame(config);
    });

    // 离开房间
    document.getElementById('leave-room-btn').addEventListener('click', () => {
        multiplayerClient.leaveRoom();
        showOnlineLobby();
    });

    // 退出游戏
    document.getElementById('exit-game').addEventListener('click', () => {
        if (multiplayerClient.isOnline) {
            multiplayerClient.leaveRoom();
            showOnlineLobby();
        } else {
            showMainMenu();
        }
    });
});

// 游戏相关函数（由 game.js 调用）
function startOnlineGame(gameState) {
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('mode-text').textContent = '⚔️ 对战模式';
    document.getElementById('difficulty-selector').style.display = 'none';
    document.getElementById('skills-bar').style.display = 'flex';
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('score-label').textContent = '🏆 分数';

    // 通知 game.js 开始联机游戏
    if (typeof initOnlineGame === 'function') {
        initOnlineGame(gameState);
    }
}

function handleCellRevealed(data) {
    if (typeof onCellRevealed === 'function') {
        onCellRevealed(data);
    }
}

function handleSkillUsed(data) {
    if (typeof onSkillUsed === 'function') {
        onSkillUsed(data);
    }
}

function handleGameEnd(data) {
    if (typeof onGameEnd === 'function') {
        onGameEnd(data);
    }
}
