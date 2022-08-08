const { handleCheckSuite } = require('./lib/checkSuite')
const { handlePull } = require('./lib/pullRequest')
const { handleCheckRun } = require('./lib/checkRun')
const { handleCodeScanningAlert } = require('./lib/codeScanningAlert')
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
  app.on(['check_suite.requested', 'check_suite.rerequested'], handleCheckSuite)
  app.on(['pull_request.opened', 'pull_request.reopened'], handlePull)
  app.on(['check_run.created', 'check_run.rerequested'], (context) => { return handleCheckRun(context, app.log) })
  app.on(['repository_dispatch'], (context) => { return handleRepoDispatch(context, app.log) })
  app.on(['code_scanning_alert.closed_by_user'], (context) => { return handleCodeScanningAlert(context, app.log) })
}
