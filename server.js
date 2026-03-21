const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let pythonClient = null;
const webClients = new Set();

app.use(express.static('public'));

// API để lấy thông tin kết nối
app.get('/api/connection-info', (req, res) => {
    res.json({
        connected: pythonClient !== null,
        wsUrl: `ws://${req.headers.host}`
    });
});

wss.on('connection', (ws, req) => {
    const userAgent = req.headers['user-agent'] || '';
    const isPython = userAgent.includes('Python') || userAgent.includes('websockets');
    
    if (isPython) {
        pythonClient = ws;
        console.log('✅ Python client connected');
        
        pythonClient.on('message', (data) => {
            webClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data.toString());
                }
            });
        });
        
        pythonClient.on('close', () => {
            console.log('❌ Python client disconnected');
            pythonClient = null;
        });
    } else {
        console.log('🌐 Web client connected');
        webClients.add(ws);
        
        ws.on('message', (data) => {
            if (pythonClient && pythonClient.readyState === WebSocket.OPEN) {
                pythonClient.send(data.toString());
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Python client not connected'
                }));
            }
        });
        
        ws.on('close', () => {
            console.log('🌐 Web client disconnected');
            webClients.delete(ws);
        });
        
        // Gửi trạng thái kết nối
        ws.send(JSON.stringify({
            type: 'status',
            connected: !!pythonClient
        }));
    }
});

// Broadcast status mỗi giây
setInterval(() => {
    const status = {
        type: 'status',
        connected: !!pythonClient
    };
    
    webClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(status));
        }
    });
}, 1000);

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`
    ═══════════════════════════════════════
    🚀 REMOTE DESKTOP SERVER
    ═══════════════════════════════════════
    📡 Local: http://localhost:${PORT}
    🔌 WebSocket: ws://localhost:${PORT}
    
    📝 INSTRUCTIONS:
    1. Run Python client: python remote_client.py
    2. Open browser: http://localhost:${PORT}
    ═══════════════════════════════════════
    `);
});