// Handler to the repository
// Enable GHAS for the event.
async function handleCodeScanningAlert (context, log) {
  const isOrgAdmin = await checkOrgAdmin(context, log)
  if (!isOrgAdmin) {
    const isRepoAdmin = await checkRepoAdmin(context, log)
    if (!isRepoAdmin) {
      log('Revert the alert')
      await context.octokit.codeScanning.updateAlert(context.repo({
        alert_number: context.payload.alert.number,
        state: 'open'
      }))
    }
  }
}

// Is the Sender an org Admin
async function checkOrgAdmin (context, log) {
  try {
    const {
      data: { role }
    } = await context.octokit.orgs.getMembershipForUser(
      { org: context.payload.organization.login, username: context.payload.sender.login }
    )
    return role === 'admin'
  } catch (e) {
    if (e.status === 404) {
      log.debug(`${context.payload.sender.login} not a member of org ${e}`)
      return false
    } else {
      log.error(
          `Got error getting org role for ${context.payload.sender.login} ${e}`
      )
      return false
    }
  }
}

// Is the sender a repo admin
async function checkRepoAdmin (context, log) {
  try {
    const {
      data: { permission }
    } = await context.octokit.repos.getCollaboratorPermissionLevel(
      context.repo({ username: context.payload.sender.login })
    )
    log.debug(`Repo role for ${context.payload.sender.login} is ${JSON.stringify(permission)}`)
    return permission === 'admin'
  } catch (e) {
    if (e.status === 404) {
      log.debug(`${context.payload.sender.login} not a collaborator for the repo ${e}`)
      return false
    } else {
      log.error(
            `Got error getting repo role for ${context.payload.sender.login} = ${e}`
      )
      return false
    }
  }
}

module.exports = { handleCodeScanningAlert }
