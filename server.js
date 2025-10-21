const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ server });

// 游戏房间管理
const rooms = new Map();
const players = new Map();

class Room {
    constructor(id, hostId) {
        this.id = id;
        this.hostId = hostId;
        this.players = [];
        this.gameState = null;
        this.maxPlayers = 4;
        this.status = 'waiting'; // waiting, playing, finished
    }

    addPlayer(playerId, playerName) {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }

        this.players.push({
            id: playerId,
            name: playerName,
            score: 0,
            revealed: 0,
            skills: {
                freeze: 2,    // 冰冻技能次数
                reveal: 2,    // 透视技能次数
                bomb: 1,      // 炸弹技能次数
                shield: 1,    // 护盾技能次数
                swap: 1       // 交换技能次数
            },
            frozen: false,
            frozenUntil: 0,
            shielded: false
        });

        return true;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }

    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    }

    startGame(config) {
        this.status = 'playing';
        this.gameState = {
            board: [],
            revealed: [],
            config: config,
            startTime: Date.now()
        };

        // 初始化棋盘
        const { rows, cols, mines } = config;
        for (let i = 0; i < rows; i++) {
            this.gameState.board[i] = [];
            this.gameState.revealed[i] = [];
            for (let j = 0; j < cols; j++) {
                this.gameState.board[i][j] = 0;
                this.gameState.revealed[i][j] = null; // null 表示未揭示，playerId 表示由哪个玩家揭示
            }
        }

        // 随机放置地雷
        let minesPlaced = 0;
        while (minesPlaced < mines) {
            const row = Math.floor(Math.random() * rows);
            const col = Math.floor(Math.random() * cols);

            if (this.gameState.board[row][col] !== -1) {
                this.gameState.board[row][col] = -1;
                minesPlaced++;
            }
        }

        // 计算数字
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (this.gameState.board[i][j] !== -1) {
                    let count = 0;
                    for (let di = -1; di <= 1; di++) {
                        for (let dj = -1; dj <= 1; dj++) {
                            const ni = i + di;
                            const nj = j + dj;
                            if (ni >= 0 && ni < rows && nj >= 0 && nj < cols) {
                                if (this.gameState.board[ni][nj] === -1) {
                                    count++;
                                }
                            }
                        }
                    }
                    this.gameState.board[i][j] = count;
                }
            }
        }
    }

    revealCell(playerId, row, col) {
        if (this.status !== 'playing') return null;

        const player = this.getPlayer(playerId);
        if (!player) return null;

        // 检查是否被冰冻
        if (player.frozen && Date.now() < player.frozenUntil) {
            return { type: 'frozen' };
        }
        player.frozen = false;

        const { rows, cols } = this.gameState.config;
        if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
        if (this.gameState.revealed[row][col] !== null) return null;

        const value = this.gameState.board[row][col];
        this.gameState.revealed[row][col] = playerId;

        // 如果是地雷且有护盾
        if (value === -1 && player.shielded) {
            player.shielded = false;
            return {
                type: 'shielded',
                row,
                col
            };
        }

        // 如果是地雷
        if (value === -1) {
            player.score = Math.max(0, player.score - 50);
            return {
                type: 'mine',
                row,
                col,
                value
            };
        }

        // 得分
        const points = value === 0 ? 5 : value * 2;
        player.score += points;
        player.revealed++;

        const revealed = [[row, col, value]];

        // 如果是 0，自动展开
        if (value === 0) {
            const toReveal = [[row, col]];
            const visited = new Set();
            visited.add(`${row},${col}`);

            while (toReveal.length > 0) {
                const [r, c] = toReveal.shift();

                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        const nr = r + di;
                        const nc = c + dj;
                        const key = `${nr},${nc}`;

                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                            !visited.has(key) &&
                            this.gameState.revealed[nr][nc] === null) {

                            visited.add(key);
                            this.gameState.revealed[nr][nc] = playerId;
                            const nv = this.gameState.board[nr][nc];

                            if (nv !== -1) {
                                revealed.push([nr, nc, nv]);
                                player.score += (nv === 0 ? 5 : nv * 2);
                                player.revealed++;

                                if (nv === 0) {
                                    toReveal.push([nr, nc]);
                                }
                            }
                        }
                    }
                }
            }
        }

        return {
            type: 'success',
            revealed,
            score: player.score
        };
    }

    useSkill(playerId, skillName, data) {
        const player = this.getPlayer(playerId);
        if (!player || !player.skills[skillName] || player.skills[skillName] <= 0) {
            return { success: false, message: '技能不可用' };
        }

        player.skills[skillName]--;

        switch (skillName) {
            case 'freeze':
                // 冰冻其他玩家 3 秒
                this.players.forEach(p => {
                    if (p.id !== playerId) {
                        p.frozen = true;
                        p.frozenUntil = Date.now() + 3000;
                    }
                });
                return { success: true, type: 'freeze', duration: 3000 };

            case 'reveal':
                // 透视 3x3 区域
                const { row, col } = data;
                const revealed = [];
                for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                        const nr = row + di;
                        const nc = col + dj;
                        const { rows, cols } = this.gameState.config;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                            revealed.push([nr, nc, this.gameState.board[nr][nc]]);
                        }
                    }
                }
                return { success: true, type: 'reveal', revealed };

            case 'bomb':
                // 炸开 5x5 区域
                const br = data.row;
                const bc = data.col;
                const bombRevealed = [];
                for (let di = -2; di <= 2; di++) {
                    for (let dj = -2; dj <= 2; dj++) {
                        const nr = br + di;
                        const nc = bc + dj;
                        const { rows, cols } = this.gameState.config;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
                            this.gameState.revealed[nr][nc] === null) {

                            this.gameState.revealed[nr][nc] = playerId;
                            const value = this.gameState.board[nr][nc];

                            if (value !== -1) {
                                bombRevealed.push([nr, nc, value]);
                                player.score += (value === 0 ? 5 : value * 2);
                                player.revealed++;
                            }
                        }
                    }
                }
                return { success: true, type: 'bomb', revealed: bombRevealed, row: br, col: bc };

            case 'shield':
                // 护盾，下次踩雷不扣分
                player.shielded = true;
                return { success: true, type: 'shield' };

            case 'swap':
                // 交换两个未揭示的格子
                const { row1, col1, row2, col2 } = data;
                const temp = this.gameState.board[row1][col1];
                this.gameState.board[row1][col1] = this.gameState.board[row2][col2];
                this.gameState.board[row2][col2] = temp;
                return { success: true, type: 'swap', row1, col1, row2, col2 };

            default:
                return { success: false, message: '未知技能' };
        }
    }

    checkGameEnd() {
        if (this.status !== 'playing') return false;

        const { rows, cols, mines } = this.gameState.config;
        let revealedCount = 0;

        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                if (this.gameState.revealed[i][j] !== null) {
                    revealedCount++;
                }
            }
        }

        if (revealedCount >= rows * cols - mines) {
            this.status = 'finished';
            return true;
        }

        return false;
    }

    getLeaderboard() {
        return this.players
            .sort((a, b) => b.score - a.score)
            .map((p, index) => ({
                rank: index + 1,
                name: p.name,
                score: p.score,
                revealed: p.revealed
            }));
    }
}

