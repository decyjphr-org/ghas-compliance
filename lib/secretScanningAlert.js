const { checkSecurityManager } = require('./checkSecurityManager')
const PolicyManager = require('./policyManager')
// Handler to the repository
// Enable GHAS for the event.
async function handleSecretScanningAlert (context, log) {
  const { payload: { alert: secret } } = context
  const isSecurityManager = await checkSecurityManager(context, log)
  const policyManager = new PolicyManager(context, log)
  const policyPath = await policyManager.getPolicyPath()
  const policy = await policyManager.getPolicy()

  if (!policyManager.isSecretByPolicy(secret)) {
    log.debug(`No secret scanning alerts found for the Policy ${JSON.stringify(policy)} located at ${JSON.stringify(policyPath)}`)
    return
  }
  log.debug(`Secret scanning alert is found for the Policy ${JSON.stringify(policy)} located at ${JSON.stringify(policyPath)}`)
  if (!isSecurityManager) {
    log.debug('Revert the secret scanning alert')
    await context.octokit.secretScanning.updateAlert(context.repo({
      alert_number: context.payload.alert.number,
      state: 'open'
    }))
  }
}

module.exports = { handleSecretScanningAlert }
