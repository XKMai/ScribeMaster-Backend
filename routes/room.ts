import { db } from "../database/database";
import { fetchEntities, updateEntity } from "./entity"; // Ensure this path is correct

export default async function roomRoutes(app: any, io: any) {
  // Store entities for each room
  const roomData = new Map<
    string,
    {
      entityIds: number[];
      entities: any[];
      lastActive: number;
    }
  >();

  io.on("connection", (socket) => {
    socket.on("joinRoom", async (roomName: string) => {
      socket.join(roomName);
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
        entityId: number;
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
        entityId: number;
        updatedData: any;
      }) => {
        try {
          const room = roomData.get(roomName);
          const prevEntity = room?.entities.find(e => e.id === entityId);

          const updatedEntity = await updateEntity({
            entityId: entityId,
            data: updatedData,
            io,
          });

          if (room) {
            room.lastActive = Date.now();
            room.entities = room.entities.map((e) =>
              e.id === entityId ? updatedEntity : e
            );
          }

          if (prevEntity) {
            const logEntries: string[] = [];
            
            if (updatedEntity.hp !== prevEntity.hp) {
              const diff = updatedEntity.hp - prevEntity.hp;
              const change = diff > 0 ? `gained ${diff}` : `lost ${Math.abs(diff)}`;
              logEntries.push(`${updatedEntity.name} ${change} HP.`);
            }
            
            if (updatedEntity.maxhp !== prevEntity.maxhp) {
              const diff = updatedEntity.maxhp - prevEntity.maxhp;
              const change = diff > 0 ? `increased max HP by ${diff}` : `reduced max HP by ${Math.abs(diff)}`;
              logEntries.push(`${updatedEntity.name} ${change}.`);
            }

            if (updatedEntity.temphp !== prevEntity.temphp) {
              const diff = updatedEntity.temphp - prevEntity.temphp;
              if (Number.isNaN(diff)){
                logEntries.push(`${updatedEntity.name} set temp HP to ${updatedEntity.temphp}.`);
              } else {
              const change = diff > 0 ? `increased temp HP by ${diff}` : `reduced temp HP by ${Math.abs(diff)}`;
              logEntries.push(`${updatedEntity.name} ${change}.`);
              }
            }

            if (updatedEntity.speed !== prevEntity.speed) {
              logEntries.push(`${updatedEntity.name} speed changed from ${prevEntity.speed} to ${updatedEntity.speed}.`);
            }
            
            // Emit system messages
            logEntries.forEach((message) => {
              io.to(roomName).emit("chatMessage", {
                sender: "System",
                message,
                timestamp: Date.now(),
              });
            });
          }

          io.to(roomName).emit("entityUpdated", {
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
