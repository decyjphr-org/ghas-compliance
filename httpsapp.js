const https = require('https')
const fs = require('fs')
const path = require('path')
const { createNodeMiddleware, createProbot } = require('probot')
const app = require('./index.js')
const { pino } = require('pino')
const { getTransformStream } = require('@probot/pino')
const isBase64 = require('is-base64')

// This needs to be done since we are running the server and not express
require('dotenv').config()
const {
  APP_ID: appId,
  PRIVATE_KEY: privateKey,
  WEBHOOK_SECRET: webhookSecret,
  LOG_LEVEL: logLevel,
  LOG_MESSAGE_KEY: logMessageKey,
  TLS_KEY_PATH: tlsKeyPath,
  TLS_CERT_PATH: tlsCertPath,
  TLS_KEY: tlsKey,
  TLS_CERT: tlsCert
} = process.env

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
