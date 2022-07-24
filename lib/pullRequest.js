// Handler to pull_request opened or reopened
// Create a check when check_suite has been created
async function handlePull (context) {
  const {
    ref: headBranch,
    sha: headSha
  } = context.payload.pull_request.head
  // app.log.info(`Pull request opened ${JSON.stringify(context.payload.pull_request)}`)
  return context.octokit.checks.create(
    context.repo({
      name: 'GHAS Compliance',
      head_branch: headBranch,
      head_sha: headSha,
      started_at: new Date()
    })
  )
}
module.exports = { handlePull }
