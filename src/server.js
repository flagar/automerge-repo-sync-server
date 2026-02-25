// @ts-check
import fs from "fs"
import express from "express"
import { WebSocketServer } from "ws"
import { Repo } from "@automerge/automerge-repo"
import { WebSocketServerAdapter } from "@automerge/automerge-repo-network-websocket"
import { NodeFSStorageAdapter } from "@automerge/automerge-repo-storage-nodefs"
import os from "os"
import { getActiveUsers, addActiveUser, removeActiveUser } from "./active_users.js"
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

    app.post("/active_users", express.json(), (req, res) => {
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
    });

    this.#server = app.listen(PORT, () => {
      console.log(`Listening on port ${PORT}`)
      this.#isReady = true
      this.#readyResolvers.forEach((resolve) => resolve(true))
    })

    this.#repo.storageId().then((storageId) => {
      console.log(`Storage ID: ${storageId}`)
    })

    this.#server.on("upgrade", (request, socket, head) => {
      this.#socket.handleUpgrade(request, socket, head, (socket) => {
        this.#socket.emit("connection", socket, request)
      })
    })
  }

  async ready() {
    if (this.#isReady) {
      return true
    }

    return new Promise((resolve) => {
      this.#readyResolvers.push(resolve)
    })
  }

  close() {
    this.#socket.close()
    this.#server.close()
  }
}
