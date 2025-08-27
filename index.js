const http = require('node:http');
const express = require('express');
const app = express();
const path = require('path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const PORT = 5001;
const server = http.createServer(app);
const io = new Server(server);

// Open database and start server
(async () => {
  const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database,
  });

  // Create table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_offset TEXT UNIQUE,
        content TEXT
    );
  `);

  // Serve static files
  app.use(express.static(path.resolve("./public")));

  // Route for index.html
  app.get("/", (req, res) => {
    return res.sendFile(path.resolve("./public/index.html"));
  });

  // Socket.io chat logic
  io.on('connection', async(socket) => {
    console.log('A user connected');

    socket.on('chat message', async (msg) => {
      let result;
      try {
        result = await db.run('INSERT INTO messages (content) VALUES (?)', msg);
      } catch (e) {
        console.error("DB error:", e.message);
        return;
      }
      io.emit('chat message', msg, result.lastID);
    });

    
  if (!socket.recovered) {
    // if the connection state recovery was not successful
    try {
      await db.each('SELECT id, content FROM messages WHERE id > ?',
        [socket.handshake.auth.serverOffset || 0],
        (_err, row) => {
          socket.emit('chat message', row.content, row.id);
        }
      )
    } catch (e) {
      // something went wrong
    }
  }
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`Server started at port: ${PORT}`);
  });

})();
