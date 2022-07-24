const Glob = require('./glob')
const PolicyManager = require('./policyManager')
const levels = ['notes', 'warning', 'low', 'moderate', 'medium', 'error', 'high', 'critical']
// Handler to check_run
// Execute GHAS compliance check
async function handleCheckRun (context, log) {
  log.debug(`Received a Check run request for ${context.payload.check_run.name}`)
  if (context.payload.check_run.name !== 'GHAS Compliance') {
    log.debug(`I am not the handler for '${context.payload.check_run.name}' skipping...`)
    return
  }
  // The intitial checkrun would be completed status. Process only if it is not or it is a rerequest
  if (context.payload.action === 'rerequested' || context.payload.check_run.status !== 'completed') {
    return context.octokit.repos.getAllTopics(context.repo()).then(res => {
      if (res.data.names.find(x => x === 'ncnia')) {
        return context.octokit.checks.update(
          context.repo({
            name: 'GHAS Compliance',
            status: 'completed',
            started_at: new Date(),
            conclusion: 'success',
            check_run_id: context.payload.check_run.id,
            completed_at: new Date(),
            output: {
              title: 'GHAS Compliance Report',
              summary: 'NCNIA App',
              text: 'GHAS Compliance check will be skipped'
            }
          })
        )
      } else {
        return executeGHASComplianceCheck(context, log)
      }
    })
  }
}

// Run the GHAS compliance check
async function executeGHASComplianceCheck (context, log) {
  log.debug(`Processing Check run request for ${context.payload.check_run.name} id: ${context.payload.check_run.id}`)

  const pullRequest = context.payload.check_run.check_suite.pull_requests[0]

  if (!pullRequest) {
    log.debug(`No pull request found for ${JSON.stringify(context.payload.check_run)}`)
    return context.octokit.checks.update({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      check_run_id: context.payload.check_run.id,
      status: 'completed',
      conclusion: 'failure',
      completed_at: new Date(),
      output: {
        title: 'Incorrect Invocation',
        summary: `No pull request found for ${JSON.stringify(context.payload.check_run)}`
      }
    })
  }

  context.octokit.checks.update({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    check_run_id: context.payload.check_run.id,
    status: 'in_progress',
    started_at: new Date()
  })

  // Wait till all the checks have completed
  let hasChecksToProcess = false
  do {
    const _ = await context.octokit.checks.listForRef(
      context.repo({ ref: pullRequest.head.ref })
    )
    // Arbitrary time to wait for CodeQL Scans
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    // const snoozetime = Math.random() * 100
    const snoozetime = 10
    log.debug(`Waiting for ${snoozetime} secs for code scanning to complete`)
    await snooze(snoozetime * 1000)
    // log.debug(`Waiting for pending checks to complete ${_.data.total_count}`)
    const checks = _.data.check_runs
    const pendingChecks = checks.filter(check => {
      // log.debug(`Check run  ${check.id} ${check.status}`)
      return check.id !== context.payload.check_run.id && check.status !== 'completed'
    })
    hasChecksToProcess = pendingChecks.length > 0
  } while (hasChecksToProcess)

  let policyPath = await context.config('policyconfig.yml')

  if (!policyPath || !policyPath.repo) {
    policyPath = { owner: 'GeekMasher', repo: 'security-queries', path: 'policies/low.yml', ref: 'main' }
  }

  const policyManager = new PolicyManager(context, log, policyPath)
  const policy = await policyManager.getPolicy()

  let conclusion = 'success'
  let summary = 'No non-compliant code scanning alerts were found'
  const annotations = []
  const headers = []
  const details = []
  headers.push(`
  <details>
  <summary>
  Compliance Policy Location:
  </summary>
  ${JSON.stringify(policyPath, null, 4)}
  </details>
  <details>
  <summary>
  Compliance Policy Details:
  </summary>
  ${JSON.stringify(policy, null, 4)}
  </details>`)

  secretScanningAlerts(policy, pullRequest, context, log).then((res) => {
    // Check for appropriate GHAS Alerts
    // Check for appropriate GHAS Alerts
    if (res.length > 0) {
      const url = `https://github.com/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/secret-scanning?query=is:open`
      conclusion = 'failure'
      summary = 'Non-compliant alerts were found'
      headers.push(`
${res.length} secret scanning alert(s) affecting this repo.
[View Secret Scanning Alerts](${encodeURI(url)})`
      )

      annotations.push(...res.map(alert => {
        return {
          path: 'alert.most_recent_instance.location.path',
          annotation_level: 'failure',
          title: `Secret detected of type ${alert.secret_type_display_name}`,
          message: `Secret detected = ${alert.secret}`,
          raw_details: alert.secret,
          start_line: 0,
          end_line: 10
        }
      }))
    }
    log.debug(JSON.stringify(annotations))
    return codeScanningAlerts(policy, pullRequest, context, log)
  }).then(res => {
    const { filteredAlerts } = res
    const { allAlerts } = res
    const url = `https://github.com/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/code-scanning?query=pr:${pullRequest.number}+tool:CodeQL+is:open`

    // Check for appropriate GHAS Alerts
    if (filteredAlerts.length > 0) {
      conclusion = 'failure'
      summary = 'Non-compliant alerts were found'
      headers.push(`
${allAlerts.length} Code scanning alert(s) affecting this branch.
${filteredAlerts.length} Non-compliant Code scanning alert(s) affecting this branch.
[View Code Scanning Alerts](${encodeURI(url)})`
      )
      details.push(`
<details>
  <summary>
  Compliance Policy Location:
  </summary>
  ${JSON.stringify(policyPath, null, 4)}
</details>
<details>
  <summary>
  Compliance Policy Details:
  </summary>
  ${JSON.stringify(policy, null, 4)}
</details>`)
      annotations.push(...filteredAlerts.map(alert => {
        return {
          path: alert.most_recent_instance.location.path,
          annotation_level: 'failure',
          title: alert.rule.description,
          message: alert.most_recent_instance.message.text,
          raw_details: alert.rule.description,
          start_line: alert.most_recent_instance.location.start_line,
          end_line: alert.most_recent_instance.location.end_line
        }
      }))
    }
    log.debug(JSON.stringify(annotations))

    const text = headers.join('\n')
    const _ = {
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      check_run_id: context.payload.check_run.id,
      status: 'completed',
      conclusion,
      completed_at: new Date(),
      output: {
        title: 'GHAS Compliance Report',
        summary,
        text,
        annotations
      }
    }
    console.log(`${JSON.stringify(_)}`)
    return context.octokit.checks.update({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      check_run_id: context.payload.check_run.id,
      status: 'completed',
      conclusion,
      completed_at: new Date(),
      output: {
        title: 'GHAS Compliance Report',
        summary,
        text,
        annotations
      }
    })
  }).catch(e => {
    if (e.status === 404) {
      return context.octokit.checks.update({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        check_run_id: context.payload.check_run.id,
        status: 'completed',
        conclusion: 'failure',
        completed_at: new Date(),
        output: {
          title: 'GHAS Compliance Report',
          summary: `No Analysis found for the PullRequest Number ${pullRequest.number} and Branch ${pullRequest.head.ref}`,
          text: 'Please set up codescanning for the branch'
        }
      })
    } else {
      console.log(e)
    }
  })
}

