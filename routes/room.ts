// Import fetchEntities from the appropriate module
import { eq } from "drizzle-orm";
import { db } from "../database/database";
import { entity } from "../models/entity";
import { fetchEntities, updateEntity } from "./entity"; // Update this path to the actual location of fetchEntities

export default async function roomRoutes(app: any, io: any) {
  // Store entities for each room
  const roomData = new Map(); // key: roomName, value: { items: [] }

  io.on("connection", (socket) => {
    socket.on("joinRoom", (roomName) => {
      socket.join(roomName);
      if (!roomData.has(roomName)) {
        roomData.set(roomName, { entityIds: [], lastActive: Date.now() });
      }
      socket.emit("roomData", roomData.get(roomName));
    });

    socket.on("addEntity", async ({ roomName, entityId }) => {
      const room = roomData.get(roomName);
      if (room) {
        if (!room.entityIds.includes(entityId)) {
          room.entityIds.push(entityId);
          room.lastActive = Date.now();
        }

        const entities = await fetchEntities(room.entityIds); // fetch function from DB
        io.to(roomName).emit("roomData", {
          entityIds: room.entityIds,
          entities,
        });
      }
    });

    socket.on("updateEntity", async ({ roomName, entityId, updatedData }) => {
      try {
        const result = await updateEntity({
          entityId,
          data: updatedData,
          io, // use server-wide io to broadcast to campaigns
        });

        // Emit specifically to this room as well (optional)
        io.to(roomName).emit("entityUpdated", {
          entityId,
          updatedEntity: result,
        });
      } catch (err) {
        socket.emit("error", {
          message: err.message ?? "Failed to update entity",
          details: err.details ?? null,
        });
      }
    });

    socket.on("removeEntity", ({ roomName, itemId }) => {
      const room = roomData.get(roomName);
      if (room) {
        room.items = room.items.filter((i) => i.id !== itemId);
        io.to(roomName).emit("roomData", room);
      }
    });

    socket.on("chatMessage", ({ roomName, message, sender }) => {
      // Optionally sanitize or validate inputs here
      io.to(roomName).emit("chatMessage", {
        sender,
        message,
        timestamp: Date.now(),
      });
    });

    socket.on("disconnecting", () => {
      // Called before the socket actually disconnects
      for (const roomName of socket.rooms) {
        if (roomName !== socket.id) {
          // Delay cleanup to ensure disconnect completes
          setTimeout(() => {
            const room = io.sockets.adapter.rooms.get(roomName);
            if (!room || room.size === 0) {
              roomData.delete(roomName); // Clean up empty room
              console.log(`Deleted empty room: ${roomName}`);
            }
          }, 100); // small delay ensures socket has fully left room
        }
      }
    });
  });

  // Every minute, remove rooms that haven’t been updated in 10+ minutes
  setInterval(() => {
    const now = Date.now();
    for (const [roomName, data] of roomData.entries()) {
      if (data.lastActive && now - data.lastActive > 10 * 60 * 1000) {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (!room || room.size === 0) {
          roomData.delete(roomName);
          console.log(`Deleted inactive room: ${roomName}`);
        }
      }
    }
  }, 60 * 1000);
}
