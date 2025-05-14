import Fastify from 'fastify';
import userRoutes from './routes/users';

const fastify = require('fastify')({logger:true})
fastify.register(require('@fastify/jwt'), {
  secret: 'supersecretstring'  //Secret string
})

const PORT = 5000;

fastify.register(userRoutes, { prefix: '/user' })

fastify.get('/', function (request, reply) {
  reply.send({ hello: 'world' })
})


const start = async () => {
    try {
        await fastify.listen({port : PORT})
    } catch (error) {
    fastify.log.error(error)
    process.exit(1)
    }   
}

start()