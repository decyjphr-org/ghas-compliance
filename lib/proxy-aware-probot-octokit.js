// This custom plugin overrides the default ProbotOctokit plugin and support Http Proxy.
const { Octokit } = require('@octokit/core')
const { enterpriseCompatibility } = require('@octokit/plugin-enterprise-compatibility')
// const { RequestOptions } = require('@octokit/types')
const { paginateRest } = require('@octokit/plugin-paginate-rest')
const { legacyRestEndpointMethods } = require('@octokit/plugin-rest-endpoint-methods')
const { retry } = require('@octokit/plugin-retry')
const { throttling } = require('@octokit/plugin-throttling')
const { config } = require('@probot/octokit-plugin-config')
const { createProbotAuth } = require('octokit-auth-probot')
const ProxyAgent = require('proxy-agent')
const probotRequestLogging = require('./octokit-plugin-probot-request-logging')
// const VERSION = require('../version')

const defaultOptions = {
  authStrategy: createProbotAuth,
  throttle: {
    onSecondaryRateLimit: (
      retryAfter,
      options,
      octokit
    ) => {
      octokit.log.warn(
        `SecondaryRateLimit hit with "${options.method} ${options.url}", retrying in ${retryAfter} seconds.`
      )
      return true
    },
    onRateLimit: (
      retryAfter,
      options,
      octokit
    ) => {
      octokit.log.warn(
        `Rate limit hit with "${options.method} ${options.url}", retrying in ${retryAfter} seconds.`
      )
      return true
    }
  },
  userAgent: 'probot',
  request: {
    agent: new ProxyAgent()
  }
}

const ProbotOctokit = Octokit.plugin(
  throttling,
  retry,
  paginateRest,
  legacyRestEndpointMethods,
  enterpriseCompatibility,
  probotRequestLogging,
  config
).defaults((instanceOptions) => {
  // merge throttle options deeply
  const options = Object.assign({}, defaultOptions, instanceOptions, {
    throttle: instanceOptions.throttle
      ? Object.assign({}, defaultOptions.throttle, instanceOptions.throttle)
      : defaultOptions.throttle
  })
  return options
})

function getProbotOctoKitWithLog (log) {
  // Create this wrapper so that we don't get this error https://github.com/pinojs/pino/issues/545
  const pinoWrapper = {
    debug: log.debug.bind(log),
    info: log.info.bind(log),
    warn: log.warn.bind(log),
    error: log.error.bind(log),
    bindings: log.bindings.bind(log)
  }

  const ProbotOctokit = Octokit.plugin(
    throttling,
    retry,
    paginateRest,
    legacyRestEndpointMethods,
    enterpriseCompatibility,
    probotRequestLogging,
    config
  ).defaults((instanceOptions) => {
    // merge throttle options deeply
    const options = Object.assign({}, defaultOptions, instanceOptions, {
      log: pinoWrapper,
      throttle: instanceOptions.throttle
        ? Object.assign({}, defaultOptions.throttle, instanceOptions.throttle)
        : defaultOptions.throttle
    })
    return options
  })

  return ProbotOctokit
}
module.exports = { ProbotOctokit, getProbotOctoKitWithLog }
