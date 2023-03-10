// Is the actor a security manager
async function checkSecurityManager (context, log) {
  try {
    log.debug('Checking if the actor is security manager')

    log.debug(`Calling API to get security managers ${JSON.stringify(context.octokit.request.endpoint('GET /orgs/{org}/security-managers',
    { org: context.repo().owner }))} `)
    const resp = await context.octokit.request('GET /orgs/{org}/security-managers',
      { org: context.repo().owner })

    log.debug(`Response from the call is ${JSON.stringify(resp)}`)

    for (const team of resp.data) {
      try {
        const params = {
          org: context.repo().owner,
          team_slug: team.slug,
          username: context.payload.sender.login
        }
        log.debug(`Getting membership for user in the security managers team ${JSON.stringify(params)}`)
        const membership = await context.octokit.teams.getMembershipForUserInOrg(params)
        log.debug(`User ${context.payload.sender.login} is a member of security manager team ${team.slug} membership ${JSON.stringify(membership)}`)
        return true
      } catch (e) {
        if (e.status === 404) {
          log.debug(`User ${context.payload.sender.login} is not a member of the Security manager team ${team.slug}`)
          continue
        } else {
          log.error(`Unexpected error ${e} checking for security manager role for ${context.payload.sender.login} in the Security manager team ${team.slug}`)
          throw (e)
        }
      }
    }
    log.debug(`No security matching teams found where ${context.payload.sender.login} is a member. Teams ${JSON.stringify(resp.data)}`)
    return false
  } catch (e) {
    if (e.status === 404) {
      log.debug(`${context.repo().owner} Org does not have Security manager teams set up ${e}`)
    } else {
      log.error(
        `Unexpected error when checking for security manager role for ${context.payload.sender.login} = ${e}`
      )
    }
    return false
  }
}
exports.checkSecurityManager = checkSecurityManager
