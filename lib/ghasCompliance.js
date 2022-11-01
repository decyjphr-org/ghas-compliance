// const PolicyManager = require('./policyManager')
// Run the GHAS compliance check
const title = 'GitHub Advanced Security: Fidelity Policy Compliance'
const summaryError = ':x: Policy Failing alert(s) affecting this branch were identified.'
async function executeGHASComplianceCheck (policyManager, context, log, ref, sha) {
  // log.debug(`Processing Check run request for ${context.payload.check_run.name} id: ${context.payload.check_run.id}`)

  await context.octokit.checks.update({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    check_run_id: context.payload.check_run.id,
    status: 'in_progress',
    started_at: new Date()
  })

  // Wait till all the checks have completed
  await waitForChecks(policyManager, log, context, ref)
  const policy = await policyManager.getPolicy()
  const codealertsurl = `https://github.com/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/code-scanning?query=branch:${ref}+tool:CodeQL+is:open`
  const secretalertsurl = `https://github.com/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/secret-scanning?query=is:open`

  let conclusion = 'success'
  let summary = '✅ No Policy Failing alert(s) affecting this branch were identified.'
  const annotations = []
  const headers = []
  headers.push(`

---
### SUMMARY
#### Policy
The following findings are considered Policy Failing and must be addressed:

- Severity \`${policy.codescanning.level}\` Code Scanning Alerts.

- Code Scanning Alerts: _${policy.codescanning.conditions.ids}_

- Secret Scanning Alerts (Hard-coded credentials) 

- The specific CWES:
  <details>
  <summary>
  Expand for details:
  </summary>
  ${policy.codescanning.conditions.cwes.join('\t')}
  </details>

#### Results

[View All Secret Scanning Alerts](${encodeURI(secretalertsurl)})
[View All Code Scanning Alerts](${encodeURI(codealertsurl)})
Reach out to [SSDLC]() team for guidance, as needed.

---

### POLICY FAILING ALERTS

`)

  return secretScanningAlerts(policyManager, context, log).then((res) => {
    // process if there are secrets based on policy
    const { filteredSecrets } = res
    if (filteredSecrets.length > 0) {
      conclusion = 'failure'
      summary = summaryError
      headers.push(`
${filteredSecrets.length} secret scanning alert(s) affecting this repo.`
      )
      pushSecretAlertsToAnnotations(annotations, filteredSecrets)
    }
    log.debug(JSON.stringify(annotations))
    return codeScanningAlerts(policyManager, ref, sha, context, log)
  }).then(res => {
    if (!res.analysisFound) {
      summary = summaryError
      conclusion = 'failure'
      headers.push(`
No Analysis found for tool CodeQL for the Branch ${ref}, and Commit ${sha}`)
    }
    const { filteredAlerts } = res

    // Check for appropriate GHAS Alerts
    if (filteredAlerts.length > 0) {
      conclusion = 'failure'
      summary = summaryError
      headers.push(`
${filteredAlerts.length} Non-compliant Code scanning alert(s) affecting this branch.`
      )
      pushCodeAlertsIntoAnnotations(annotations, filteredAlerts)
    }

    summary = summary.concat(headers.join('\n'))
    log.debug(JSON.stringify({
      conclusion,
      title,
      summary,
      annotations
    }, null, 2))

    return completeCheckRun(context, 'completed', conclusion, {
      title,
      summary,
      annotations
    })
  }).catch(e => {
    log.error(`Error ${e}`)
    return completeCheckRun(context, 'completed', 'failure', {
      title,
      summary: `${e}`
    })
  })
}

async function waitForChecks (policyManager, log, context, ref) {
  let hasChecksToProcess = false
  do {
    // Arbitrary time to wait for CodeQL Scans
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    const snoozetime = await policyManager.getSnooze()
    log.debug(`Snoozing for ${snoozetime} secs for other checks to complete`)
    await snooze(snoozetime * 1000)

    const _ = await context.octokit.checks.listForRef(
      context.repo({ ref })
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

async function codeScanningAlerts (policyManager, ref, sha, context, log) {
  // Check if there is an analysis for that sha
  let analysisFound = false
  return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/analyses',
    context.repo({ ref: `refs/heads/${ref}` })
    // Other Options
    // context.repo({ ref: `refs/heads/${pullRequest.number}/merge` })
    // context.repo()
  ).then(res => {
    // log.debug(`After getting codescanning analysis for the branch ${JSON.stringify(res)}`)
    const analysis = res.data

    for (const anal of analysis) {
      if (anal.commit_sha.startsWith(sha)) {
        analysisFound = true
        break
      }
    }
    // Fail the check if the analysis is not found for the latest commit
    if (!analysisFound) {
      log.debug(` No analysis found for ${sha} Failing the checkrun ... `)
      return
    }
    return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts',
      context.repo({ ref: `refs/heads/${ref}` })
    )
  }).then(res => {
    if (!analysisFound) {
      return { analysisFound, allAlerts: [], filteredAlerts: [] }
    }

    const filteredAlerts = policyManager.filterRelevantAlerts(res.data)
    return { analysisFound, allAlerts: res.data, filteredAlerts }
  })
}

async function secretScanningAlerts (policyManager, context, log) {
  return context.octokit.request('GET /repos/{owner}/{repo}/secret-scanning/alerts',
    context.repo({ state: 'open' })
  ).then(res => {
    log.debug(`After getting secret scanning alerts ${JSON.stringify(res.data)}`)

    // Filter only relevant secrets by policy
    const filteredSecrets = policyManager.filterRelevantSecrets(res.data)
    return { allSecrets: res.data, filteredSecrets }
  }).catch(e => {
    if (e.status === 404) {
      log.error(`Error ${e}`)
      return completeCheckRun(context, 'completed', 'failure', {
        title,
        summary: `${e.message}`,
        text: `${e.message}`
      })
    } else {
      log.error(e)
    }
  })
}

module.exports = executeGHASComplianceCheck
