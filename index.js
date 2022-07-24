const { handleCheckSuite } = require('./lib/checkSuite')
const { handlePull } = require('./lib/pullRequest')
const { handleCheckRun } = require('./lib/checkRun')
const { handleCodeScanningAlert } = require('./lib/codeScanningAlert')

// Probot App to enable GHAS and set up GHAS Compliance checks
// For more information on probot apps:
// https://probot.github.io/docs/
// To get your app running against GitHub, see:
// https://probot.github.io/docs/development/
/**
 * This is the main entrypoint
 * @param {import('probot').Probot} app
 */
module.exports = (app, { getRouter }) => {
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

  // Webhook events that are being listened to
  app.on(['check_suite.requested', 'check_suite.rerequested'], handleCheckSuite)
  app.on(['pull_request.opened', 'pull_request.reopened'], handlePull)
  app.on(['check_run.created', 'check_run.rerequested'], (context) => { return handleCheckRun(context, app.log) })
  app.on(['repository_dispatch'], handleRepoDispatch)
  app.on(['code_scanning_alert.closed_by_user'], (context) => { return handleCodeScanningAlert(context, app.log) })

  // app.onAny(anything)

  // async function anything (context) {
  //   console.log(`Received ${context.name} action:${JSON.stringify(context.payload.action)} sender:${JSON.stringify(context.payload.sender.login)}`)
  // }

  // Provide an API endpoint for non-webhook automation
  const router = getRouter('/ghas')

  // API to enable GHAS for the repo
  router.get('/enable/:repo', async (req, res) => {
    const repo = req.params.repo
    const context = await createContext(repo)
    const resArray = []
    let result = await createInitialCheck(context)
    // res.write(`${JSON.stringify(result)}`)
    resArray.push(result)
    if (result.status === 'error') {
      res.render('../../../views/enable.hbs', resArray)
      // res.end()
      return
    }

    result = await createBranchProtection(context)
    resArray.push(result)
    // res.write(`${JSON.stringify(result)}`)

    if (result.status === 'error') {
      res.render('../../../views/enable.hbs', resArray)
      // res.end()
      return
    }
    result = await enableAdvSec(context)
    resArray.push(result)
    // res.write(`${JSON.stringify(result)}`)
    // res.end()
    res.render('../../../views/enable.hbs', { results: resArray })
  })

  // API to trigger a repository dispatch at the end of Migration
  // and to trigger post migration tasks (loose coupling)
  router.get('/enabletrigger/:repo', async (req, res) => {
    const repo = req.params.repo
    const context = await createContext(repo)
    const report = await context.octokit.repos.createDispatchEvent(context.repo({ event_type: 'migration-complete' }))
    res.send(report)
  })

  // API to run checks on the latest commit on a PR
  // router.get('/check/:repo/pulls/:pr', async (req, res) => {
  //   const repo = req.params.repo
  //   const pr = req.params.pr
  //   const context = await createContext(repo)
  //   console.log(`sss ${JSON.stringify(context.repo({ pull_number: pr }))}`)
  //   context.octokit.pulls.get(context.repo({ pull_number: pr })).then(res => {
  //     console.log(`Pull ${res.data.head.ref}`)
  //     return context.octokit.checks.create(
  //       context.repo({
  //         name: 'GHAS Compliance',
  //         head_sha: res.data.head.ref,
  //         status: 'in_progress',
  //         started_at: new Date()
  //       })
  //     )
  //   }).then(() => {
  //     res.send('Ok')
  //   }).catch(e => {
  //     res.send(JSON.stringify(e))
  //   })
  // })

  // Handler to the repository
  // Enable GHAS for the event.
  // async function handleCodeScanningAlert (context) {
  //   const isOrgAdmin = await checkOrgAdmin(context)
  //   if (!isOrgAdmin) {
  //     const isRepoAdmin = await checkRepoAdmin(context)
  //     if (!isRepoAdmin) {
  //       console.log('Revert the alert')
  //       await context.octokit.codeScanning.updateAlert(context.repo({
  //         alert_number: context.payload.alert.number,
  //         state: 'open'
  //       }))
  //     }
  //   }
  // }

  // Handler to the repository
  // Enable GHAS for the event.
  async function handleRepoDispatch (context) {
    const ret = []
    let result = await createInitialCheck(context)
    ret.push(result)
    if (result.status === 'error') {
      return ret
    }

    result = await createBranchProtection(context)
    ret.push(result)
    if (result.status === 'error') {
      return ret
    }

    result = await enableAdvSec(context)
    ret.push(result)
    return ret
  }

  // Create a context with an authenticated Octokt.
  // Needed when for non-webhook flows
  async function createContext (repo) {
    app.log.trace('Fetching installations')
    let github = await app.auth()
    const installations = await github.paginate(
      github.apps.listInstallations.endpoint.merge({ per_page: 100 })
    )
    const installation = installations[0]
    app.log.trace(`${JSON.stringify(installation)}`)
    github = await app.auth(installation.id)
    const context = {
      payload: {
        installation
      },
      octokit: github,
      log: app.log,
      repo: (object) => {
        return Object.assign(
          {
            owner: installation.account.login,
            repo
          },
          object
        )
      }
    }
    return context
  }

  // Is the Sender an org Admin
  // async function checkOrgAdmin (context) {
  //   try {
  //     const {
  //       data: { role }
  //     } = await context.octokit.orgs.getMembershipForUser(
  //       { org: context.payload.organization.login, username: context.payload.sender.login }
  //     )
  //     return role === 'admin'
  //   } catch (e) {
  //     if (e.status === 404) {
  //       app.log.debug(`${context.payload.sender.login} not a member of org ${e}`)
  //       return false
  //     } else {
  //       app.log.error(
  //         `Got error getting org role for ${context.payload.sender.login} ${e}`
  //       )
  //       return false
  //     }
  //   }
  // }

  // Is the sender a repo admin
  // async function checkRepoAdmin (context) {
  //   try {
  //     const {
  //       data: { permission }
  //     } = await context.octokit.repos.getCollaboratorPermissionLevel(
  //       context.repo({ username: context.payload.sender.login })
  //     )
  //     app.log.debug(`Repo role for ${context.payload.sender.login} is ${JSON.stringify(permission)}`)
  //     return permission === 'admin'
  //   } catch (e) {
  //     if (e.status === 404) {
  //       app.log.debug(`${context.payload.sender.login} not a collaborator for the repo ${e}`)
  //       return false
  //     } else {
  //       app.log.error(
  //           `Got error getting repo role for ${context.payload.sender.login} = ${e}`
  //       )
  //       return false
  //     }
  //   }
  // }

  // Create an initial check in the repo for GHAS Compliance.
  async function createInitialCheck (context) {
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
        app.log.debug(`Created the initial check for GHAS compliance ${JSON.stringify(res)}`)
        return { success: true, message: 'Created the initial check for GHAS compliance' }
      }).catch(e => {
        if (e.status === 404) {
          return { success: false, message: `Repo Not found ${JSON.stringify(context.repo())}` }
        }
        app.log.error(`Initial Check for GHAS Compliance failed with ${JSON.stringify(e)}`)
        return { success: false, message: `Initial Check for GHAS Compliance failed with ${e.message}` }
      })
  }

  // Create branch protection with the GHAS compliance check
  async function createBranchProtection (context) {
    // Get default repo to get default branch
    const repo = await context.octokit.repos.get(context.repo())
    const params = Object.assign(context.repo(), { branch: repo.data.default_branch })
    Object.assign(params, protection, { headers: previewHeaders })
    return context.octokit.repos.updateBranchProtection(params).then(res => {
      app.log.debug(`Branch protection applied successfully ${JSON.stringify(res.url)}`)
      return { success: true, message: 'Branch protection applied successfully' }
    }).catch(e => {
      app.log.error(`Error applying branch protection ${JSON.stringify(e)}`)
      if (e.status === 404) {
        return { success: false, message: `Branch Not found for ${JSON.stringify(params)}` }
      }
      return { success: false, message: `Error applying branch protection ${e.message}` }
    })
  }

  // Enable GHAS on repo settings
  async function enableAdvSec (context) {
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
    const params = Object.assign(context.repo(), sec )
    return context.octokit.repos.update(params).then(res => {
      app.log.debug(`Advanced Security turned on successfully ${JSON.stringify(res.url)}`)
      return { success: true, message: 'Advanced Security turned on successfully' }
    }).catch(e => {
      app.log.debug(`Error enabling Advanced Security ${JSON.stringify(e)}`)
      return { success: false, message: `Error enabling Advanced Security ${e.message}` }
    })
  }
