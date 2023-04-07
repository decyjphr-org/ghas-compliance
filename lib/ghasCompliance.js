const EnvHelper = require('./envHelper')
// Run the GHAS compliance check
const title = 'GitHub Advanced Security: Policy Compliance'
const summaryError = ':x: Policy Failing alert(s)/issue(s) identified.'
const summarySuccess = '✅ No Policy Failing alert(s)/issue(s) were identified.'
const completedStatus = 'completed'
const failureConclusion = 'failure'
const githubDotcom = 'https://github.com'
const confluenceHost = 'https://confluence.fmr.com'
const successStr = 'success'

async function executeGHASComplianceCheck (policyManager, context, log, ref, sha) {
  await context.octokit.checks.update({
    owner: context.payload.repository.owner.login,
    repo: context.payload.repository.name,
    check_run_id: context.payload.check_run.id,
    status: 'in_progress',
    started_at: new Date()
  })

  const policy = await policyManager.getPolicy()
  const codealertsurl = `${githubDotcom}/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/code-scanning?query=branch:${ref}+tool:CodeQL+is:open`
  const secretalertsurl = `${githubDotcom}/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/secret-scanning?query=is:open`
  const issuesurl = `${githubDotcom}/${context.payload.repository.owner.login}/${context.payload.repository.name}/issues`
  const hwyurl = `${confluenceHost}/pages/viewpage.action?pageId=1086687867`
  const ssdlcurl = `${confluenceHost}/display/ECSAPPSECSERVICES/Contact+SSDLC+Team`
  let conclusion = successStr
  let summary = summarySuccess
  const annotations = []
  let secretsTableStr = ''
  let codeAlertsTableStr = ''
  const policyViolationsHeader = `

  ---
  | __Policy Violations__ |
  |--| 
  `
  const headers = []
  headers.push(`

---
## SUMMARY
### Policy
The following findings are considered Policy Failing and must be addressed to release to production, refer to [Highway](${hwyurl}) for more details of Security Policy based on application type.

**Code Scanning**
- ${policy.codescanning.level.substr(0, 1).toUpperCase().concat(policy.codescanning.level.slice(1))} Severity Code Scanning Alerts
- Cross Site Scripting (XSS) / Cross Site Request Forgery (CSRF) Related Code Scanning Alerts
- Specific CWEs regardless of severity (refer to [Highway](${hwyurl}) for details)

**Secret Scanning**
- Standard Secrets Scanning Alerts (aka Secret type = Service providers) must be fixed
- Custom Secrets Scanning Alerts (aka Secret type = Custom patterns) must be reviewed and fixed/dismissed as appropriate

**Software Composition Analysis (SCA)**
- Security Vulnerability issue(s) with CVSS score of 8.1 or higher
- License Policy Violation issue(s)

### Results

[View All Secret Scanning Alerts](${encodeURI(secretalertsurl)})
[View All Code Scanning Alerts](${encodeURI(codealertsurl)})
[View All Software Composition Analysis Issues](${encodeURI(issuesurl)})
Reach out to [SSDLC](${ssdlcurl}) team for guidance, as needed.

---

## POLICY FAILING ALERTS

`)

  let filteredSecrets = []
  let filteredAlerts  = []
  let maxAlerts = EnvHelper.getEnv().maxAlerts

  return secretScanningAlerts(policyManager, context, log).then((res) => {
    // process if there are secrets based on policy
    filteredSecrets  = res.filteredSecrets
    if (filteredSecrets.length > 0) {
      log.info(`Non-compliant Secret scanning alert(s) affecting this repo ${JSON.stringify(filteredSecrets.map(alert => alert.secret_type_display_name), null, 2)}`)

      conclusion = failureConclusion
      summary = summaryError
      headers.push(`
${filteredSecrets.length} secret scanning alert(s) affecting this repo.`
      )

      if (filteredSecrets.length > maxAlerts) {
        log.info(`The number of Secret scanning alerts exceeds the maximum number (\`${EnvHelper.getEnv().maxAlerts}\`) of alerts that can be displayed in the check run.`)

        headers.push(`
**The number of Secret scanning alerts exceeds the maximum number (\`${EnvHelper.getEnv().maxAlerts}\`) of alerts that can be displayed in the check run.** 
**The first \`${EnvHelper.getEnv().maxAlerts}\` alerts are shown below.**
**Please visit the [Secret Scanning Alerts](${encodeURI(secretalertsurl)}) [Code Scanning Alerts](${encodeURI(codealertsurl)}) page to view all alerts.**`)
        
        filteredSecrets = filteredSecrets.slice(0, maxAlerts)
        maxAlerts = 0
      } else {
        maxAlerts = maxAlerts - filteredSecrets.length
      }

      secretsTableStr = pushSecretAlertsToTable(filteredSecrets)
    }
    return codeScanningAlerts(policyManager, ref, sha, context, log)
  }).then(res => {
    if (!res.analysisFound) {
      summary = summaryError
      conclusion = failureConclusion
      headers.push(`
No Analysis found for tool CodeQL for the Branch ${ref}, and Commit ${sha}`)
    }
    filteredAlerts  = res.filteredAlerts

    // Check for appropriate GHAS Alerts
    if (filteredAlerts.length > 0) {
      log.debug(`Non-compliant Code scanning alert(s) affecting this branch ${JSON.stringify(filteredAlerts.map(alert => alert.rule.description), null, 2)}`)

      conclusion = failureConclusion
      summary = summaryError
      headers.push(`
${filteredAlerts.length} Non-compliant Code scanning alert(s) affecting this branch.`
      )

      if (filteredAlerts.length > maxAlerts) {
        log.info(`The number ofSecret Scanning and Code scanning alerts exceeds the maximum number (\`${EnvHelper.getEnv().maxAlerts}\`) of alerts that can be displayed in the check run.`)

        headers.push(`
**The number of Secret Scanning and Code scanning alerts exceeds the maximum number (\`${EnvHelper.getEnv().maxAlerts}\`) of alerts that can be displayed in the check run.** 
**The first \`${EnvHelper.getEnv().maxAlerts}\` alerts are shown below.**
**Please visit the [Secret Scanning Alerts](${encodeURI(secretalertsurl)}) [Code Scanning Alerts](${encodeURI(codealertsurl)}) page to view all alerts.**`)

        filteredAlerts = filteredAlerts.slice(0, maxAlerts)
      } 
      if (filteredAlerts.length > 0) {
        codeAlertsTableStr = pushCodeScanningAlertsToTable(filteredAlerts)
      }
    }

    if (conclusion === failureConclusion && (secretsTableStr.length > 0 || codeAlertsTableStr.length > 0)) {
      summary = summary.concat(headers.join('\n')).concat(policyViolationsHeader).concat(secretsTableStr).concat(codeAlertsTableStr)
    } else {
      summary = summary.concat(headers.join('\n'))
    }

    return completeCheckRun(context, completedStatus, conclusion, {
      title,
      summary,
      annotations
    })
  }).catch(e => {
    log.error(`Unknown error while checking codescanning alerts for compliance ${e}`)
    return completeCheckRun(context, completedStatus, failureConclusion, {
      title,
      summary: `${e}`
    })
  })
}