// WebSocket 连接处理
wss.on('connection', (ws) => {
    const playerId = generateId();
    console.log(`新玩家连接: ${playerId}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, playerId, data);
        } catch (error) {
            console.error('消息解析错误:', error);
        }
    });

    ws.on('close', () => {
        console.log(`玩家断开: ${playerId}`);
        handleDisconnect(playerId);
    });

    players.set(playerId, { ws, name: '', roomId: null });

    // 发送欢迎消息
    sendToPlayer(playerId, {
        type: 'connected',
        playerId
    });
});

function handleMessage(ws, playerId, data) {
    const player = players.get(playerId);
    if (!player) return;

    switch (data.type) {
        case 'setName':
            player.name = data.name;
            break;

        case 'createRoom':
            const roomId = generateId();
            const room = new Room(roomId, playerId);
            room.addPlayer(playerId, player.name || '玩家' + playerId.substring(0, 4));
            rooms.set(roomId, room);
            player.roomId = roomId;

            sendToPlayer(playerId, {
                type: 'roomCreated',
                roomId,
                room: getRoomInfo(room)
            });
            break;

        case 'joinRoom':
            const targetRoom = rooms.get(data.roomId);
            if (!targetRoom) {
                sendToPlayer(playerId, {
                    type: 'error',
                    message: '房间不存在'
                });
                return;
            }

            if (targetRoom.status !== 'waiting') {
                sendToPlayer(playerId, {
                    type: 'error',
                    message: '游戏已开始'
                });
                return;
            }

            if (!targetRoom.addPlayer(playerId, player.name || '玩家' + playerId.substring(0, 4))) {
                sendToPlayer(playerId, {
                    type: 'error',
                    message: '房间已满'
                });
                return;
            }

            player.roomId = data.roomId;

            broadcastToRoom(data.roomId, {
                type: 'roomUpdated',
                room: getRoomInfo(targetRoom)
            });
            break;

        case 'startGame':
            const gameRoom = rooms.get(player.roomId);
            if (!gameRoom || gameRoom.hostId !== playerId) {
                sendToPlayer(playerId, {
                    type: 'error',
                    message: '只有房主可以开始游戏'
                });
                return;
            }

            gameRoom.startGame(data.config);

            broadcastToRoom(player.roomId, {
                type: 'gameStarted',
                gameState: getPublicGameState(gameRoom)
            });
            break;

        case 'revealCell':
            const room = rooms.get(player.roomId);
            if (!room) return;

            const result = room.revealCell(playerId, data.row, data.col);
            if (result) {
                broadcastToRoom(player.roomId, {
                    type: 'cellRevealed',
                    playerId,
                    result,
                    leaderboard: room.getLeaderboard()
                });

                if (room.checkGameEnd()) {
                    broadcastToRoom(player.roomId, {
                        type: 'gameEnded',
                        leaderboard: room.getLeaderboard()
                    });
                }
            }
            break;

        case 'useSkill':
            const skillRoom = rooms.get(player.roomId);
            if (!skillRoom) return;

            const skillResult = skillRoom.useSkill(playerId, data.skillName, data.data);

            broadcastToRoom(player.roomId, {
                type: 'skillUsed',
                playerId,
                skillName: data.skillName,
                result: skillResult,
                leaderboard: skillRoom.getLeaderboard()
            });
            break;

        case 'getRooms':
            const roomList = Array.from(rooms.values())
                .filter(r => r.status === 'waiting')
                .map(r => ({
                    id: r.id,
                    players: r.players.length,
                    maxPlayers: r.maxPlayers
                }));

            sendToPlayer(playerId, {
                type: 'roomList',
                rooms: roomList
            });
            break;
    }
}

function handleDisconnect(playerId) {
    const player = players.get(playerId);
    if (!player) return;

    if (player.roomId) {
        const room = rooms.get(player.roomId);
        if (room) {
            room.removePlayer(playerId);

            if (room.players.length === 0) {
                rooms.delete(player.roomId);
            } else {
                broadcastToRoom(player.roomId, {
                    type: 'roomUpdated',
                    room: getRoomInfo(room)
                });
            }
        }
    }

    players.delete(playerId);
}

function sendToPlayer(playerId, data) {
    const player = players.get(playerId);
    if (player && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(data));
    }
}

function broadcastToRoom(roomId, data) {
    const room = rooms.get(roomId);
    if (!room) return;

    room.players.forEach(p => {
        sendToPlayer(p.id, data);
    });
}

function getRoomInfo(room) {
    return {
        id: room.id,
        hostId: room.hostId,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            revealed: p.revealed,
            skills: p.skills,
            frozen: p.frozen,
            shielded: p.shielded
        })),
        maxPlayers: room.maxPlayers,
        status: room.status
    };
}

function getPublicGameState(room) {
    return {
        config: room.gameState.config,
        revealed: room.gameState.revealed,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            skills: p.skills
        }))
    };
}

function generateId() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`WebSocket 服务器运行在 ws://localhost:${PORT}`);
});
