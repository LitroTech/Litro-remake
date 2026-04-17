import { buildServer } from './server.js'

const port = parseInt(process.env.PORT ?? '3000', 10)

const server = await buildServer()

server.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
  server.log.info(`Litro API running at ${address}`)
})
