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

describe('policyManager test', function () {
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
    githubScope
      .post('/app/installations/1/access_tokens')
      .reply(200,accessToken)
      .put('/repos/name,decyjphr-org//branches//protection')
      .reply(200)
      .get('/repos/decyjphr-org/security-queries/contents/policies%2Fcustom.yml?ref=main')
      .reply(200, repoContents)
      .get('/repos/name,decyjphr-org/?default_branch=main&name=decyjphr-ado-migration2')
      .reply(200)
      .get('/repos/name,decyjphr-org//commits?default_branch=main&name=decyjphr-ado-migration2')
      .reply(200)
  })


  afterEach(() => {
    if (!githubScope.isDone()) {
      console.error('pending mocks: %j', githubScope.pendingMocks())
    }
    teardownNock(githubScope)
  })

  it('Test PolicyManager', async () => {
    const github = await probot.auth("1")
    const policyPath = YAML.load(`
owner: decyjphr-org
repo: security-queries
path: policies/custom.yml
ref: main
`)
    let context = {
      payload: {
        installation: null
      },
      octokit: github,
      log: probot.log,
      repo: () => { return repository },
      config: (filename) => {return policyPath }
    }
    const policyManager = new PolicyManager(context, log)
    
    console.log(`${JSON.stringify(await policyManager.getPolicy())}`)
    expect(await policyManager.skipCheckAlways()).toBeFalsy()

    expect(await policyManager.createInitialCheck()).toBeFalsy()

    expect(await policyManager.createBranchProtection()).toBeFalsy()

    expect(await policyManager.enableAdvSec()).toBeFalsy()

    expect(await policyManager.getSnooze()).toBe(20)

    expect(await policyManager.getTopics()).toContain('ncnia')

    const secrets = JSON.parse(
      JSON.stringify(require('../../fixtures/secret_scanning.alert.json'))
    )
    let filtered = policyManager.filterRelevantSecrets(secrets)
    expect(filtered).toBeInstanceOf(Array)

    const secret = { secret_type: "google_api_key"}
    filtered = policyManager.isSecretByPolicy(secret)
    console.log(`${JSON.stringify(filtered)}`)

    context = {
      payload: {
        action: "ghas-enable",
        client_payload: {
            createInitialCheck:true,
            createBranchProtection:true,
            enableAdvSec: true
        }
      },
      octokit: github,
      log: probot.log,
      repo: () => { return repository },
      config: (filename) => {return policyPath }
    }

    const res = await handleRepoDispatch(context, log)
    expect(res).toBeDefined()
  }, 60000)
})

