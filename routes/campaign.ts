import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

const authRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.post("/", campaignCreationHandler);
}

async function campaignCreationHandler(request:FastifyRequest, reply:FastifyReply) {
    
}

export default authRoutes;