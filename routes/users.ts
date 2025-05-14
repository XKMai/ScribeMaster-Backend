import { FastifyPluginAsync } from 'fastify';
import { db } from '../database/database';
import { users } from '../models/user';


const userRoutes: FastifyPluginAsync = async (fastify) => {

    fastify.post("/", postUserHandler);
    fastify.get("/", getUserHandler);
    fastify.get("/:id",getUserByIDHandler);

}

//Insert a User
function postUserHandler(request,reply) {
    const { name, password } = request.body as { name: string; password:string };
    db.insert(users).values({ name, password });
    reply.code(201).send({ message: "User inserted" });
}

//Get a User by Name, Probably slower
function getUserHandler(request,reply) {
    const {name} = request.body as { name:string }
    const result = db.query.users.findFirst({
        where: (users, { eq }) => eq(users.name, name),  //Drizzle way of query
    })
    reply.code(201).send({user:result})
}

//Get a User by ID
function getUserByIDHandler(request,reply) {
    const {userId} = request.params
    const result = db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userId),  //Drizzle way of query by Id
    })
    reply.code(201).send({user:result})
}

//Get UserID by Name
function getUserID(name:string) {
    const result = db.query.users.findFirst({
        columns: {id:true},                             //Selects only the id
        where: (users, { eq }) => eq(users.name, name),
    })
    return result
}

export default userRoutes;