const { io } = require('socket.io-client');
const readline = require('readline');

// Connect to the server
const socket = io('http://localhost:3000');

// Colors 
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
};

console.log(`${colors.cyan}Real-time Order CLI Client${colors.reset}`);
console.log(`${colors.cyan}Connected to server: http://localhost:3000${colors.reset}`);
console.log('Waiting for order updates... (press Ctrl+C to exit)');

// Handle incoming order updates
socket.on('order-update', (payload) => {
    const op = payload.operation;
    const timestamp = new Date(payload.timestamp).toLocaleString();
    let color = colors.yellow;
    if (op === 'INSERT') color = colors.green;
    else if (op === 'DELETE') color = colors.red;
    else if (op === 'UPDATE') color = colors.blue;

    const record = payload.new || payload.old || {};
    const id = record.id || '?';
    const customer = record.customer_name || '-';
    const product = record.product_name || '-';
    const status = record.status || '-';

    console.log(`${color}[${timestamp}] ${op}${colors.reset} on order #${id} | ${customer} | ${product} | ${status}`);
});

// Connection events
socket.on('connect', () => {
    console.log(`${colors.green}✅ Socket connected${colors.reset}`);
});

socket.on('disconnect', () => {
    console.log(`${colors.red}❌ Socket disconnected${colors.reset}`);
});

socket.on('connect_error', (err) => {
    console.error(`${colors.red}Connection error: ${err.message}${colors.reset}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nExiting gracefully...');
    socket.disconnect();
    process.exit(0);
});
