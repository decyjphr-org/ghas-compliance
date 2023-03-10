const https = require('https')
const fs = require('fs')
const path = require('path')
const isBase64 = require('is-base64')
const { createExpressApp } = require('./expressApp')
const EnvHelper = require('./lib/envHelper')

// Extract relevant Env vars
const {
  tlsKeyPath,
  tlsCertPath,
  tlsKey,
  tlsCert,
  maxAlerts
} = EnvHelper.getEnv()

const { expressApp, probotlog }  = createExpressApp()

// Get Credentials for TLS
let credentials
if (tlsKey && tlsCert) {
  if (isBase64(tlsKey) && isBase64(tlsCert)) {
    // Decode base64-encoded certificate
    credentials = {
      key: Buffer.from(tlsKey, 'base64'),
      cert: Buffer.from(tlsCert, 'base64')
    }
  } else {
    throw new Error('The contents of "env.TLS_KEY" and/or "env.TLS_CERT" could not be validated. Please check to ensure you have BASE64 encoded the contents correctly.')
  }
} else if (tlsKeyPath && tlsCertPath) {
  credentials = {
    key: fs.readFileSync(path.resolve(tlsKeyPath)),
    cert: fs.readFileSync(path.resolve(tlsCertPath))
  }
} else {
  throw new Error('Please set values for values for:\n "env.TLS_KEY" and "env.TLS_CERT" or\n "env.TLS_KEY_PATH" and "env.TLS_CERT_PATH" ')
}

const server = https.createServer(credentials, expressApp)
server.listen(3000)
probotlog.info('Started HTTPS Server')

process.on('SIGINT', closeServer)
process.on('SIGTERM', closeServer)

function closeServer() {
  probotlog.debug('Closing HTTPS server')
  server.close(() => {
    probotlog.debug('HTTPS server closed')
  })
}
