const { checkSecurityManager } = require('./checkSecurityManager')
const PolicyManager = require('./policyManager')
// Handler to the repository
// Enable GHAS for the event.
async function handleSecretScanningAlert (context, log) {
  // Only handle alert created events if the push_protection_bypassed is true
  if (context.payload.action === 'created' && context.payload.alert.push_protection_bypassed !== true) {
    return
  }
  const { payload: { alert: secret } } = context
  const isSecurityManager = await checkSecurityManager(context, log)
  log.debug(`Is the user a security Manager check returned ${isSecurityManager}`)
  if (isSecurityManager) {
    log.info('The user is a SecurityManager. Do not revert the secret')
    return
  }
  const policyManager = new PolicyManager(context, log)
  try {
    await policyManager.getPolicy()
  } catch (error) {
    log.error(`Unable to get Policy ${error}`)
    log.info('secret-alert-reopened because of error')
    return context.octokit.secretScanning.updateAlert(context.repo({
      alert_number: context.payload.alert.number,
      state: 'open'
    }))
  }
  const policyPath = await policyManager.getPolicyPath()

  if (!policyManager.isSecretByPolicy(secret)) {
    log.debug(`Do not revert the secret. No secret scanning alerts found for the Policy located at ${JSON.stringify(policyPath)}`)
    return
  }
  log.debug(`Secret scanning alert is found for the Policy located at ${JSON.stringify(policyPath)}`)
  log.info('The user is not a SecurityManager. secret-alert-reopened')
  return context.octokit.secretScanning.updateAlert(context.repo({
    alert_number: context.payload.alert.number,
    state: 'open'
  }))
}

module.exports = { handleSecretScanningAlert }
