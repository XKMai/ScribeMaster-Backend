import { db } from "../database/database";
import { fetchEntities, updateEntity } from "./entity"; // Ensure this path is correct

export default async function roomRoutes(app: any, io: any) {
  // Store entities for each room
  const roomData = new Map<
    string,
    {
      entityIds: string[];
      entities: any[];
      lastActive: number;
    }
  >();

  io.on("connection", (socket) => {
    socket.on("joinRoom", async (roomName: string) => {
      let room = roomData.get(roomName);
      if (!room) {
        room = {
          entityIds: [],
          entities: [],
          lastActive: Date.now(),
        };
        roomData.set(roomName, room);
      }

      const entities = await fetchEntities(
        room.entityIds.map((id) => Number(id))
      );
      room.entities = entities;

      socket.emit("roomData", {
        entityIds: room.entityIds,
        entities: room.entities,
      });
    });

    socket.on(
      "addEntity",
      async ({
        roomName,
        entityId,
      }: {
        roomName: string;
        entityId: string;
      }) => {
        const room = roomData.get(roomName);
        if (room && !room.entityIds.includes(entityId)) {
          room.entityIds.push(entityId);
          room.lastActive = Date.now();

          const entities = await fetchEntities(
            room.entityIds.map((id) => Number(id))
          );
          room.entities = entities;

          io.to(roomName).emit("roomData", {
            entityIds: room.entityIds,
            entities: room.entities,
          });
        }
      }
    );

    socket.on(
      "updateEntity",
      async ({
        roomName,
        entityId,
        updatedData,
      }: {
        roomName: string;
        entityId: string;
        updatedData: any;
      }) => {
        try {
          const updatedEntity = await updateEntity({
            entityId: Number(entityId),
            data: updatedData,
            io,
          });

          const room = roomData.get(roomName);
          if (room) {
            room.lastActive = Date.now();
            room.entities = room.entities.map((e) =>
              e.id === Number(entityId) ? updatedEntity : e
            );
          }

          io.to(roomName).emit("entityUpdated", {
            entityId,
            updatedEntity,
          });
        } catch (err: any) {
          socket.emit("error", {
            message: err.message ?? "Failed to update entity",
            details: err.details ?? null,
          });
        }
      }
    );

    socket.on(
      "removeEntity",
      async ({
        roomName,
        entityId,
      }: {
        roomName: string;
        entityId: string;
      }) => {
        const room = roomData.get(roomName);
        if (room) {
          room.entityIds = room.entityIds.filter(
            (id) => Number(id) !== Number(entityId)
          );
          room.lastActive = Date.now();

          const entities = await fetchEntities(
            room.entityIds.map((id) => Number(id))
          );
          room.entities = entities;

          io.to(roomName).emit("roomData", {
            entityIds: room.entityIds,
            entities: room.entities,
          });
        }
      }
    );

    socket.on(
      "chatMessage",
      ({
        roomName,
        message,
        sender,
      }: {
        roomName: string;
        message: string;
        sender: string;
      }) => {
        io.to(roomName).emit("chatMessage", {
          sender,
          message,
          timestamp: Date.now(),
        });
      }
    );

    socket.on("disconnecting", () => {
      for (const roomName of socket.rooms) {
        if (roomName !== socket.id) {
          setTimeout(() => {
            const room = io.sockets.adapter.rooms.get(roomName);
            if (!room || room.size === 0) {
              roomData.delete(roomName);
              console.log(`Deleted empty room: ${roomName}`);
            }
          }, 100);
        }
      }
    });
  });

  // Cleanup inactive rooms every minute
  setInterval(() => {
    const now = Date.now();
    for (const [roomName, data] of roomData.entries()) {
      const room = io.sockets.adapter.rooms.get(roomName);
      if (
        (!room || room.size === 0) &&
        now - data.lastActive > 10 * 60 * 1000
      ) {
        roomData.delete(roomName);
        console.log(`Deleted inactive room: ${roomName}`);
      }
    }
  }, 60 * 1000);
}
