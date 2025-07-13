// server.js
import WebSocket, { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });
wss.on("connection", (ws) => {
  ws.on("message", (msg) => {
    for (const client of wss.clients) {
      if (client !== ws && client.readyState === WebSocket.OPEN)
        client.send(msg);
    }
  });
});

console.log("WebSocket server ready on ws://localhost:8080");
