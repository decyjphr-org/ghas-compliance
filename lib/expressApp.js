const https = require('https')
const fs = require('fs')
const path = require('path')
const { createProbot } = require('probot')
const { createNodeMiddleware: createWebhooksMiddleware } = require('@octokit/webhooks')
const app = require('./index.js')
const { pino } = require('pino')
const { getTransformStream } = require('./lib/getPinoTransform')
const ecsFormat = require('@elastic/ecs-pino-format')
const pinoHttp = require('pino-http')
const { v4: uuidv4 } = require('uuid')
const isBase64 = require('is-base64')
const express = require('express')
const { githubAppJwt } = require('universal-github-app-jwt')
const { ProbotOctokit, getProbotOctoKitWithLog } = require('./lib/proxy-aware-probot-octokit')
// const { ProbotOctokit } = require('probot')
const ProxyAgent = require('proxy-agent')
const appInfo = require('./package.json')
const PolicyManager = require('./lib/policyManager')
const Validator = require('./lib/validator')
// This needs to be done since we are running the server and using the built-in Express server.
require('dotenv').config()

// Extract relevant Env vars
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
  TLS_CERT: tlsCert,
  CSP: csp,
  CLOUD_AVAILABILITY_ZONE: cloudAvailabilityZone,
  CLOUD_INSTANCE_ID: cloudInstanceId,
  CONTAINER_ID: containerId,
  APPLICATIONID: applicationId,
  PRODUCTID: productId,
  PRODUCTLINEID: productLineId,
  ORGANIZATION: organization,
  ENVIRONMENT: environment
} = process.env

const logOptions = {
  logLevel: logLevel || 'trace',
  logMessageKey: logMessageKey || 'msg',
  logFormat: logFormat || 'json',
  logLevelInString,
  sentryDsn
}

const defaultLogEntries = {
  csp,
  cloud_availability_zone: cloudAvailabilityZone,
  cloud_instance_id: cloudInstanceId,
  container_id: containerId,
  applicationid: applicationId,
  productid: productId,
  productlineid: productLineId,
  organization,
  environment
}