function pushSecretAlertsToTable (res) {
  const header = ''
  return res.reduce((accumulator, alert) => `${accumulator}|🚫 __[${alert.secret_type_display_name}](${alert.html_url})__ \`${alert.secret.slice(0, 5)}...\` __·__ opened on ${alert.created_at} |
`, header)
}

function pushCodeScanningAlertsToTable (res) {
  const header = ''
  return res.reduce((accumulator, alert) => `${accumulator}|🚫 __[${alert.rule.description.replace(/(?:\r\n|\r|\n)/g, '<br>')}](${alert.html_url})__ \`${alert.most_recent_instance.message.text.replace(/(?:\r\n|\r|\n)/g, '<br>')}\` __·__ opened on ${alert.created_at} |
`, header)
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
  const policy =  await policyManager.getPolicy()
  log.debug('Checking policy for code scanning alerts')
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
    return context.octokit.paginate('GET /repos/{owner}/{repo}/code-scanning/alerts',
      context.repo({ ref: `refs/heads/${ref}`, per_page: 100 })
    )
    // const promises = []
    // for (const tool of policy.codescanning.tools) {
    //   const fetchAlert = context.octokit.paginate('GET /repos/{owner}/{repo}/code-scanning/alerts',
    //     context.repo({ tool_name: tool, ref: `refs/heads/${ref}`, per_page: 100 })
    //   ).then(res => {
    //     return res
    //   })
    //   promises.push(fetchAlert)
    // }

    // return Promise.all(promises).then(res => {
    //   return res.flat()
    // })
  }).then(res => {
    if (!analysisFound) {
      return { analysisFound, allAlerts: [], filteredAlerts: [] }
    }

    const filteredAlerts = policyManager.filterRelevantAlerts(res)
    return { analysisFound, allAlerts: res, filteredAlerts }
  })
}

async function secretScanningAlerts (policyManager, context, log) {
  log.debug('Checking policy for secret scanning alerts')
  return context.octokit.paginate('GET /repos/{owner}/{repo}/secret-scanning/alerts',
    context.repo({ state: 'open', per_page: 100 })
  ).then(res => {
    // Filter only relevant secrets by policy
    const filteredSecrets = policyManager.filterRelevantSecrets(res)
    return { allSecrets: res, filteredSecrets }
  }).catch(e => {
    if (e.status === 404) {
      log.error(`Not found error checking for secret scanning alerts ${e}`)
      return completeCheckRun(context, 'completed', 'failure', {
        title,
        summary: `${e.message}`,
        text: `${e.message}`
      })
    } else {
      log.error(`Unknown error checking for secret scanning alerts ${e}`)
    }
  })
}

module.exports = executeGHASComplianceCheck
