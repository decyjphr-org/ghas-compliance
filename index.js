const { handleCheckSuite } = require('./lib/checkSuite')
const { handlePull } = require('./lib/pullRequest')
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
module.exports = (app, { getRouter }) => {
  // Webhook events that are being listened to
  app.on(['check_suite.requested', 'check_suite.rerequested'], (context) => {
    return callHandlerWithTiming(context, app, handleCheckSuite)
  })
  app.on(['pull_request.opened', 'pull_request.reopened'], (context) => {
    return callHandlerWithTiming(context, app, handlePull)
  })
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
function callHandlerWithTiming(context, app, handler) {
  const start = Date.now()
  handler(context, app.log).then(() => {
    if (context.payload.check_run && context.payload.check_run.name !== 'GHAS Compliance') {
      // No need to log timing for events that are skipped
      return
    }
    let id = ''
    // = context.payload.repository.full_name + ': '
    switch (context.name) {
      case 'check_run':
        id += context.payload.check_run.url
        break
      case 'check_suite':
        id += context.payload.check_suite.url
        break
      case 'pull_request':
        id += context.payload.pull_request.url
        break
      case 'repository_dispatch':
        id += context.payload.action
        break
      case 'code_scanning_alert':
        id += context.payload.alert.url
        break
    }

    const millis = Date.now() - start
    app.log.warn(`>>>> Timing for **${context.name}** ${id} : ${Math.floor(millis / 1000)} secs <<<<`)
  })
}
