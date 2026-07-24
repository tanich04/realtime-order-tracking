# Real-Time Order Updates System

A backend service that pushes database changes (`orders` table) to connected clients in real time, without polling. Built for the **Apt Backend Assignment**.

---

# What This Project Does

This project demonstrates an event-driven architecture using PostgreSQL's built-in pub/sub mechanism.

### Features

- Listens to **INSERT**, **UPDATE**, and **DELETE** operations on a PostgreSQL `orders` table.
- Uses PostgreSQL's native **LISTEN/NOTIFY** mechanism to capture database changes.
- Broadcasts changes instantly to all connected clients using **Socket.IO (WebSockets)**.
- Includes a browser dashboard with live order updates.
- Includes a CLI client for monitoring events directly from the terminal.
- No polling required, resulting in lower latency and reduced database load.

---

# Technology Choices

| Component | Technology | Why |
|-----------|------------|-----|
| **Database** | PostgreSQL 15 | Native LISTEN/NOTIFY pub/sub eliminates the need for external brokers while remaining reliable and lightweight. |
| **Backend** | Node.js + Express | Event-driven and non-blocking architecture, ideal for WebSocket applications. |
| **Real-Time Transport** | Socket.IO | Provides WebSocket communication with automatic fallback, reconnection, and room support. |
| **Containerization** | Docker & Docker Compose | Ensures reproducible environments and one-command setup. |

---

# System Workflow

```text
                 WebSocket (Socket.IO)

+------------+  <----------------------->  +--------------------+
|   Client   |                             |   Node.js Server   |
+------------+                             +--------------------+
                                                  |
                                                  |
                                           LISTEN orders_changed
                                                  |
                                                  ▼
                                           +----------------+
                                           |  PostgreSQL    |
                                           +----------------+
                                                  |
                                   Trigger executes after
                               INSERT / UPDATE / DELETE
                                                  |
                                      pg_notify('orders_changed')
```

### Workflow

1. A client connects to the Node.js server through Socket.IO.
2. A database mutation occurs (via REST API or direct SQL).
3. PostgreSQL executes a trigger after the change.
4. The trigger constructs a JSON payload and calls `pg_notify()`.
5. The Node.js listener receives the notification.
6. The server broadcasts the event to every connected Socket.IO client.
7. Browser dashboard and CLI clients update instantly.

---

# Project Structure

```text
apt-realtime-assignment/
│
├── client/
│   └── cli.js
│
├── db/
│   ├── init.sql
│
├── public/
│   ├── index.html
│
├── routes/
│   └── orders.js
│
├── server.js
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

# Setup & Running

## Prerequisites

- Docker
- Docker Compose

(Optional)

- Node.js (for running the CLI client outside Docker)

---

## 1. Clone the Repository

```bash
git clone <your-repository-url>
cd apt-realtime-assignment
```

---

## 2. Start the Application

```bash
docker-compose up --build
```

This launches:

- PostgreSQL database
- Orders table
- Trigger & notification functions
- Node.js backend
- Browser dashboard

Server runs at:

```
http://localhost:3000
```

---

## 3. Open Browser Dashboard

Visit

```
http://localhost:3000
```

You'll see the live orders table updating automatically.

---

## 4. Run the CLI Client (Optional)

```bash
npm install socket.io-client

