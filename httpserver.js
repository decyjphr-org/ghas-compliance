const SmeeClient = require("smee-client");
const EnvHelper = require('./lib/envHelper')
const { createExpressApp } = require('./expressApp')

const {
  proxyUrl
} = EnvHelper.getEnv()

console.log(proxyUrl)

const { expressApp, probotlog }  = createExpressApp()

let events
if (proxyUrl) {
  probotlog.info(`Starting Smee client with proxyUrl ${proxyUrl}`)

  const smee = new SmeeClient({
    logger: probotlog,
    source: proxyUrl,
    target: 'http://localhost:3000',
  });
  
  events = smee.start()
}

const server = expressApp.listen(3000)
probotlog.info('Started HTTP Server')

process.on('SIGINT', closeServer)
process.on('SIGTERM', closeServer)

function closeServer() {
  probotlog.debug('Closing HTTP server')
  server.close(() => {
    probotlog.debug('HTTP server closed')
  })
  if (events) events.close()
}

