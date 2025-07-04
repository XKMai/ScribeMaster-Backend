async function roomRoutes(app: any, io: any) {
  // Store entities for each room
  const roomEntities: Record<string, any[]> = {};

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join a campaign room
    socket.on("joinCampaign", (folderId: number) => {
      const room = `campaign-${folderId}`;
      socket.join(room);

      console.log(`Socket ${socket.id} joined room ${room}`);

      socket.on("disconnect", () => {
        console.log(`❌ Socket disconnected: ${socket.id}`);
      });
    });
  });
}
