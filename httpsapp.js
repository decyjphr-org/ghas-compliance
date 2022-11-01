const https = require('https')
const fs = require('fs')
const path = require('path')
const { createProbot } = require('probot')
const { createNodeMiddleware: createWebhooksMiddleware } = require('@octokit/webhooks')
const app = require('./index.js')
const { pino } = require('pino')
// const { getTransformStream } = require('@probot/pino')
const { getTransformStream } = require('./lib/getPinoTransform')
const pinoHttp = require('pino-http')
const { v4: uuidv4 } = require('uuid')
const isBase64 = require('is-base64')
const express = require('express')
const morgan = require('morgan')
const { githubAppJwt } = require('universal-github-app-jwt')

// This needs to be done since we are running the server and not express
require('dotenv').config()

const {
  APP_ID: appId,
  PRIVATE_KEY: privateKey,
  WEBHOOK_SECRET: webhookSecret,
  LOG_FORMAT: logFormat,
  LOG_LEVEL: logLevel,
  LOG_MESSAGE_KEY: logMessageKey,
  LOG_LEVEL_IN_STRING: logLevelInString,
  SENTRY_DSN: sentryDsn,
  TLS_KEY_PATH: tlsKeyPath,
  TLS_CERT_PATH: tlsCertPath,
  TLS_KEY: tlsKey,
  TLS_CERT: tlsCert
} = process.env

const logOptions = {
  logLevel: logLevel || 'trace',
  logMessageKey: logMessageKey || 'msg',
  logFormat,
  logLevelInString,
  sentryDsn
}
const serverlog = getLog(logOptions).child({ name: 'server' })
const probotlog = getLog(logOptions).child({ name: 'probot' })

const probotOptions = {
  appId,
  privateKey,
  secret: webhookSecret,
  log: probotlog,
  name: 'probot'
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

const probotApp = createProbot(probotOptions)
probotApp.load(app)

const expressApp = express()

expressApp.use(morgan('combined'))
expressApp.use(getLoggingMiddleware(probotlog))

expressApp.use(
  '/',
  createWebhooksMiddleware(probotApp.webhooks, {
    path: '/'
  })
)
expressApp.get('/health', async (req, res) => {
  await (async () => {
    let privateKeyNew
    if (isBase64(privateKey)) {
      // Decode base64-encoded certificate
      privateKeyNew = Buffer.from(privateKey, 'base64')
    } else {
      privateKeyNew = privateKey
    }

    res.write(`Creatinga a JWT token using appId:${appId}, privateKey:${privateKeyNew}`)
    const { token } = await githubAppJwt({
      id: appId,
      privateKey: privateKeyNew
    })
    res.write(`Successfully generated a JWT token ${token}`)
  })()
  res.end('PONG')
})

expressApp.get('/ping', async (req, res) => res.end('PONG'))

https.createServer(credentials, expressApp).listen(3000)

serverlog.info('Started HTTPS Server')
serverlog.debug(`with env ${JSON.stringify(process.env, null, 2)}`)

// Function Declarations
function getLog (options) {
  const { level, logMessageKey, ...getTransformStreamOptions } = options
  const pinoOptions = {
    level: level || 'trace',
    name: 'probot',
    messageKey: logMessageKey || 'msg'
  }
  const transform = getTransformStream(getTransformStreamOptions)
  transform.pipe(pino.destination(1))
  return pino(pinoOptions, transform)
}

function getLoggingMiddleware (logger) {
  return pinoHttp({
    logger: logger.child({ name: 'http' }),
    customSuccessMessage (res) {
      const responseTime = Date.now() - res[pinoHttp.startTime]
      return `${res.req.method} ${res.req.url} ${res.statusCode} - ${responseTime}ms`
    },
    customErrorMessage (_, res) {
      const responseTime = Date.now() - res[pinoHttp.startTime]
      return `${res.req.method} ${res.req.url} ${res.statusCode} - ${responseTime}ms`
    },
    genReqId: (req) =>
      req.headers['x-request-id'] ||
      req.headers['x-github-delivery'] ||
      uuidv4()
  })
}
