const { createProbot } = require('probot')
const { pino } = require('pino')
const { getTransformStream } = require('@probot/pino')
const nock = require('nock')
const any = require('@travi/any')
const complianceBot = require('../../index')

//const settings = require('../../lib/settings')

nock.disableNetConnect()
const mockcert = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAli7V49NdZe+XYC1pLaHM0te8kiDmZBJ1u2HJHN8GdbROB6NO
VpC3xK7NxQn6xpvZ9ux20NvcDvGle+DOptZztBH+np6h2jZQ1/kD1yG1eQvVH4th
/9oqHuIjmIfO8lIe4Hyd5Fw5xHkGqVETTGR+0c7kdZIlHmkOregUGtMYZRUi4YG+
q0w+uFemiHpGKXbeCIAvkq7aIkisEzvPWfSyYdA6WJHpxFk7tD7D8VkzABLVRHCq
AuyqPG39BhGZcGLXx5rGK56kDBJkyTR1t3DkHpwX+JKNG5UYNwOG4LcQj1fteeta
TdkYUMjIyWbanlMYyC+dq7B5fe7el99jXQ1gXwIDAQABAoIBADKfiPOpzKLOtzzx
MbHzB0LO+75aHq7+1faayJrVxqyoYWELuB1P3NIMhknzyjdmU3t7S7WtVqkm5Twz
lBUC1q+NHUHEgRQ4GNokExpSP4SU63sdlaQTmv0cBxmkNarS6ZuMBgDy4XoLvaYX
MSUf/uukDLhg0ehFS3BteVFtdJyllhDdTenF1Nb1rAeN4egt8XLsE5NQDr1szFEG
xH5lb+8EDtzgsGpeIddWR64xP0lDIKSZWst/toYKWiwjaY9uZCfAhvYQ1RsO7L/t
sERmpYgh+rAZUh/Lr98EI8BPSPhzFcSHmtqzzejvC5zrZPHcUimz0CGA3YBiLoJX
V1OrxmECgYEAxkd8gpmVP+LEWB3lqpSvJaXcGkbzcDb9m0OPzHUAJDZtiIIf0UmO
nvL68/mzbCHSj+yFjZeG1rsrAVrOzrfDCuXjAv+JkEtEx0DIevU1u60lGnevOeky
r8Be7pmymFB9/gzQAd5ezIlTv/COgoO986a3h1yfhzrrzbqSiivw308CgYEAwecI
aZZwqH3GifR+0+Z1B48cezA5tC8LZt5yObGzUfxKTWy30d7lxe9N59t0KUVt/QL5
qVkd7mqGzsUMyxUN2U2HVnFTWfUFMhkn/OnCnayhILs8UlCTD2Xxoy1KbQH/9FIr
xf0pbMNJLXeGfyRt/8H+BzSZKBw9opJBWE4gqfECgYBp9FdvvryHuBkt8UQCRJPX
rWsRy6pY47nf11mnazpZH5Cmqspv3zvMapF6AIxFk0leyYiQolFWvAv+HFV5F6+t
Si1mM8GCDwbA5zh6pEBDewHhw+UqMBh63HSeUhmi1RiOwrAA36CO8i+D2Pt+eQHv
ir52IiPJcs4BUNrv5Q1BdwKBgBHgVNw3LGe8QMOTMOYkRwHNZdjNl2RPOgPf2jQL
d/bFBayhq0jD/fcDmvEXQFxVtFAxKAc+2g2S8J67d/R5Gm/AQAvuIrsWZcY6n38n
pfOXaLt1x5fnKcevpFlg4Y2vM4O416RHNLx8PJDehh3Oo/2CSwMrDDuwbtZAGZok
icphAoGBAI74Tisfn+aeCZMrO8KxaWS5r2CD1KVzddEMRKlJvSKTY+dOCtJ+XKj1
OsZdcDvDC5GtgcywHsYeOWHldgDWY1S8Z/PUo4eK9qBXYBXp3JEZQ1dqzFdz+Txi
rBn2WsFLsxV9j2/ugm0PqWVBcU2bPUCwvaRu3SOms2teaLwGCkhr
-----END RSA PRIVATE KEY-----`
const repository = {
  default_branch: 'main',
  name: 'decyjphr-ado-migration2',
  owner: {
    name: 'decyjphr-org',
    email: null
  }
}

function loadInstance () {
  const log = getLog('trace')
  const probot = createProbot({env: {APP_ID: 1, PRIVATE_KEY: mockcert, githubToken: 'test', LOG_LEVEL: process.env.LOG_LEVEL }})
  probot.load(complianceBot)
  return probot
}

function initializeNock () {
  nock.disableNetConnect()
  return nock('https://api.github.com')
}

function teardownNock (githubScope) {
  expect(githubScope.isDone()).toBe(true)

  nock.cleanAll()
}

function cleanAll (githubScope) {
  nock.cleanAll()
}

function getLog (logLevel, logMessageKey) {
  const pinoOptions = {
    level: logLevel || 'trace',
    name: 'probot',
    messageKey: logMessageKey || 'msg'
  }

  const transform = getTransformStream()
  transform.pipe(pino.destination(1))
  return pino(pinoOptions, transform)
}

function buildPushEvent () {
  return {
    name: 'push',
    payload: {
      ref: 'refs/heads/master',
      repository,
      commits: [{ modified: [settings.FILE_NAME], added: [] }]
    }
  }
}

function buildRepositoryEditedEvent () {
  return {
    name: 'repository.edited',
    payload: {
      changes: { default_branch: { from: any.word() } },
      repository
    }
  }
}

function buildRepositoryCreatedEvent () {
  return {
    name: 'repository.created',
    payload: { repository }
  }
}

function buildTriggerEvent () {
  return any.fromList([buildPushEvent(), buildRepositoryCreatedEvent(), buildRepositoryEditedEvent()])
}

module.exports = {
  loadInstance,
  initializeNock,
  teardownNock,
  cleanAll,
  buildTriggerEvent,
  buildRepositoryCreatedEvent,
  buildRepositoryEditedEvent,
  repository
}

