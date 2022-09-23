
// Handler to check_suite
// Create a check when check_suite has been created
async function handleCheckSuite (context, log) {
  const {
    head_branch: headBranch,
    head_sha: headSha,
    pull_requests: pullRequests
  } = context.payload.check_suite

  if (!Array.isArray(pullRequests) || !pullRequests[0]) {
    log.debug(`No pull request found for ${JSON.stringify(context.payload.check_run)}`)
    return
  }

  return context.octokit.checks.create(
    context.repo({
      name: 'GHAS Compliance',
      head_branch: headBranch,
      head_sha: headSha,
      started_at: new Date()
    })
  )
}
module.exports = { handleCheckSuite }