node client/cli.js
```

The terminal will immediately start receiving database events.

---

## 5. Test Using curl

### Create an Order

```bash
curl -X POST http://localhost:3000/api/orders \
-H "Content-Type: application/json" \
-d '{
  "customer_name":"Alice",
  "product_name":"Laptop",
  "status":"pending"
}'
```

---

### Update an Order

```bash
curl -X PUT http://localhost:3000/api/orders/1 \
-H "Content-Type: application/json" \
-d '{
  "status":"shipped"
}'
```

---

### Delete an Order

```bash
curl -X DELETE http://localhost:3000/api/orders/1
```

Every connected browser and CLI client will receive updates instantly.

---

# REST API

## GET /api/orders

Returns all orders.

### Response

```json
[
  {
    "id": 1,
    "customer_name": "Alice",
    "product_name": "Laptop",
    "status": "pending",
    "updated_at": "2026-07-24T10:00:00.000Z"
  }
]
```

---

## POST /api/orders

Creates a new order.

### Request

```json
{
  "customer_name": "Bob",
  "product_name": "Monitor",
  "status": "pending"
}
```

### Response

```json
{
  "id": 5,
  "customer_name": "Bob",
  "product_name": "Monitor",
  "status": "pending",
  "updated_at": "2026-07-24T10:00:00.000Z"
}
```

---

## PUT /api/orders/:id

Updates an existing order.

### Request

```json
{
  "status": "shipped"
}
```

### Response

```json
{
  "id": 5,
  "customer_name": "Bob",
  "product_name": "Monitor",
  "status": "shipped",
  "updated_at": "2026-07-24T10:15:00.000Z"
}
```

---

## DELETE /api/orders/:id

Deletes an order.

### Response

```json
{
  "message": "Order deleted successfully",
  "deleted": {
    "id": 5,
    "customer_name": "Bob",
    "product_name": "Monitor",
    "status": "shipped"
  }
}
```

---

# Why This Architecture?

This architecture was intentionally chosen because it keeps the system simple while still providing real-time updates.

### Advantages

- ✅ No polling
- ✅ Low latency
- ✅ Minimal infrastructure
- ✅ Small codebase
- ✅ Efficient use of PostgreSQL
- ✅ Easy to understand and maintain

Unlike systems that introduce Kafka or Redis immediately, PostgreSQL already provides a lightweight pub/sub mechanism through LISTEN/NOTIFY, making it ideal for assignments and moderate production workloads.

---

# Scalability & Future Evolution

## Current System Limits

Although PostgreSQL LISTEN/NOTIFY is excellent for lightweight real-time systems, it has limitations.

Current constraints include:

- NOTIFY isn't intended for extremely high throughput (>1000 events/sec)
- Single Node.js instance
- Offline clients miss updates
- Notification payload limited to 8000 bytes

These limitations are acceptable for the assignment scope.

---

# Highly Scalable Alternative

## Debezium + Kafka

```text
               PostgreSQL WAL
                      │
                      ▼
                +------------+
                | Debezium   |
                +------------+
                      │
                      ▼
                 +----------+
                 | Kafka    |
                 +----------+
                      │
                      ▼
             +----------------+
             | Node.js Server |
             +----------------+
                      │
                Socket.IO
                      │
                      ▼
                  Clients
```

### Flow

1. PostgreSQL writes every change to its WAL.
2. Debezium reads the WAL.
3. Debezium publishes events into Kafka.
4. Node.js consumes Kafka messages.
5. Events are pushed to clients through WebSockets.

---

## Advantages

- Millions of events/sec
- Persistent event storage
- Event replay
- Horizontal scaling
- Exactly-once delivery
- Multiple independent consumers

---

## Why Not Use Kafka Here?

While Kafka is ideal for large-scale production systems, it introduces significant operational complexity.

It requires:

- Kafka brokers
- Debezium connectors
- Kafka configuration
- Additional infrastructure

For this assignment, PostgreSQL LISTEN/NOTIFY keeps the focus on the core real-time logic rather than infrastructure management.

---

# Future Improvements

| Improvement | Implementation |
|------------|----------------|
| Horizontal scaling | Socket.IO Redis Adapter |
| Offline replay | Store events in an `order_events` table |
| Authentication | JWT authentication for REST APIs and WebSockets |
| Client filtering | Socket.IO Rooms |
| Kafka migration | Replace LISTEN/NOTIFY with Kafka Consumer |

---

# Known Limitations

| Limitation | Future Solution |
|------------|-----------------|
| No authentication | JWT Authentication |
| Offline clients miss updates | Event log + replay API |
| Single Node instance | Redis Adapter |
| NOTIFY payload limited to 8000 bytes | Send only event IDs and fetch data through REST |
| No monitoring | Winston + Prometheus + Grafana |

---

# Conclusion

This project demonstrates an efficient event-driven architecture using PostgreSQL LISTEN/NOTIFY and Socket.IO to deliver real-time order updates without polling.

The design keeps infrastructure simple while remaining scalable enough for moderate workloads and provides a clear migration path toward enterprise-grade architectures using Debezium and Kafka when needed.

Overall, it showcases:

- Event-driven backend design
- PostgreSQL triggers
- LISTEN/NOTIFY pub/sub
- WebSocket communication
- Dockerized deployment
- REST API development
- Real-time frontend synchronization
---