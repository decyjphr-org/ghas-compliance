
// Handler to check_suite
// Create a check when check_suite has been created
async function handleCheckSuite (context, log) {
  const {
    head_branch: headBranch,
    head_sha: headSha
  } = context.payload.check_suite
  return context.octokit.checks.create(
    context.repo({
      name: 'GHAS Compliance',
      head_branch: headBranch,
      head_sha: headSha,
      started_at: new Date()
    })
  )
  // return context.octokit.repos.getAllTopics(context.repo()).then(res => {
  //   if (res.data.names.find(x => x === 'ncnia')) {
  //     return context.octokit.checks.create(
  //       context.repo({
  //         name: 'GHAS Compliance',
  //         head_branch: headBranch,
  //         head_sha: headSha,
  //         status: 'completed',
  //         started_at: new Date(),
  //         conclusion: 'success',
  //         completed_at: new Date(),
  //         output: {
  //           title: 'GHAS Compliance Report',
  //           summary: 'NCNIA App',
  //           text: 'GHAS Compliance check will be skipped'
  //         }
  //       })
  //     )
  //   } else {
  //     return context.octokit.checks.create(
  //       context.repo({
  //         name: 'GHAS Compliance',
  //         head_branch: headBranch,
  //         head_sha: headSha,
  //         started_at: new Date()
  //       })
  //     )
  //   }
  // })
}
module.exports = { handleCheckSuite }
