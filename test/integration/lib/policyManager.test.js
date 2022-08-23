const path = require('path')
const fs = require('fs')
const YAML = require('js-yaml')
const { CREATED, NO_CONTENT, OK } = require('http-status-codes')
const any = require('@travi/any')
const { buildTriggerEvent, initializeNock, loadInstance, repository, teardownNock } = require('../common')
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

    githubScope
      .post('/app/installations/1/access_tokens')
      .reply(200,accessToken)

    const repoContents = JSON.parse(
        JSON.stringify(require('../../fixtures/repositories.contents.json'))
      )
    
    const pathToConfig = path.resolve(__dirname, '..', '..', 'fixtures', 'custom-policy.yml')
    const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
    const encodedConfig = configFile.toString('base64')

    repoContents.content = encodedConfig
    githubScope
      .get('/repos/decyjphr-org/security-queries/contents/policies%2Fcustom.yml?ref=main')
      .reply(200, repoContents)
  })


  afterEach(() => {
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
    
    expect(await policyManager.skipCheckAlways()).toBeTruthy()

    expect(await policyManager.createInitialCheck()).toBeTruthy()

    expect(await policyManager.createBranchProtection()).toBeTruthy()

    expect(await policyManager.enableAdvSec()).toBeTruthy()

    expect(await policyManager.getSnooze()).toBe(100)

    
    // context = {
    //   payload: {
    //     action: "ghas-enable",
    //     client_payload: {
    //         createInitialCheck:true,
    //         createBranchProtection:true,
    //         enableAdvSec: true
    //     }
    //   },
    //   octokit: github,
    //   log: probot.log,
    //   repo: () => { return repository }
    // }
    // await handleRepoDispatch(context, log)
  })
})