/*
  // Handler to check_run
  // Execute GHAS compliance check
  async function handleCheckRun (context) {
    app.log.debug(`Received a Check run request for ${context.payload.check_run.name}`)
    if (context.payload.check_run.name !== 'GHAS Compliance') {
      app.log.info(`I am not the handler for '${context.payload.check_run.name}' skipping...`)
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
          return executeGHASComplianceCheck(context)
        }
      })
    }
  }

  // Run the GHAS compliance check
  async function executeGHASComplianceCheck (context) {
    app.log.debug(`Processing Check run request for ${context.payload.check_run.name} id: ${context.payload.check_run.id}`)

    const pullRequest = context.payload.check_run.check_suite.pull_requests[0]

    if (!pullRequest) {
      app.log.debug(`No pull request found for ${JSON.stringify(context.payload.check_run)}`)
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

    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    // Arbitrary time to wait for CodeQL Scans
    // const snoozetime = Math.random() * 100
    const snoozetime = 100
    app.log.debug(`Waiting for ${snoozetime} secs for code scanning to complete`)
    context.octokit.checks.update({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      check_run_id: context.payload.check_run.id,
      status: 'in_progress',
      started_at: new Date()
    })
    await snooze(snoozetime * 1000)

    return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/analyses',
      // context.repo({ ref: `refs/heads/${pullRequest.number}/merge` })
      context.repo({ ref: `refs/heads/${pullRequest.head.ref}` })
    ).then(res => {
      // app.log.debug(`After getting codescanning analysis for the branch ${JSON.stringify(res)}`)
      return context.octokit.request('GET /repos/{owner}/{repo}/code-scanning/alerts',
        context.repo({ ref: `refs/heads/${pullRequest.head.ref}` })
      )
    }).then(res => {
      // app.log.debug(`After getting codescanning alerts for the branch ${JSON.stringify(res)}`)
      // filter open and errors
      const filteredAlerts = res.data.filter(alert => {
        return alert.state === 'open' && (alert.rule.security_severity_level === 'critical' || alert.rule.security_severity_level === 'high')
      })

      const url = `https://github.com/${context.payload.repository.owner.login}/${context.payload.repository.name}/security/code-scanning?query=pr:${pullRequest.number}+tool:CodeQL+is:open`
      let conclusion = 'success'
      let summary = 'No high or critical alerts were found'
      let text = `
There are 0 alerts affecting this branch.
[View Branch Alerts](${encodeURI(url)})`

      // Check for appropriate GHAS Alerts
      if (filteredAlerts.length > 0) {
        conclusion = 'failure'
        summary = 'High or critical alerts were found'
        text = `
There are ${filteredAlerts.length} alerts affecting this branch
[View Branch Alerts](${encodeURI(url)})`
      }

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
          text
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
      }
    })
  }
  */
}
