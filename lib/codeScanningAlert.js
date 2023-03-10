const { checkSecurityManager } = require('./checkSecurityManager')
const PolicyManager = require('./policyManager')
async function handleCodeScanningAlert (context, log) {
  const { payload: { alert } } = context
  const isSecurityManager = await checkSecurityManager(context, log)
  log.debug(`Is the user a security Manager check returned ${isSecurityManager}`)
  if (isSecurityManager) {
    log.info('The user is a SecurityManager. Do not revert the alert')
    return
  }
  const policyManager = new PolicyManager(context, log)
  try {
    await policyManager.getPolicy()
  } catch (error) {
    log.error(`Unable to get Policy ${error}`)
    log.info('code-alert-reopened because of error')
    return context.octokit.codeScanning.updateAlert(context.repo({
      alert_number: context.payload.alert.number,
      state: 'open'
    }))
  }
  const policyPath = await policyManager.getPolicyPath()

  if (!policyManager.isAlertByPolicy(alert)) {
    log.debug(`Do not revert the alert. No alerts found confining to the Policy located at ${JSON.stringify(policyPath)}`)
    return
  }
  log.debug(`Alert is found confining to the Policy located at ${JSON.stringify(policyPath)}`)
  log.info('The user is not a SecurityManager. code-alert-reopened')
  return context.octokit.codeScanning.updateAlert(context.repo({
    alert_number: context.payload.alert.number,
    state: 'open'
  }))
}

module.exports = { handleCodeScanningAlert }
