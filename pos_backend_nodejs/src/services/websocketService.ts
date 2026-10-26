import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import { JwtUtils } from '../utils/jwt';

export interface WebSocketClient {
  ws: WebSocket;
  userId: string;
  storeId: string;
  isAlive: boolean;
}

export class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocketClient> = new Map();
  private heartbeatInterval: NodeJS.Timeout;

  constructor(server: any) {
    this.wss = new WebSocket.Server({ server, path: '/ws/pos/1' });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      this.handleConnection(ws, request);
    });

    // Heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocket) => {
        const client = this.findClientByWebSocket(ws);
        if (client) {
          if (!client.isAlive) {
            this.removeClient(client);
            return ws.terminate();
          }

          client.isAlive = false;
          ws.ping();
        }
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(this.heartbeatInterval);
    });
  }

  private handleConnection(ws: WebSocket, request: IncomingMessage) {
    console.log('New WebSocket connection attempt');

    // Extract token from query parameters or headers
    const url = new URL(request.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    try {
      // Verify token
      const decoded = JwtUtils.verifyToken(token);

      const client: WebSocketClient = {
        ws,
        userId: decoded.id,
        storeId: decoded.storeId,
        isAlive: true
      };

      this.clients.set(decoded.id, client);
      console.log(`WebSocket client connected: ${decoded.id} for store: ${decoded.storeId}`);

      ws.on('message', (message: WebSocket.Data) => {
        this.handleMessage(client, message);
      });

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.on('close', () => {
        this.removeClient(client);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(client);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection_established',
        data: {
          userId: decoded.id,
          storeId: decoded.storeId,
          timestamp: new Date().toISOString()
        }
      }));

    } catch (error) {
      console.error('WebSocket authentication error:', error);
      ws.close(1008, 'Invalid token');
    }
  }

  private handleMessage(client: WebSocketClient, message: WebSocket.Data) {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'ping':
          client.ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'subscribe_to_store':
          // Client wants to subscribe to store updates
          client.ws.send(JSON.stringify({
            type: 'subscribed',
            data: { storeId: client.storeId }
          }));
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private findClientByWebSocket(ws: WebSocket): WebSocketClient | undefined {
    for (const client of this.clients.values()) {
      if (client.ws === ws) {
        return client;
      }
    }
    return undefined;
  }

  private removeClient(client: WebSocketClient) {
    this.clients.delete(client.userId);
    console.log(`WebSocket client disconnected: ${client.userId}`);
  }

  // Send message to all clients in a specific store
  public broadcastToStore(storeId: string, message: any) {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.storeId === storeId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  // Send message to a specific user
  public sendToUser(userId: string, message: any) {
    const client = this.clients.get(userId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  // Send notification about new sale
  public notifyNewSale(storeId: string, saleData: any) {
    this.broadcastToStore(storeId, {
      type: 'new_sale',
      data: saleData,
      timestamp: new Date().toISOString()
    });
  }

  // Send notification about inventory update
  public notifyInventoryUpdate(storeId: string, inventoryData: any) {
    this.broadcastToStore(storeId, {
      type: 'inventory_update',
      data: inventoryData,
      timestamp: new Date().toISOString()
    });
  }

  // Send notification about low stock
  public notifyLowStock(storeId: string, productData: any) {
    this.broadcastToStore(storeId, {
      type: 'low_stock_alert',
      data: productData,
      timestamp: new Date().toISOString()
    });
  }

  // Get connected clients count
  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  // Get connected clients for a store
  public getConnectedClientsForStore(storeId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.storeId === storeId) {
        count++;
      }
    });
    return count;
  }
}