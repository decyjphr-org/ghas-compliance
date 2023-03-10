// Disabling pullRequest support for the future
// const { handlePull } = require('./lib/pullRequest')
// const { handleCheckSuite } = require('./lib/checkSuite')
const { handleCheckRun } = require('./lib/checkRun')
const { handleCodeScanningAlert } = require('./lib/codeScanningAlert')
const { handleSecretScanningAlert } = require('./lib/secretScanningAlert')
const { handleRepoDispatch } = require('./lib/repoDispatch')
// Probot App to enable GHAS and set up GHAS Compliance checks
// For more information on probot apps:
// https://probot.github.io/docs/
// To get your app running against GitHub, see:
// https://probot.github.io/docs/development/
/**
 * This is the main entrypoint
 * @param {import('probot').Probot} app
 */
module.exports = (app) => {
  // Webhook events that are being listened to

  // Disabling pullRequest support for the future
  // app.on(['check_suite.requested', 'check_suite.rerequested'], (context) => {
  //   return callHandlerWithTiming(context, app, handleCheckSuite)
  // })
  // app.on(['pull_request.opened', 'pull_request.reopened'], (context) => {
  //   return callHandlerWithTiming(context, app, handlePull)
  // })
  app.on(['check_run.created', 'check_run.rerequested'], (context) => {
    return callHandlerWithTiming(context, app, handleCheckRun)
  })
  app.on(['repository_dispatch'], (context) => {
    return callHandlerWithTiming(context, app, handleRepoDispatch)
  })
  app.on(['code_scanning_alert.closed_by_user'], (context) => {
    return callHandlerWithTiming(context, app, handleCodeScanningAlert)
  })
  app.on(['secret_scanning_alert.resolved'], (context) => {
    return callHandlerWithTiming(context, app, handleSecretScanningAlert)
  })
}
function callHandlerWithTiming (context, app, handler) {
  // let id = ''

  // switch (context.name) {
  //   case 'check_run':
  //     id += context.payload.check_run.url
  //     break
  //   case 'check_suite':
  //     id += context.payload.check_suite.url
  //     break
  //   case 'pull_request':
  //     id += context.payload.pull_request.url
  //     break
  //   case 'repository_dispatch':
  //     id += context.payload.action
  //     break
  //   case 'code_scanning_alert':
  //     id += context.payload.alert.url
  //     break
  // }
  const start = Date.now()
  const logger = app.log.child({
    traceId: context.id,
    event: context.name,
    sender: context.payload.sender.login,
    org: context.payload.organization.login,
    repository: context.payload.repository.name
  })
  logger.info(`>>>> Started processing ${context.name} event <<<<`)
  handler(context, logger).then(() => {
    if (context.payload.check_run && context.payload.check_run.name !== 'GHAS Compliance') {
      const elapsedMillis = Date.now() - start
      logger.info({ responseTime: elapsedMillis }, `<<<< This is not a Check Run for GHAS Compliance App, So skipping...  ${context.name} : ${Math.floor(elapsedMillis / 1000)} secs >>>>`)
      return
    }
    const elapsedMillis = Date.now() - start
    logger.info({ responseTime: elapsedMillis }, `<<<< Timing for ${context.name} : ${Math.floor(elapsedMillis / 1000)} secs >>>>`)
  }).catch(e => {
    // Ok to catch this error than bubbling it up since, this is Async code returning after the webhook response was sent
    const elapsedMillis = Date.now() - start
    logger.error({ responseTime: elapsedMillis }, `Unexpected error while processing webhook ${context.name} \n ${e.stack}`)
  })
}
