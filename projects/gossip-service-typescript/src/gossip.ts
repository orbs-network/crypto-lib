import * as WebSocket from "ws";
import { topology, topologyPeers } from "orbs-common-library";
import { CryptoUtils } from "../../common-library-typescript";

function stringToBuffer(str: string): Buffer {
  const buf = Buffer.alloc(1 + str.length);
  buf.writeUInt8(Math.min(str.length, 255), 0);
  buf.write(str, 1, 255, "utf8");
  return buf;
}

const crypto = new CryptoUtils(undefined, undefined);


export default class Gossip {
  localAddress: string = crypto.whoAmI();
  server: WebSocket.Server;
  clients: Map<string, WebSocket> = new Map();
  listeners: Map<string, any> = new Map();
  peers: any = topologyPeers(topology.peers);

  constructor(port: number) {
    this.server = new WebSocket.Server({ port });
    this.server.on("connection", (ws) => {
      this.prepareConnection(ws);
    });
  }

  helloMessage(): Buffer {
    return stringToBuffer(this.localAddress);
  }

  prepareConnection(ws: WebSocket) {
    let remoteAddress: string = undefined;

    ws.on("terminate", () => {
      if (remoteAddress) {
        console.log("*** remote", remoteAddress, "disconnected.");
        this.clients.delete(remoteAddress);
      }
    });

    ws.on("message", (message: Buffer) => {
      let offset = 0;

      function readString(buf: Buffer): string {
        const len: number = buf.readUInt8(offset);
        const str: string = buf.toString("utf8", offset + 1, offset + 1 + len);
        offset += 1 + len;
        return str;
      }

      const sender = readString(message);
      if (offset === message.length) {
        // 'hello' message
        remoteAddress = sender;
        this.clients.set(sender, ws);
        console.log("Registering connection", this.localAddress, "->", sender);
        return;
      }
      const [recipient, broadcastGroup, objectType, objectRaw] = [readString(message), readString(message), readString(message), message.slice(offset)];
      if (recipient !== "" && recipient !== this.localAddress) {
        return;
      }
      if (! this.listeners.has(broadcastGroup)) {
        const peer = this.peers[broadcastGroup];
        if (! peer) {
          throw new Error(`Invalid broadcast group: [${broadcastGroup}]`);
        }
        this.listeners.set(broadcastGroup, peer);
      }
      this.listeners.get(broadcastGroup).gossipMessageReceived({FromAddress: sender.toString(), BroadcastGroup: broadcastGroup, MessageType: objectType, Buffer: objectRaw});
    });
    ws.send(this.helloMessage());
  }


  connect(peers: string[]) {
    for (const peer of peers) {
      const ws: WebSocket = new WebSocket(peer);
      ws.addEventListener("open", () => { this.prepareConnection(ws); });
    }
  }


  broadcastMessage(broadcastGroup: string, objectType: string, object: Buffer, immediate: boolean) {
    this.clients.forEach((client: WebSocket, address: string) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(Buffer.concat([stringToBuffer(this.localAddress), stringToBuffer(""), stringToBuffer(broadcastGroup), stringToBuffer(objectType), object]));
      }
    });
  }

  unicastMessage(recipientAddress: string, broadcastGroup: string, objectType: string, object: Buffer, immediate: boolean) {
    const remote: WebSocket = this.clients.get(recipientAddress);
    const message: Buffer = Buffer.concat([stringToBuffer(this.localAddress), stringToBuffer(recipientAddress), stringToBuffer(broadcastGroup), stringToBuffer(objectType), object]);
    if (remote) {
      remote.send(message);
    }
    else {
      this.clients.forEach((remote: WebSocket) => {
        remote.send(message);
      });
    }
  }

}
