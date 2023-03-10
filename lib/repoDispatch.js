const PolicyManager = require('./policyManager')
const previewHeaders = { accept: 'application/vnd.github.hellcat-preview+json,application/vnd.github.luke-cage-preview+json,application/vnd.github.zzzax-preview+json' }
const protection = {
  required_status_checks: {
    strict: true,
    contexts: ['GHAS Compliance']
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismissal_restrictions: {
      users: [],
      teams: []
    },
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: 0,
    bypass_pull_request_allowances: {
      users: [],
      teams: []
    }
  },
  restrictions: {
    users: [],
    teams: [],
    apps: []
  },
  required_linear_history: true,
  allow_force_pushes: true,
  allow_deletions: true,
  block_creations: false,
  required_conversation_resolution: true
}
// Handler to the repository
// Enable GHAS for the event.
async function handleRepoDispatch (context, log) {
  const policyManager = new PolicyManager(context, log)
  const { payload: { action } } = context
  const { payload: { client_payload: clientPayload } } = context
  log.debug(`Received a Repo Dispatch with action ${JSON.stringify(action)} and payload ${JSON.stringify(clientPayload)}`)
  // There is no try catch block here. All exceptions are bubbled up.
  if (action === 'ghas-enable') {
    return ghasEnable(clientPayload, policyManager, context, log)
  } else if (action === 'compliance-check') {
    return complianceCheck(clientPayload, policyManager, context, log)
  } else {
    log.debug(`Repo Dispatch ${JSON.stringify(action)} not valid for GHAS Compliance; skipping...`)
  }
}

async function complianceCheck (clientPayload, policyManager, context, log) {
  if (clientPayload.head_sha) {
    log.debug(`Creating a checkrun with the provided sha ${clientPayload.head_sha}`)
    return context.octokit.checks.create(
      context.repo({
        name: 'GHAS Compliance',
        head_branch: clientPayload.head_branch,
        head_sha: clientPayload.head_sha,
        started_at: new Date()
      })
    )
  } else {
    // Use the latest commit to create the check against
    log.debug(`Creating a checkrun with the latest commit for branch ${clientPayload.head_branch}`)
    return context.octokit.git.getRef(context.repo({ ref: `heads/${clientPayload.head_branch}` }))
      .then(res => {
        return context.octokit.checks.create(
          context.repo({
            name: 'GHAS Compliance',
            head_branch: clientPayload.head_branch,
            head_sha: res.data.object.sha,
            started_at: new Date()
          })
        )
      })
  }
}

async function ghasEnable (clientPayload, policyManager, context, log) {
  const ret = []
  let result = null
  if (clientPayload.createInitialCheck || await policyManager.createInitialCheck()) {
    result = await createInitialCheck(policyManager, context, log)
    ret.push(result)
    if (result.status === 'error') {
      return ret
    }
  } else {
    if (!await policyManager.createInitialCheck()) {
      log.debug('Skipping createInitialCheck runtime setting createInitialCheck=false')
      ret.push({ success: true, message: 'Skipping createInitialCheck runtime setting createInitialCheck=false' })
    }
  }

  if (clientPayload.createBranchProtection || await policyManager.createBranchProtection()) {
    result = await createBranchProtection(policyManager, context, log)
    ret.push(result)
    if (result.status === 'error') {
      return ret
    }
  } else {
    if (!await policyManager.createBranchProtection()) {
      log.debug('Skipping createBranchProtection runtime setting createBranchProtection=false')
      ret.push({ success: true, message: 'Skipping createBranchProtection runtime setting createBranchProtection=false' })
    }
  }

  if (clientPayload.enableAdvSec || await policyManager.enableAdvSec()) {
    result = await enableAdvSec(policyManager, context, log)
    ret.push(result)
    return ret
  } else {
    if (!await policyManager.enableAdvSec()) {
      log.debug('Skipping enableAdvSec runtime setting enableAdvSec=false')
      ret.push({ success: true, message: 'Skipping enableAdvSec runtime setting enableAdvSec=false' })
    }
  }

  return ret
}

// Create an initial check in the repo for GHAS Compliance.
async function createInitialCheck (policyManager, context, log) {
  const startTime = new Date()

  // Use the latest commit to create the check against
  return context.octokit.repos.listCommits(context.repo())
    .then(commits => {
      return context.octokit.checks.create(
        context.repo({
          name: 'GHAS Compliance',
          head_sha: commits.data[0].sha,
          status: 'completed',
          started_at: startTime,
          conclusion: 'success',
          completed_at: new Date(),
          output: {
            title: 'GHAS Compliance Report',
            summary: 'Initial Check',
            text: 'Initial scan will always pass'
          }
        })
      )
    })
    .then(res => {
      log.debug(`Created the initial check for GHAS compliance ${JSON.stringify(res)}`)
      return { success: true, message: 'Created the initial check for GHAS compliance' }
    }).catch(e => {
      if (e.status === 404) {
        return { success: false, message: `Repo Not found ${JSON.stringify(context.repo())}` }
      }
      log.error(`Initial Check for GHAS Compliance failed with ${JSON.stringify(e)}`)
      return { success: false, message: `Initial Check for GHAS Compliance failed with ${e.message}` }
    })
}

// Create branch protection with the GHAS compliance check
async function createBranchProtection (policyManager, context, log) {
  // Get default repo to get default branch
  const repo = await context.octokit.repos.get(context.repo())
  const params = Object.assign(context.repo(), { branch: repo.data.default_branch })
  Object.assign(params, protection, { headers: previewHeaders })
  return context.octokit.repos.updateBranchProtection(params).then(res => {
    log.debug(`Branch protection applied successfully ${JSON.stringify(res.url)}`)
    return { success: true, message: 'Branch protection applied successfully' }
  }).catch(e => {
    log.error(`Error applying branch protection ${JSON.stringify(e)}`)
    if (e.status === 404) {
      return { success: false, message: `Branch Not found for ${JSON.stringify(params)}` }
    }
    return { success: false, message: `Error applying branch protection ${e.message}` }
  })
}

// Enable GHAS on repo settings
async function enableAdvSec (policyManager, context, log) {
  const sec = {
    security_and_analysis: {
      advanced_security: {
        status: 'enabled'
      },
      secret_scanning: {
        status: 'enabled'
      },
      secret_scanning_push_protection: {
        status: 'enabled'
      }
    }
  }
  const params = Object.assign(context.repo(), sec)
  return context.octokit.repos.update(params).then(res => {
    log.debug(`Advanced Security turned on successfully ${JSON.stringify(res.url)}`)
    return { success: true, message: 'Advanced Security turned on successfully' }
  }).catch(e => {
    log.debug(`Error enabling Advanced Security ${JSON.stringify(e)}`)
    return { success: false, message: `Error enabling Advanced Security ${e.message}` }
  })
}
module.exports = { handleRepoDispatch }
