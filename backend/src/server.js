require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Client } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------- PostgreSQL Listener ----------
const pgListener = new Client({
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASSWORD || 'secret',
    database: process.env.DB_DATABASE || 'orderdb',
});

pgListener.connect()
    .then(() => {
        console.log('Connected to PostgreSQL as listener');
        return pgListener.query('LISTEN orders_changed');
    })
    .then(() => {
        console.log('Listening for notifications on channel "orders_changed"');
    })
    .catch(err => {
        console.error('❌ PostgreSQL listener error:', err);
        process.exit(1);
    });

// When a notification arrives, broadcast it to all connected Socket.IO clients
pgListener.on('notification', (msg) => {
    try {
        const payload = JSON.parse(msg.payload);
        console.log(`Received notification: ${payload.operation} on order #${payload.new?.id || payload.old?.id}`);
        io.emit('order-update', payload);
    } catch (err) {
        console.error('Error parsing notification payload:', err);
    }
});

const queryClient = pgListener;

// GET all orders
app.get('/api/orders', async (req, res) => {
    try {
        const result = await queryClient.query('SELECT * FROM orders ORDER BY id');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/orders - create a new order
app.post('/api/orders', async (req, res) => {
    const { customer_name, product_name, status } = req.body;
    if (!customer_name || !product_name) {
        return res.status(400).json({ error: 'customer_name and product_name are required' });
    }
    try {
        const result = await queryClient.query(
            'INSERT INTO orders (customer_name, product_name, status) VALUES ($1, $2, $3) RETURNING *',
            [customer_name, product_name, status || 'pending']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/orders/:id - update an order
app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { customer_name, product_name, status } = req.body;
    try {
        const result = await queryClient.query(
            'UPDATE orders SET customer_name = COALESCE($1, customer_name), product_name = COALESCE($2, product_name), status = COALESCE($3, status), updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [customer_name, product_name, status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/orders/:id - delete an order
app.delete('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await queryClient.query(
            'DELETE FROM orders WHERE id = $1 RETURNING *',
            [id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ message: 'Order deleted', deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- Socket.IO connection handling ----------
io.on('connection', (socket) => {
    console.log(`🟢 Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        console.log(`🔴 Client disconnected: ${socket.id}`);
    });
});

// ---------- Start Server ----------
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
