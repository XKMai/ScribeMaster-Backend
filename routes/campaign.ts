import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { db } from "../database/database";
import { folders } from "../models/folders";
import { eq, and } from "drizzle-orm";

const campaignRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/", campaignCreationHandler);
  fastify.get("/:userId", campaignGetHandler);
  fastify.post("/join/:folderId/:userId", joinCampaign);
};

async function campaignCreationHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { name, createdBy } = request.body as {
    name: string;
    createdBy: number;
  };

  const campaign = await db
    .insert(folders)
    .values({
      name,
      isCampaign: true,
      settings: { users: [createdBy] },
      createdBy,
    })
    .returning();

  return reply.code(201).send(campaign[0]);
}

async function campaignGetHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const { userId } = request.params as { userId: number };

  const campaigns = await db
    .select({ id: folders.id, name: folders.name })
    .from(folders)
    .where(and(eq(folders.createdBy, userId), eq(folders.isCampaign, true)));

  if (campaigns.length === 0) {
    return reply.code(404).send({ error: "No campaigns found" });
  }

  return reply.code(200).send(campaigns);
}

type CampaignSettings = {
  users: number[];
  [key: string]: any;
};

async function joinCampaign(request: FastifyRequest, reply: FastifyReply) {
  let { userId, folderId } = request.params as {
    userId: string;
    folderId: string;
  };

  //Need to convert userId and folderId to numbers or else will be done as a String instead
  const numericUserId = parseInt(userId, 10);
  const numericFolderId = parseInt(folderId, 10);

  if (isNaN(numericUserId) || isNaN(numericFolderId)) {
    return reply.code(400).send({ error: "Invalid folderId or userId" });
  }

  //Find the campaign folder and check if it is a campaign
  const campaign = await db.query.folders.findFirst({
    where: (folders, { eq, and }) =>
      and(eq(folders.id, numericFolderId), eq(folders.isCampaign, true)),
  });

  if (!campaign) {
    return reply.code(404).send({ error: "Campaign not found" });
  }

  const settings = (campaign.settings ?? {}) as CampaignSettings;
  const users = Array.isArray(settings.users) ? settings.users : [];

  //Check if the user is already in the campaign
  if (!users.includes(numericUserId)) {
    users.push(numericUserId);

    // Update the campaign settings with the new user
    await db
      .update(folders)
      .set({ settings: { ...settings, users } })
      .where(eq(folders.id, numericFolderId));
  }

  return reply.code(200).send({ message: "Campaign joined successfully" });
}

export default campaignRoutes;
