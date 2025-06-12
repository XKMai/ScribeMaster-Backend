import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { folderItems } from "../models/folderItems";
import { notes } from "../models/notes";
import { eq, count as drizzleCount } from "drizzle-orm";

const notesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", notesCreationHandler);
  fastify.get("/:noteId", noteGetHandler);
  fastify.patch("/:noteId", noteUpdateHandler);
  fastify.delete("/:noteId", noteDeleteHandler);
};

async function notesCreationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { title, content, createdBy, folderId } = request.body as {
    title: string;
    content?: string;
    createdBy: number; // This is the ID of the user creating the note
    folderId: number; // Folder ID to link the note
  };

  const [note] = await db
    .insert(notes)
    .values({
      title,
      content: content ?? "",
      createdBy,
    })
    .returning();

  // Determine the next position
  const [{ count }] = await db
    .select({ count: drizzleCount() })
    .from(folderItems)
    .where(eq(folderItems.folderId, folderId));

  const position = Number(count); // Add to end

  await db.insert(folderItems).values({
    folderId,
    type: "note",
    refId: note.id,
    position: position,
  });

  return reply.code(201).send(note);
}

async function noteGetHandler(request: FastifyRequest, reply: FastifyReply) {
  const { noteId } = request.params as { noteId: number };

  // Find the note by ID
  const note = await db.query.notes.findFirst({
    where: eq(notes.id, noteId),
  });

  if (!note) {
    return reply.code(404).send({ error: "Note not found" });
  }

  return reply.code(201).send(note);
}

async function noteUpdateHandler(request: FastifyRequest, reply: FastifyReply) {
  const { noteId } = request.params as { noteId: number };
  const { title, content } = request.body as {
    title?: string;
    content?: string;
  };

  //Find and update the note
  const updatedNote = await db
    .update(notes)
    .set({
      title: title ?? undefined,
      content: content ?? undefined,
    })
    .where(eq(notes.id, noteId))
    .returning();

  if (updatedNote.length === 0) {
    return reply.code(404).send({ error: "Note not found" });
  }

  return reply.send(updatedNote[0]);
}

async function noteDeleteHandler(request: FastifyRequest, reply: FastifyReply) {
  const { noteId } = request.params as { noteId: number };

  const deletedNote = await db
    .delete(notes)
    .where(eq(notes.id, noteId))
    .returning();

  // Delete from folderItems as well
  await db.delete(folderItems).where(eq(folderItems.refId, noteId));

  if (deletedNote.length === 0) {
    return reply.code(404).send({ error: "Note not found" });
  }

  // Optionally, remove from folderItems if needed
  await db.delete(folderItems).where(eq(folderItems.refId, noteId));

  return reply.code(204).send();
}

export default notesRoutes;
