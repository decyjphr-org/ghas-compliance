const { initializeNock, loadInstance, repository, cleanAll, teardownNock } = require('./integration/common')
const fs = require('fs')
const path = require('path')

// Requiring our fixtures
const checkSuitePayload = require('./fixtures/check_suite.requested')
const checkSuiteNoPRPayload = require('./fixtures/checksuite_requested_nopr.event')
const checkRunSuccess = require('./fixtures/checkrun.created')
const codescanningClosedPayload = require('./fixtures/codescanning_alert.closed')
const secretscanningResolvedPayload = require('./fixtures/secretscanning_resolved.event.json')

const repositoryDispatchComplianceCheckPayload = require('./fixtures/repository_dispatch.compliance_check')
const repositoryDispatchGhasEnablePayload = require('./fixtures/repository_dispatch.ghas_enable')
const repositoryDispatchGhasDisablePayload = require('./fixtures/repository_dispatch.ghas_disable')
const checkRunGHASCompliance = require('./fixtures/checkrun.created.ghas_compliance')
const repoTopics = require('./fixtures/repository_topics.api')
const checkRunsForRef = require('./fixtures/checkruns.reference.api')
const secretScanningAlerts = require('./fixtures/secretscanning_alerts.api')
const codeScanningAnalysis = require('./fixtures/codescanning_analysis.api')
const codeScanningAlerts = require('./fixtures/codescanning_alerts.api')
const refsApi = require('./fixtures/refs.api')
const pullRequestOpened = require('./fixtures/pullrequest.opened')



describe('GHAS Compliance app', () => {
  let probot, githubScope

  beforeEach(() => {
    githubScope = initializeNock()
    probot = loadInstance()

    const accessToken = JSON.parse(
      JSON.stringify(require('./fixtures/access_token.json'))
    )
    const repoContents = JSON.parse(
        JSON.stringify(require('./fixtures/repositories.contents.json'))
    )
    const pathToConfig = path.resolve(__dirname, 'fixtures', 'custom-policy.yml')
    const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
    const encodedConfig = configFile.toString('base64')
    repoContents.content = encodedConfig
    const codescanningAlertUpdate = JSON.parse(JSON.stringify(require('./fixtures/codescanning_alert.api.json')))
    const securityManagers = JSON.parse(JSON.stringify(require('./fixtures/securitymanagers.api.json')))
    const teamMembershipsForUser = JSON.parse(JSON.stringify(require('./fixtures/securitymanagers.api.json')))
    
    githubScope
    .post('/app/installations/1/access_tokens')
    .reply(200,accessToken)
    .post('/app/installations/2/access_tokens')
    .reply(200,accessToken)
    .get('/repos/decyjphr-org/security-queries/contents/policies%2Fcustom.yml?ref=main')
    .reply(200, repoContents)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/contents/.github%2Fpolicyconfig.yml')
    .reply(404)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/contents/.github%2Fpolicyconfig.yml')
    .reply(404)
    .get('/repos/decyjphr-org/.github/contents/.github%2Fpolicyconfig.yml')
    .reply(404)
    .get('/orgs/decyjphr-org/security-managers')
    .reply(200, securityManagers)
    .get('/orgs/decyjphr-org/teams/justice-league/memberships/decyjphr')
    .reply(404)
    .get('/orgs/decyjphr-org/teams/justice-league/memberships/decyjphr')
    .reply(200, teamMembershipsForUser)
    .post('/repos/hiimbex/testing-things/check-runs')
    .reply(200)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/git/ref/heads%2Fadd-code')
    .reply(200, refsApi)
    .post('/repos/decyjphr-org/decyjphr-ado-migration2/check-runs')
    .reply(200)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/topics')
    .reply(200, repoTopics)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/check-runs/8960364673')
    .reply(200)
    .patch('/repos/decyjphr-org/decyjphr-ado-migration2/check-runs/8960364673')
    .times(2)
    .reply(200)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/commits/add-code/check-runs')
    .reply(200, checkRunsForRef)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/secret-scanning/alerts?state=open')
    .reply(200, secretScanningAlerts)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/code-scanning/analyses?ref=refs%2Fheads%2Fadd-code')
    .reply(200, codeScanningAnalysis)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/code-scanning/alerts?ref=refs%2Fheads%2Fadd-code')
    .reply(200,codeScanningAlerts)
    .patch('/repos/decyjphr-org/decyjphr-ado-migration2/code-scanning/alerts/4')
    .reply(200)
    .patch('/repos/decyjphr-org/decyjphr-ado-migration2/secret-scanning/alerts/2')
    .reply(200)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2')
    .reply(200)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/commits')
    .reply(200)
    .put('/repos/decyjphr-org/decyjphr-ado-migration2/branches//protection')
    .reply(200)
    .patch('/repos/decyjphr-org/decyjphr-ado-migration2')
    .reply(200)
  })

  afterAll(() => {
    //teardownNock(githubScope)
    //cleanAll(githubScope)
  })

  test('test repository_dispatch repositoryDispatchGhasEnablePayload', async () => {
    await probot.receive({ name: 'repository_dispatch', payload: repositoryDispatchGhasEnablePayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test repository_dispatch repositoryDispatchGhasEnablePayload', async () => {
    await probot.receive({ name: 'repository_dispatch', payload: repositoryDispatchGhasDisablePayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)
  
  test('test repository_dispatch repositoryDispatchComplianceCheckPayload', async () => {
    await probot.receive({ name: 'repository_dispatch', payload: repositoryDispatchComplianceCheckPayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test check_suite', async () => {
    await probot.receive({ name: 'check_suite', payload: checkSuitePayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test check_suite no pr', async () => {
    await probot.receive({ name: 'check_suite', payload: checkSuiteNoPRPayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test check_run checkRunGHASCompliance', async () => {
    await probot.receive({ name: 'check_run', payload: checkRunGHASCompliance })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test pull_request opened', async () => {
    await probot.receive({ name: 'pull_request', payload: pullRequestOpened })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test code_scanning_alert revert', async () => {
    await probot.receive({ name: 'code_scanning_alert', payload: codescanningClosedPayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test code_scanning_alert', async () => {
    await probot.receive({ name: 'code_scanning_alert', payload: codescanningClosedPayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test secret_scanning_alert revert', async () => {
    await probot.receive({ name: 'secret_scanning_alert', payload: secretscanningResolvedPayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

  test('test secret_scanning_alert', async () => {
    await probot.receive({ name: 'secret_scanning_alert', payload: secretscanningResolvedPayload })
    const snooze = ms => new Promise(resolve => setTimeout(resolve, ms))
    await snooze(25 * 1000)
  },30000)

})

// For more information about testing with Jest see:
// https://facebook.github.io/jest/

// For more information about testing with Nock see:
// https://github.com/nock/nock