async function codeScanningAlerts (policy, pullRequest, context, log) {
  const filteredLevels = levels.slice(levels.indexOf(policy.codescanning.level))

  return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/analyses',
    // context.repo({ ref: `refs/heads/${pullRequest.number}/merge` })
    context.repo({ ref: `refs/heads/${pullRequest.head.ref}` })
  ).then(res => {
    log.debug(`After getting codescanning analysis for the branch ${JSON.stringify(res)}`)
    const analysis = res.data

    // Check if there is an analysis for that sha
    let analysisFound = false
    for (const anal of analysis) {
      // if (anal.tool.name === 'CodeQL') {
      if (anal.commit_sha.startsWith(pullRequest.head.sha)) {
        analysisFound = true
        break
      }
      // }
    }

    // Fail the check if the analysis is not found for the latest commit
    if (!analysisFound) {
      return context.octokit.checks.update({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        check_run_id: context.payload.check_run.id,
        status: 'completed',
        conclusion: 'failure',
        completed_at: new Date(),
        output: {
          title: 'GHAS Compliance Report',
          summary: `No Analysis found for the tool the PullRequest Number ${pullRequest.number}, Branch ${pullRequest.head.ref}, and Commit ${pullRequest.head.sha}`,
          text: `Please upload the codescanning results for the latest commit of the branch. Analysis found only for sha ${anal.commit_sha}`
        }
      })
    }
    return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts',
      context.repo({ ref: `refs/heads/${pullRequest.head.ref}` })
    )
  }).then(res => {
    // log.debug(`After getting codescanning alerts for the branch ${JSON.stringify(res)}`)
    // filter open and errors
    const filteredAlertsByLevel = res.data.filter(alert => {
      // return alert.state === 'open' && (alert.rule.security_severity_level === 'critical' || alert.rule.security_severity_level === 'high')
      return alert.state === 'open' && filteredLevels.indexOf(alert.rule.security_severity_level) > -1
    })
    console.log(`+++ ${filteredAlertsByLevel}`)
    const filteredAlertsByConditions = res.data.filter(alert => {
      // return alert.state === 'open' && (alert.rule.security_severity_level === 'critical' || alert.rule.security_severity_level === 'high')
      const f = policy.codescanning.conditions.ids.filter(id => {
        console.log(`=== ${id} ${alert.rule.id}`)
        const pattern = new Glob(id)
        return alert.state === 'open' && (alert.rule.id.search(pattern) >= 0)
      })
      return f.length > 0
    })
    console.log(`--- ${filteredAlertsByConditions}`)
    const filteredAlerts = filteredAlertsByConditions.concat(filteredAlertsByLevel)
    return { allAlerts: res.data, filteredAlerts }
  })
}

async function secretScanningAlerts (policy, pullRequest, context, log) {
  // const filteredLevels = levels.slice(levels.secretscanningindexOf(policy.secretscanning.level))

  return context.octokit.request('GET /repos/{owner}/{repo}/secret-scanning/alerts',
    context.repo({ state: 'open' })
  ).then(res => {
    log.debug(`After getting secret scanning alerts ${JSON.stringify(res.data)}`)
    return res.data
  })
}

module.exports = { handleCheckRun }
