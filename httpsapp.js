const https = require('https')
const fs = require('fs')
const path = require('path')
const { createNodeMiddleware, createProbot } = require('probot')
const app = require('./index.js')
const { pino } = require('pino')
const { getTransformStream } = require('@probot/pino')

// This needs to be done since we are running the server and not express
require('dotenv').config()
const { APP_ID: appId, PRIVATE_KEY: privateKey, WEBHOOK_SECRET: webhookSecret, LOG_LEVEL: logLevel, LOG_MESSAGE_KEY: logMessageKey, TLS_KEY_PATH: tlsKeyPath, TLS_CERT_PATH: tlsCertPath } = process.env

const log = getLog(logLevel, logMessageKey)

const probotOptions = {
  appId,
  privateKey,
  secret: webhookSecret,
  log: log.child({ name: 'probot' }),
  level: logLevel || 'trace',
  name: 'probot',
  messageKey: logMessageKey || 'msg'
}

const credentials = {
  key: fs.readFileSync(path.resolve(tlsKeyPath)),
  cert: fs.readFileSync(path.resolve(tlsCertPath))
}

const middleware = createNodeMiddleware(app, { probot: createProbot(probotOptions) })
https.createServer(credentials, middleware).listen(3000)
log.info(`Started HTTPS Server with log ${JSON.stringify(log)}`)

function getLog (logLevel, logMessageKey) {
  const pinoOptions = {
    level: logLevel || 'trace',
    name: 'probot',
    messageKey: logMessageKey || 'msg'
  }

  const transform = getTransformStream()
  transform.pipe(pino.destination(1))
  return pino(pinoOptions, transform)
}
