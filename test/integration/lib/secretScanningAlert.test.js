const path = require('path')
const fs = require('fs')
const YAML = require('js-yaml')
const { CREATED, NO_CONTENT, OK } = require('http-status-codes')
const any = require('@travi/any')
const { buildTriggerEvent, initializeNock, loadInstance, teardownNock, repository } = require('../common')
const PolicyManager = require('../../../lib/policyManager')
const { Context } = require('probot')
const log = require('pino')(process.stdout)//('test.log')
const { handleRepoDispatch } = require('../../../lib/repoDispatch')
const { handleSecretScanningAlert } = require('../../../lib/secretScanningAlert')
const secretscanningCreatedPushProtectionPayload = require('../../fixtures/secretscanning_created.push_protection.event.json')

describe('Secret Scanning Alert Test', function () {
  let probot, githubScope

  beforeEach(() => {
    githubScope = initializeNock()
    probot = loadInstance()

    const accessToken = JSON.parse(
      JSON.stringify(require('../../fixtures/access_token.json'))
    )

    const repoContents = JSON.parse(
        JSON.stringify(require('../../fixtures/repositories.contents.json'))
      )
    
    const pathToConfig = path.resolve(__dirname, '..', '..', 'fixtures', 'custom-policy.yml')
    const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
    const encodedConfig = configFile.toString('base64')
    repoContents.content = encodedConfig
    const securityManagers = JSON.parse(JSON.stringify(require('../../fixtures/securitymanagers.api.json')))
    const teamMembershipsForUser = JSON.parse(JSON.stringify(require('../../fixtures/securitymanagers.api.json')))
    const secretScanningAlerts = require('../../fixtures/secretscanning_alerts.api')


    repoContents.content = encodedConfig
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
    .patch('/repos/decyjphr-org/decyjphr-ado-migration2/secret-scanning/alerts/8')
    .reply(200)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/secret-scanning/alerts?state=open')
    .reply(200, secretScanningAlerts)
    .get('/repos/decyjphr-org/decyjphr-ado-migration2/secret-scanning/alerts?state=open&per_page=100')
    .reply(200, secretScanningAlerts)
    .patch('/repos/decyjphr-org/decyjphr-ado-migration2/secret-scanning/alerts/2')
    .reply(200)

  })


  afterEach(() => {
    //if (!githubScope.isDone()) {
    //  console.error('pending mocks: %j', githubScope.pendingMocks())
    //}
    //teardownNock(githubScope)
  })

  it('Test Secret Scanning Alert ', async () => {
    const github = await probot.auth("1")

    context = {
      payload: secretscanningCreatedPushProtectionPayload,
      octokit: github,
      log: probot.log,
      repo: (_another) => { 
        return Object.assign({},{repo: repository.name, owner: repository.owner.name}, _another) 
    },
      config: (_filename) => {return policyPath }
    }

    const res = await handleSecretScanningAlert(context, log)
    // expect(res).toBeDefined()
    
  }, 60000)
})

