// Import fetchEntities from the appropriate module
import { fetchEntities } from "./entity"; // Update this path to the actual location of fetchEntities

async function roomRoutes(app: any, io: any) {
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

    socket.on("removeItem", ({ roomName, itemId }) => {
      const room = roomData.get(roomName);
      if (room) {
        room.items = room.items.filter((i) => i.id !== itemId);
        io.to(roomName).emit("roomData", room);
      }
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
