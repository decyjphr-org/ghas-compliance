const PolicyManager = require('./policyManager')
const executeGHASComplianceCheck = require('./ghasCompliance')
// Handler to check_run
// Execute GHAS compliance check
async function handleCheckRun (context, log) {
  if (context.payload.check_run.name !== 'GHAS Compliance') {
    // log.debug(`I am not the handler for '${context.payload.check_run.name}' skipping...`)
    return
  }
  log.debug(`Received a Check run request for ${context.payload.check_run.name}`)
  const policyManager = new PolicyManager(context, log)
  const bypassTopics = await policyManager.getTopics()

  const checkSuite = context.payload.check_run.check_suite
  if (!checkSuite) {
    log.debug(`No Check Suite request found for ${JSON.stringify(context.payload.check_run)}`)
    return completeCheckRun(context, 'completed', 'failure', {
      title: 'GHAS Compliance Report',
      summary: 'Incorrect Invocation',
      text: `No Check Suite found for ${JSON.stringify(context.payload.check_run)}`
    })
  }
  const ref = checkSuite.head_branch
  const sha = checkSuite.head_sha

  // The intitial checkrun would be completed status. Process only if it is not or it is a rerequest
  if (context.payload.action === 'rerequested' || context.payload.check_run.status !== 'completed') {
    if (await policyManager.skipCheckAlways()) {
      log.debug('Skipped GHAS Compliance check because runtime settings: skipCheckAlways=true')
      return completeCheckRun(context, 'completed', 'success', {
        title: 'GHAS Compliance Report',
        summary: 'Skipped GHAS Compliance check because runtime settings: skipCheckAlways=true',
        text: 'GHAS Compliance check will be skipped'
      })
    }
    if (bypassTopics.length > 0) {
      return context.octokit.repos.getAllTopics(context.repo()).then(res => {
        const repoTopics = res.data.names.filter(topic => bypassTopics.includes(topic))
        if (repoTopics.length > 0) {
          return completeCheckRun(context, 'completed', 'success', {
            title: 'GHAS Compliance Report',
            summary: `Skipped GHAS Compliance check because repo topics contains: ${bypassTopics}`,
            text: 'GHAS Compliance check will be skipped'
          })
        } else {
          return executeGHASComplianceCheck(policyManager, context, log, ref, sha)
        }
      })
    } else {
      return executeGHASComplianceCheck(policyManager, context, log, ref, sha)
    }
  }
}

async function completeCheckRun (context, status, conclusion, output) {
  return context.octokit.checks.update({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    check_run_id: context.payload.check_run.id,
    name: 'GHAS Compliance',
    status,
    conclusion,
    completed_at: new Date(),
    output
  })
}

module.exports = { handleCheckRun }
