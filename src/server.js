// @ts-check
import fs from "fs"
import express from "express"
import { WebSocketServer } from "ws"
import { Repo } from "@automerge/automerge-repo"
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket"
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs"
import os from "os"
import { handle as activeUsersHandle, removeActiveUserTab } from "./active_users.js"
import { handle as locksHandle, getLocks } from "./locks.js"
import { handle as sectionsHandle } from "./sections.js"
import { handle as notificationsHandle } from "./notifications.js"
import { handle as editionsHandle } from "./editions.js"
import cors from 'cors';

// Configura CORS
/*const corsOptions = {
  origin: ['*'], //'http://localhost:3000', 'https://tuodominio.com'], // Aggiungi i tuoi domini
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};*/

export class Server {
  /** @type WebSocketServer */
  #socket

  /** @type ReturnType<import("express").Express["listen"]> */
  #server

  /** @type {((value: any) => void)[]} */
  #readyResolvers = []

  #isReady = false

  /** @type Repo */
  #repo

  constructor() {
    const dir =
      process.env.DATA_DIR !== undefined ? process.env.DATA_DIR : ".amrg"
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }

    var hostname = os.hostname()

    this.#socket = new WebSocketServer({ noServer: true })

    const PORT =
      process.env.PORT !== undefined ? parseInt(process.env.PORT) : 3030
    const app = express()
    app.use(express.static("public"));
    //app.use(cors(corsOptions));
    app.use(cors()); // Allow all origins for simplicity
    // Referrer-Policy middleware
    app.use((req, res, next) => {
      res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
      next();
    });

    const config = {
      network: [new WebSocketServerAdapter(this.#socket, 60000)],
      storage: new NodeFSStorageAdapter(dir),
      /** @ts-ignore @type {(import("@automerge/automerge-repo").PeerId)}  */
      peerId: `storage-server-${hostname}`,
      // Since this is a server, we don't share generously — meaning we only sync documents they already
      // know about and can ask for by ID.
      sharePolicy: async () => false,
    }
    this.#repo = new Repo(config)

    app.get("/", (req, res) => {
      res.send(`👍 @automerge/automerge-repo-sync-server is running`)
    });

    app.get("/hostname", async (req, res) => {
      // get public ip address of the server using a curl to ipinfo.io
      let ip_address = '';
      try {
        ip_address = (await fetch('https://ipinfo.io/ip').then(r => r.text())).trim();
      } catch (err) {
        console.error('Error getting public IP address:', err);
      }
      //console.log(`Received request for hostname, responding with: ${hostname} (IP: ${ip_address})`);
      res.send('hostname: ' + hostname + ' (IP: ' + ip_address + ')');
    });

    /*app.post("/active_users", express.json(), (req, res) => {
      const user = req.body;
      if (user && user.id) {
        addActiveUser(user);
        res.status(200).json({ message: "User added to active users list" });
      } else {
        res.status(400).json({ message: "Invalid user data" });
      }
    });

    app.delete("/active_users/:id", (req, res) => {
      const userId = req.params.id;
      if (userId) {
        removeActiveUser(userId);
        res.status(200).json({ message: "User removed from active users list" });
      } else {
        res.status(400).json({ message: "Invalid user ID" });
      }
    });

    app.get("/active_users", (req, res) => {
      const activeUsers = getActiveUsers();
      res.status(200).json(activeUsers);
    });*/

    this.#server = app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`)
      this.#isReady = true
      this.#readyResolvers.forEach((resolve) => resolve(true))
    })

    this.#repo.storageId().then((storageId) => {
      console.log(`Storage ID: ${storageId}`)
    })

    this.hpews = new WebSocketServer({ noServer: true });

    this.#server.on("upgrade", (request, socket, head) => {
      const { url } = request;
      const basic_url = url.replace(/\?.+/, '');
      if (url == "/automerge") {
        this.#socket.handleUpgrade(request, socket, head, (socket) => {
          this.#socket.emit("connection", socket, request);
        });
      } else if (basic_url == "/ws") {
        this.hpews.handleUpgrade(request, socket, head, (socket) => {
          if (url) {
            console.log('Received upgrade request for URL: ', url);
            const raw_b64data = new URL(url, 'http://x').searchParams.get('client_data');
            if (raw_b64data) {
              const b64_data = raw_b64data.replace(/-/g, '+').replace(/_/g, '/');
              if (b64_data) {
                const client_data = JSON.parse(Buffer.from(b64_data, 'base64').toString());
                console.log('Received client data: ', client_data);
                socket.client_data = client_data;
              } else {
                console.warn('No client data found in the URL query parameters');
              }
            } else {
              console.warn('No client_data query parameter found in the URL');
            }
          } else {
            console.warn('No URL found in the upgrade request');
          }
          this.hpews.emit("connection", socket, request);
        });
      }
    });

    this.hpews.on("connection", /** @param {import('ws').WebSocket} ws */(ws) => {
      ws.broadcast = (msg_to_broadcast) => {
        console.log('Broadcasting message to clients: ', msg_to_broadcast);
        //console.log(this.hpews.clients);
        // Broadcast the message to all other connected clients
        let i = 0;
        this.hpews.clients.forEach((client) => {
          //console.log('Checking client for broadcast: ', client);
          if (client.readyState === 1) { // 1 means OPEN
            console.log('Sending message to client ' + (i++));
            client.send(JSON.stringify(msg_to_broadcast));
          }
        });
      };
      console.log('Client connected to HPE WebSocket server');
      ws.send(JSON.stringify({ context: 'welcome', data: 'Welcome to the HPE WebSocket server!' }));
      //let active_users = getActiveUsers();
      //ws.send(JSON.stringify({ context: 'active_users', data: active_users }));
      let locks = getLocks();
      ws.send(JSON.stringify({ context: 'locks', data: locks }));

      ws.addEventListener('message', (event) => {
        let msg;
        const raw_msg = String(event.data);
        console.log('Received message from client:', raw_msg);
        try {
          msg = JSON.parse(raw_msg);
        } catch (e) {
          console.error('Error parsing message:', e);
          console.error('JSON parsing error for message:', raw_msg);
        }
        if (msg) {
          let msg_to_broadcast;
          if (msg.context == 'active_users') {
            msg_to_broadcast = activeUsersHandle(msg);
          } else if (msg.context == 'locks') {
            msg_to_broadcast = locksHandle(msg);
          } else if (msg.context == 'sections') {
            msg_to_broadcast = sectionsHandle(msg);
          } else if (msg.context == 'notifications') {
            msg_to_broadcast = notificationsHandle(msg);
          } else if (msg.context == 'editions') {
            msg_to_broadcast = editionsHandle(msg);
          }
          if (msg_to_broadcast) {
            ws.broadcast(msg_to_broadcast);
          }
        }
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });

      ws.addEventListener('close', () => {
        console.log('Client disconnected from HPE WebSocket server', ws.client_data);
        if (ws.client_data && ws.client_data.tab_id) {
          removeActiveUserTab(ws.client_data.tab_id);
        }
      });
    });

    this.ready = () => {
      if (this.#isReady) {
        return true
      }

      return new Promise((resolve) => {
        this.#readyResolvers.push(resolve)
      })
    }

    this.close = () => {
      this.#socket.close()
      this.#server.close()
    }
  }
}

