const yaml = require('js-yaml')
const path = require('path')
const fs = require('fs')
const Glob = require('./glob')
module.exports = class PolicyManager {
  static FILE_NAME = 'policyconfig.yml'
  static DEFAULT_SLEEP = 20
  static DEFAULT_RUNTIME_CONFIG = `
bypasschecks:
  always: false
  topics: ['ncnia']
repodispatch:
  createInitialCheck: true
  createBranchProtection: true
  enableAdvSec: true
policy:
  snooze: 20`
  static codescanningAlertLevels = ['notes', 'warning', 'low', 'moderate', 'medium', 'error', 'high', 'critical']

  constructor (context, log) {
    this.context = context
    this.log = log
    this.policyPath = undefined
    this.policy = undefined
  }

  async getRuntimeSettings () {
    const runtimeFilePath = process.env.RUNTIME_SETTINGS_FILE || '../runtime.yml'
    const pathToConfig = path.resolve(__dirname, runtimeFilePath)
    if (fs.existsSync(pathToConfig)) {
      const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
      return yaml.load(configFile)
    } else {
      return yaml.load(PolicyManager.DEFAULT_RUNTIME_CONFIG)
    }

    // let pathToConfig = path.resolve(__dirname, '../', 'runtime.yml')
    // const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
    // return yaml.load(configFile)
    // const encodedConfig = configFile.toString('base64')
    // const CONFIG_PATH = '.github'
    // const filePath = path.posix.join(CONFIG_PATH, 'settings.yml')
    // return this.loadYaml(filePath)
  }

  async getPolicyPath () {
    if (!this.policyPath) {
      this.policyPath = await this.context.config(PolicyManager.FILE_NAME)

      if (!this.policyPath || !this.policyPath.repo) {
        this.policyPath = { owner: 'GeekMasher', repo: 'security-queries', path: 'policies/low.yml', ref: 'main' }
      }
    }
    return this.policyPath
  }

  /**
   * Loads a file from GitHub
   *
   * @param params Params to fetch the file with
   * @return The parsed YAML file
   */
  async getPolicy () {
    try {
      if (this.policy) {
        return this.policy
      }

      await this.getPolicyPath()

      // const params = Object.assign(this.repo, { path: this.path, ref: this.ref })
      const response = await this.context.octokit.repos.getContent(this.policyPath).catch(e => {
        this.log.error(`Error getting policy ${e}`)
      })

      // Ignore in case path is a folder
      // - https://developer.github.com/v3/repos/contents/#response-if-content-is-a-directory
      if (Array.isArray(response.data)) {
        return null
      }

      if (typeof response.data.content !== 'string') {
        return
      }
      const config = yaml.load(Buffer.from(response.data.content, 'base64').toString()) || {}
      const runtime = await this.getRuntimeSettings()
      this.policy = Object.assign({}, config, runtime)
      return this.policy
    } catch (e) {
      if (e.status === 404) {
        return null
      }
      throw e
    }
  }

  async loadPolicy () {
    if (!this.policy) {
      await this.getPolicy()
    }
  }

  async skipCheckAlways () {
    await this.loadPolicy()
    return this.policy.bypasschecks.always
  }

  async createInitialCheck () {
    await this.loadPolicy()
    return this.policy.repodispatch.createInitialCheck
  }

  async createBranchProtection () {
    await this.loadPolicy()
    return this.policy.repodispatch.createBranchProtection
  }

  async enableAdvSec () {
    await this.loadPolicy()
    return this.policy.repodispatch.enableAdvSec
  }

  async getSnooze () {
    await this.loadPolicy()
    return this.policy.policy.snooze || PolicyManager.DEFAULT_SNOOZE
  }

  filterRelevantAlerts (alerts) {
    const filteredAlertsByLevel = this.filteredAlertsByLevel(alerts)
    this.log.debug(`+++ ${filteredAlertsByLevel}`)
    const filteredAlertsByConditions = this.filteredAlertsByConditions(alerts)
    this.log.debug(`--- ${filteredAlertsByConditions}`)
    return filteredAlertsByConditions.concat(filteredAlertsByLevel)
  }

  filteredAlertsByLevel (alerts) {
    // await this.loadPolicy()
    const relevantLevels = PolicyManager.codescanningAlertLevels.slice(PolicyManager.codescanningAlertLevels.indexOf(this.policy.codescanning.level))
    this.log.debug(`Relevant Levels for CodeScanning Alerts ${relevantLevels}`)
    return alerts.filter(alert => {
      this.log.debug(`>>>> ${alert.rule.security_severity_level}`)
      return alert.state === 'open' && relevantLevels.indexOf(alert.rule.security_severity_level) > -1
    })
  }

  isAlertByPolicy (alert) {
    if (this.isAlertByLevel(alert)) {
      return true
    } else if (this.isAlertByCondition(alert)) {
      return true
    }
    return false
  }

  isAlertByLevel (alert) {
    // await this.loadPolicy()
    const relevantLevels = PolicyManager.codescanningAlertLevels.slice(PolicyManager.codescanningAlertLevels.indexOf(this.policy.codescanning.level))
    this.log.debug(`Relevant Levels for CodeScanning Alerts ${relevantLevels}`)
    return relevantLevels.indexOf(alert.rule.security_severity_level) > -1
  }

  isAlertByCondition (alert) {
    const ids = this.policy.codescanning.conditions.ids || []
    let filtered = ids.filter(id => {
      const pattern = new Glob(id)
      return alert.rule.id.search(pattern) >= 0
    })
    if (filtered.length > 0) {
      return true
    }

    const names = this.policy.codescanning.conditions.names || []
    filtered = names.filter(name => {
      const pattern = new Glob(name)
      return alert.rule.name.search(pattern) >= 0
    })
    if (filtered.length > 0) {
      return true
    }
    return false
  }

  filteredAlertsByConditions (alerts) {
    // await this.loadPolicy()
    const openAlerts = alerts.filter(alert => {
      return alert.state === 'open'
    })

    const ids = this.policy.codescanning.conditions.ids || []
    const alertsByIds = openAlerts.filter(alert => {
      const _ = ids.filter(id => {
        this.log.debug(`=== ${id} ${alert.rule.id}`)
        const pattern = new Glob(id)
        return alert.rule.id.search(pattern) >= 0
      })
      return _.length > 0
    })

    const names = this.policy.codescanning.conditions.names || []
    const alertsByNames = openAlerts.filter(alert => {
      const _ = names.filter(name => {
        this.log.debug(`=== ${name} ${alert.rule.name}`)
        const pattern = new Glob(name)
        return alert.rule.name.search(pattern) >= 0
      })
      return _.length > 0
    })
    return alertsByIds.concat(alertsByNames)
  }
}