function createExpressApp () {
  const appNameVersion = `${appInfo.name} (${appInfo.version})`
  // Create Logger
  const probotlog = getLog(logOptions).child(Object.assign({}, defaultLogEntries, { name: appNameVersion, childloggername: 'application' }))

  // Get GitHub App private key
  let privateKeyDecoded
  if (isBase64(privateKey)) {
    // Decode base64-encoded certificate
    privateKeyDecoded = Buffer.from(privateKey, 'base64')
  } else {
    privateKeyDecoded = privateKey
  }

  const probotOptions = {
    appId,
    privateKey: privateKeyDecoded,
    secret: webhookSecret,
    log: probotlog,
    name: 'probot',
    Octokit: getProbotOctoKitWithLog(probotlog),
    request: { agent: new ProxyAgent() }
  }

  // Creating the Probot App
  const probotApp = createProbot({ overrides: probotOptions })
  probotApp.load(app)

  const expressApp = express()

  // Express Handlers Configuration
  expressApp.use(getLoggingMiddleware(probotlog))

  // Not usual to handle any path, but for this app we are agnostic of anything in the path by default
  expressApp.use(
    '*',
    createWebhooksMiddleware(probotApp.webhooks, {
      path: '/'
    })
  )

  // API to trigger a repository dispatch at the end of Migration
  // and to trigger post migration tasks (loose coupling)
  expressApp.get('/trigger/:repo/:branch', async (req, res, next) => {
    const repo = req.params.repo
    const branch = req.params.branch
    try {
      // Input validations
      Validator.isValidRepoName(req.params.repo)
      const context = await createContext(repo)
      const runCheck = {
        event_type: 'compliance-check',
        client_payload: {
          head_branch: branch
        }
      }
      const report = await context.octokit.repos.createDispatchEvent(context.repo(runCheck))
      res.send(`Triggered a repository dispatch of event_type 'compliance-check' for repo ${repo} with branch ${branch} and got response ${report.status}`)
    } catch (error) {
      if (error.status === 404) {
        res.status(404).send(`Repository '${repo}' is not visibile to the Compliance App. \nPlease check if the repo exists and the app is installed on it`)
      } else {
        probotlog.error(`Unexpected error in the trigger endpoint handler ${error.stack}`)
        res.status(500).send(`Unexpected error in the trigger endpoint handler for repo ${repo} with branch ${branch} ${error.stack}`)
      }
    }
  })

  // API to trigger a repository dispatch at the end of Migration
  // and to trigger post migration tasks (loose coupling)
  expressApp.get('/enable/:repo/', async (req, res, next) => {
    const repo = req.params.repo
    const branch = req.params.branch
    try {
      // Input validations
      Validator.isValidRepoName(req.params.repo)
      const context = await createContext(repo)
      const enable = {
        event_type: 'ghas-enable',
        client_payload: {
          createInitialCheck: true,
          createBranchProtection: true,
          enableAdvSec: true
        }
      }
      const report = await context.octokit.repos.createDispatchEvent(context.repo(enable))
      res.send(`Triggered a repository dispatch of event_type 'ghas-enable' for repo ${repo} and got response ${report.status}`)
    } catch (error) {
      if (error.status === 404) {
        res.status(404).send(`Repository '${repo}' is not visibile to the Compliance App. \nPlease check if the repo exists and the app is installed on it`)
      } else {
        probotlog.error(`Unexpected error in the trigger endpoint handler ${error.stack}`)
        res.status(500).send(`Unexpected error in the trigger endpoint handler for repo ${repo} with branch ${branch} ${error.stack}`)
      }
    }
  })

  expressApp.get('/health', async (req, res, next) => {
    const output = []
    await (async () => {
      try {
        output.push('=================================================================================\n')
        output.push(`                      ${appNameVersion} Health Check\n`)
        output.push('=================================================================================\n')
        let privateKeyNew
        if (isBase64(privateKey)) {
          // Decode base64-encoded certificate
          privateKeyNew = Buffer.from(privateKey, 'base64')
          output.push(`Creating a JWT token using appId:${appId}\n privateKey:${privateKeyNew.subarray(0, 75)}...\n`)
        } else {
          privateKeyNew = privateKey
          output.push(`Creating a JWT token using appId:${appId}\n privateKey:${privateKeyNew.slice(0, 75)}...\n`)
        }

        const { token } = await githubAppJwt({
          id: appId,
          privateKey: privateKeyNew
        })
        output.push(`Successfully generated a JWT token ${token.slice(0, 75)}...\n`)

        const github = await probotApp.auth()

        probotlog.debug('Fetching the 100 Webhook Deliveries')
        let failedDeliveries = await github.apps.listWebhookDeliveries({ per_page: 100 })
        // let deliveries = await basicOctokit.apps.listWebhookDeliveries({ per_page: 100 })

        failedDeliveries = failedDeliveries.data.filter(delivery => { return delivery.status !== 'OK' })

        output.push(`Failed Deliveries count (In the top 100 results) = ${failedDeliveries.length}\n`)

        probotlog.debug('Fetching the App Installations')

        const installations = await github.paginate(
          github.apps.listInstallations.endpoint.merge({ per_page: 100 })
        )

        if (installations.length > 0) {
          const installation = installations[0]
          probotlog.debug(`Installation ID: ${installation.id}`)
          probotlog.debug('Fetching the App Details')
          const github = await probotApp.auth(installation.id)
          const app = await github.apps.getAuthenticated()
          // probotlog.debug(`App details = \n${JSON.stringify(app, null, 2)}`)
          probotlog.debug(`Validated the app is configured properly = \n${JSON.stringify(app.data, null, 2)}`)
          output.push(`Registered App name = ${app.data.slug}\n`)
          output.push(`Permissions = ${JSON.stringify(app.data.permissions)}\n`)
          output.push(`Events = ${app.data.events}\n`)

          const context = {
            payload: {
              installation
            },
            octokit: github,
            log: probotlog,
            repo: (object) => {
              return Object.assign(
                {
                  owner: installation.account.login,
                  repo: ''
                },
                object
              )
            },
            config: (filename) => { return null }
          }
          const policyManager = new PolicyManager(context, probotlog)
          const runtime = await policyManager.getRuntimeSettings()
          // const policyPath = await policyManager.getPolicyPath()
          // const policy = await policyManager.getPolicy()
          output.push(`Runtime settings = ${JSON.stringify(runtime, null, 2)}\n`)
          // output.push(`PolicyPath = ${JSON.stringify(policyPath, null, 2)}\n`)
          // output.push(`Policy = ${JSON.stringify(policy, null, 2)}\n`)
        }
        res.end(`${output}`.replace(/,/g, '\n'))
      } catch (error) {
        probotlog.error(`Unexpected error in the health endpoint handler ${error}`)
        next(error)
      }
    })()
  })

  expressApp.get('/ping', async (req, res, next) => {
    try {
      probotlog.info('Received ping; sending pong')
      res.end(`${appNameVersion}...PONG`)
    } catch (error) {
      probotlog.error(`Unexpected error in the ping endpoint handler ${error}`)
      next(error)
    }
  })

  return expressApp
}

// Function Declarations
function getLog (options) {
  const { logLevel, logMessageKey, ...getTransformStreamOptions } = options
  const pinoOptions = {
    level: logLevel || 'trace',
    name: 'probot',
    messageKey: logMessageKey || 'msg'
  }
  const transform = getTransformStream(getTransformStreamOptions)
  transform.pipe(pino.destination(1))
  return pino(Object.assign({}, pinoOptions, ecsFormat()))
}

function getLoggingMiddleware (logger) {
  return pinoHttp({
    logger: logger.child({ childloggername: 'http' }),
    customSuccessMessage (res) {
      const responseTime = Date.now() - res[pinoHttp.startTime]
      return `${res.req.method} ${res.req.url}  ${res.statusCode} - ${responseTime}ms`
    },
    customErrorMessage (_, res) {
      const responseTime = Date.now() - res[pinoHttp.startTime]
      return `${res.req.method} ${res.req.url} ${res.req.headers} ${res.statusCode} - ${responseTime}ms`
    },
    genReqId: (req) =>
      req.headers['x-request-id'] ||
      req.headers['x-github-delivery'] ||
      uuidv4()
  })
}

async function createContext (repo) {
  probotlog.debug('Fetching installations')
  let github = await probotApp.auth()
  const installations = await github.paginate(
    github.apps.listInstallations.endpoint.merge({ per_page: 100 })
  )
  const installation = installations[0]
  probotlog.debug(`The installation for this app is ${JSON.stringify(installation)}`)
  github = await probotApp.auth(installation.id)
  const context = {
    payload: {
      installation
    },
    octokit: github,
    log: probotlog,
    repo: (object) => {
      return Object.assign(
        {
          owner: installation.account.login,
          repo
        },
        object
      )
    }
  }
  return context
}

module.exports = { createExpressApp }