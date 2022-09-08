const PolicyManager = require('./policyManager')
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
        if (repoTopics.length > 0 ) {
          return completeCheckRun(context, 'completed', 'success', {
            title: 'GHAS Compliance Report',
            summary: `Skipped GHAS Compliance check because repo topics contains: ${bypassTopics}`,
            text: 'GHAS Compliance check will be skipped'
          })
        } else {
          return executeGHASComplianceCheck(policyManager, context, log)
        }
      })
    } else {
      return executeGHASComplianceCheck(policyManager, context, log)
    }
  }
}

// Run the GHAS compliance check
async function executeGHASComplianceCheck (policyManager, context, log) {
  // log.debug(`Processing Check run request for ${context.payload.check_run.name} id: ${context.payload.check_run.id}`)

  const pullRequest = context.payload.check_run.check_suite.pull_requests[0]

  if (!pullRequest) {
    log.debug(`No pull request found for ${JSON.stringify(context.payload.check_run)}`)

    return completeCheckRun(context, 'completed', 'failure', {
      title: 'GHAS Compliance Report',
      summary: 'Incorrect Invocation',
      text: `No pull request found for ${JSON.stringify(context.payload.check_run)}`
    })
  }

  await context.octokit.checks.update({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    check_run_id: context.payload.check_run.id,
    status: 'in_progress',
    started_at: new Date()
  })

  // Wait till all the checks have completed
  await waitForChecks(policyManager, log, context, pullRequest)

  const policyPath = await policyManager.getPolicyPath()
  const policy = await policyManager.getPolicy()

  let conclusion = 'success'
  let summary = 'No non-compliant alerts were found'
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

  return secretScanningAlerts(policyManager, pullRequest, context, log).then((res) => {
    // Check for appropriate Secret Scanning Alerts
    if (res.length > 0) {
      const url = `https://github.com/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/secret-scanning?query=is:open`
      conclusion = 'failure'
      summary = 'Non-compliant alerts were found'
      headers.push(`
${res.length} secret scanning alert(s) affecting this repo.
[View Secret Scanning Alerts](${encodeURI(url)})`
      )
      pushSecretAlertsToAnnotations(annotations, res)
    }
    log.debug(JSON.stringify(annotations))
    return codeScanningAlerts(policyManager, pullRequest, context, log)
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
      pushCodeAlertsIntoAnnotations(annotations, filteredAlerts)
    }

    const text = headers.join('\n')
    log.debug(JSON.stringify({
      conclusion,
      title: 'GHAS Compliance Report',
      summary,
      text,
      annotations
    }, null, 2))

    return completeCheckRun(context, 'completed', conclusion, {
      title: 'GHAS Compliance Report',
      summary,
      text,
      annotations
    })
  }).catch(e => {
    log.error(`Error ${e}`)
    return completeCheckRun(context, 'completed', 'failure', {
      title: 'GHAS Compliance Report',
      summary: `${e}`,
      text: `${e}`
    })
  })
}

async function waitForChecks (policyManager, log, context, pullRequest) {
  let hasChecksToProcess = false
  do {
    // Arbitrary time to wait for CodeQL Scans
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    const snoozetime = await policyManager.getSnooze()
    log.debug(`Snoozing for ${snoozetime} secs for other checks to complete`)
    await snooze(snoozetime * 1000)

    const _ = await context.octokit.checks.listForRef(
      context.repo({ ref: pullRequest.head.ref })
    )
    const checks = _.data.check_runs
    const pendingChecks = checks.filter(check => {
      // log.debug(`Check run  ${check.id} ${check.status}`)
      return check.id !== context.payload.check_run.id && check.status !== 'completed'
    })
    hasChecksToProcess = pendingChecks.length > 0
  } while (hasChecksToProcess)
}

function pushSecretAlertsToAnnotations (annotations, res) {
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

function pushCodeAlertsIntoAnnotations (annotations, filteredAlerts) {
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

async function codeScanningAlerts (policyManager, pullRequest, context, log) {
  // Check if there is an analysis for that sha
  let analysisFound = false
  return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/analyses',
    context.repo({ ref: `refs/heads/${pullRequest.head.ref}` })
    // Other Options
    // context.repo({ ref: `refs/heads/${pullRequest.number}/merge` })
    // context.repo()
  ).then(res => {
    // log.debug(`After getting codescanning analysis for the branch ${JSON.stringify(res)}`)
    const analysis = res.data

    for (const anal of analysis) {
      if (anal.commit_sha.startsWith(pullRequest.head.sha)) {
        analysisFound = true
        break
      }
    }
    // Fail the check if the analysis is not found for the latest commit
    if (!analysisFound) {
      return completeCheckRun(context, 'completed', 'failure', {
        title: 'GHAS Compliance Report',
        summary: `No Analysis found for the tool the PullRequest Number ${pullRequest.number}, Branch ${pullRequest.head.ref}, and Commit ${pullRequest.head.sha}`,
        text: 'Please upload the codescanning results for the latest commit of the branch. Analysis found only for sha'
      })
    }
    return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts',
      context.repo({ ref: `refs/heads/${pullRequest.head.ref}` })
    )
  }).then(res => {
    if (!analysisFound) {
      return
    }

    const filteredAlerts = policyManager.filterRelevantAlerts(res.data)
    return { allAlerts: res.data, filteredAlerts }
  })
}

async function secretScanningAlerts (policyManager, pullRequest, context, log) {
  return context.octokit.request('GET /repos/{owner}/{repo}/secret-scanning/alerts',
    context.repo({ state: 'open' })
  ).then(res => {
    log.debug(`After getting secret scanning alerts ${JSON.stringify(res.data)}`)
    return res.data
  }).catch(e => {
    if (e.status === 404) {
      log.error(`Error ${e}`)
      return completeCheckRun(context, 'completed', 'failure', {
        title: 'GHAS Compliance Report',
        summary: `${e.message}`,
        text: `${e.message}`
      })
    } else {
      log.error(e)
    }
  })
}

module.exports = { handleCheckRun }
