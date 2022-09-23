const { checkSecurityManager } = require('./checkSecurityManager')
const PolicyManager = require('./policyManager')
// Handler to the repository
// Enable GHAS for the event.
async function handleCodeScanningAlert (context, log) {
  const { payload: { alert } } = context
  const isSecurityManager = await checkSecurityManager(context, log)
  const policyManager = new PolicyManager(context, log)
  const policyPath = await policyManager.getPolicyPath()
  const policy = await policyManager.getPolicy()

  if (!policyManager.isAlertByPolicy(alert)) {
    log.debug(`No alerts found for the Policy ${JSON.stringify(policy)} located at ${JSON.stringify(policyPath)}`)
    return
  }
  log.debug(`Alert is found for the Policy ${JSON.stringify(policy)} located at ${JSON.stringify(policyPath)}`)
  // const isOrgAdmin = await checkOrgAdmin(context, log)
  if (!isSecurityManager) {
    // const isRepoAdmin = await checkRepoAdmin(context, log)
    // if (!isRepoAdmin) {
    // }
    log.debug('Revert the alert')
    await context.octokit.codeScanning.updateAlert(context.repo({
      alert_number: context.payload.alert.number,
      state: 'open'
    }))
  }
}

module.exports = { handleCodeScanningAlert }
