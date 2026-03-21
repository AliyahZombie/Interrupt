import { Server, Socket } from 'socket.io';
import { Room } from './Room';
import { MapConfig } from './Map';

export class RoomManager {
  rooms: Map<string, Room> = new Map();
  playerRoom: Map<string, string> = new Map();

  playerData: Map<string, { score: number, credits: number }> = new Map();

  constructor(public io: Server) {
    // Create initial rooms
    this.createRoom('city', 'main-city-1');
    this.createRoom('arena', 'arena-1');
    this.createRoom('battlefield', 'battlefield-1');
  }

  createRoom(type: 'city' | 'arena' | 'battlefield', id: string) {
    const room = new Room(id, type, this.io, (socketId, targetType) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        this.joinRoomByType(socket, targetType);
      }
    });
    this.rooms.set(id, room);
    return room;
  }

  joinCity(socket: Socket) {
    // Find a city room that is not full
    let cityRoom = Array.from(this.rooms.values()).find(r => r.type === 'city' && r.players.size < r.maxPlayers);
    if (!cityRoom) {
      const newId = `main-city-${Date.now()}`;
      cityRoom = this.createRoom('city', newId);
    }
    this.joinRoom(socket, cityRoom.id);
  }

  joinRoomByType(socket: Socket, type: 'city' | 'arena' | 'battlefield') {
    if (type === 'city') {
      this.joinCity(socket);
      return;
    }
    
    // Find a room of this type that is not full
    let room = Array.from(this.rooms.values()).find(r => r.type === type && r.players.size < r.maxPlayers);
    if (!room) {
      const newId = `${type}-${Date.now()}`;
      room = this.createRoom(type, newId);
    }
    this.joinRoom(socket, room.id);
  }

  joinRoom(socket: Socket, roomId: string) {
    this.leaveRoom(socket);
    
    const room = this.rooms.get(roomId);
    if (room) {
      const data = this.playerData.get(socket.id) || { score: 0, credits: 0 };
      room.addPlayer(socket, data.score, data.credits);
      this.playerRoom.set(socket.id, room.id);
      socket.join(room.id);
      socket.emit('roomJoined', room.getState());
    }
  }

  leaveRoom(socket: Socket) {
    const roomId = this.playerRoom.get(socket.id);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const player = room.players.get(socket.id);
        if (player) {
          this.playerData.set(socket.id, { score: player.score, credits: player.credits });
        }
        room.removePlayer(socket.id);
        socket.leave(room.id);
      }
      this.playerRoom.delete(socket.id);
    }
  }

  handleInput(playerId: string, input: any) {
    const roomId = this.playerRoom.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.handleInput(playerId, input);
      }
    }
  }

  update(dt: number) {
    for (const room of this.rooms.values()) {
      room.update(dt);
    }
  }
}
