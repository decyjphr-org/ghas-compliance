/*
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
*/

// Is the actor a security manager
async function checkSecurityManager (context, log) {
  try {
    const { data: teams } = await context.octokit.request('GET /orgs/{org}/security-managers',
      { org: context.repo().owner })

    for (const team of teams) {
      try {
        log.debug(`team is ${JSON.stringify(team)}`)
        const params = {
          org: context.repo().owner,
          team_slug: team.slug,
          username: context.payload.sender.login
        }
        log.debug(`Getting membership for user ${JSON.stringify(params)}`)
        const membership = await context.octokit.teams.getMembershipForUserInOrg(params)
        log.debug(`Membership = ${JSON.stringify(membership)}`)
        // Is a member
        return true
      } catch (e) {
        if (e.status === 404) {
          log.debug(`${context.payload.sender.login} is not a member of the Security manager teams ${team.slug}`)
          continue
        } else {
          throw (e)
        }
      }
    }
    return false
  } catch (e) {
    if (e.status === 404) {
      log.debug(`${context.repo().owner} Org does not have Security manager teams ${e}`)
      return false
    } else {
      log.error(
                `Got error getting security manager role for ${context.payload.sender.login} = ${e}`
      )
      return false
    }
  }
}
exports.checkSecurityManager = checkSecurityManager
