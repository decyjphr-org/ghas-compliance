const yaml = require('js-yaml')
const path = require('path')
const fs = require('fs')
const Glob = require('./glob')
module.exports = class PolicyManager {
  static FILE_NAME = 'policyconfig.yml'
  static DEFAULT_SLEEP = 20
  static RUNTIME_SETTINGS
  static DEFAULT_RUNTIME_CONFIG = `
branches:
  protection:
  patterns: []
bypasschecks:
  always: false
  topics: []
repodispatch:
  createInitialCheck: true
  createBranchProtection: true
  enableAdvSec: true
policy:
  snooze: 20
policyPath:
  owner: 
  repo: 
  path: 
  ref:  
emptyPolicy:
  codescanning:
    level: 
    conditions:
      ids: []
      names: []
      cwes: []
    ignores:
      ids: []
      names: []
      cwes: []
  secretscanning:
    conditions:
      types: []
    ignores:
      types: []
`

  static policies
  static codescanningAlertLevels = ['notes', 'warning', 'low', 'moderate', 'medium', 'error', 'high', 'critical']

  constructor (context, log) {
    this.context = context
    this.log = log
    this.policyPath = undefined
    this.policy = undefined
  }

  async getRuntimeSettings () {
    if (!PolicyManager.RUNTIME_SETTINGS) {
      const runtimeFilePath = process.env.RUNTIME_SETTINGS_FILE || '../runtime.yml'
      const pathToConfig = path.resolve(__dirname, runtimeFilePath)
      if (fs.existsSync(pathToConfig)) {
        const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
        PolicyManager.RUNTIME_SETTINGS = await yaml.load(configFile)
      } else {
        PolicyManager.RUNTIME_SETTINGS = await yaml.load(PolicyManager.DEFAULT_RUNTIME_CONFIG)
      }
    }

    return PolicyManager.RUNTIME_SETTINGS
  }

  async getPolicyPath () {
    if (!this.policyPath) {
      this.policyPath = await this.context.config(PolicyManager.FILE_NAME)

      if (!this.policyPath || !this.policyPath.repo) {
        this.policyPath = (await this.getRuntimeSettings()).policyPath
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
      const runtime = await this.getRuntimeSettings()

      await this.getPolicyPath()

      // const params = Object.assign(this.repo, { path: this.path, ref: this.ref })
      const response = await this.context.octokit.repos.getContent(this.policyPath).catch(e => {
        this.log.error(`Error getting policy ${e}`)
      })

      // Ignore in case path is a folder
      // - https://developer.github.com/v3/repos/contents/#response-if-content-is-a-directory
      if (!response || Array.isArray(response.data)) {
        this.policy = Object.assign({}, runtime.emptyPolicy, runtime)
        return this.policy
      }

      if (typeof response.data.content !== 'string') {
        this.policy = Object.assign({}, runtime.emptyPolicy, runtime)
        return this.policy
      }
      const config = yaml.load(Buffer.from(response.data.content, 'base64').toString()) || {}
      this.policy = Object.assign({}, config, runtime)
      // Populate any empty configs
      this.populateEmptyConfigs()
      return this.policy
    } catch (e) {
      if (e.status === 404) {
        return null
      }
      throw e
    }
  }

  populateEmptyConfigs () {
    this.policy.bypasschecks ||= {}
    this.policy.bypasschecks.topics ||= []
    this.policy.secretscanning ||= {}
    this.policy.codescanning ||= {}
    this.policy.codescanning.ignores ||= []
    this.policy.codescanning.conditions ||= []
    this.policy.codescanning.ignores.ids ||= []
    this.policy.codescanning.conditions.ids ||= []
    this.policy.codescanning.ignores.names ||= []
    this.policy.codescanning.conditions.names ||= []
    this.policy.codescanning.ignores.cwes ||= []
    this.policy.codescanning.conditions.cwes ||= []
    this.policy.secretscanning.ignores ||= []
    this.policy.secretscanning.conditions ||= []
    this.policy.secretscanning.ignores.types ||= []
    this.policy.secretscanning.conditions.types ||= []
  }

  async skipCheckAlways () {
    await this.getPolicy()
    return this.policy.bypasschecks?.always
  }

  async createInitialCheck () {
    await this.getPolicy()
    return this.policy.repodispatch?.createInitialCheck
  }

  async createBranchProtection () {
    await this.getPolicy()
    return this.policy.repodispatch?.createBranchProtection
  }

  async enableAdvSec () {
    await this.getPolicy()
    return this.policy.repodispatch?.enableAdvSec
  }

  async getSnooze () {
    await this.getPolicy()
    return this.policy.policy?.snooze || PolicyManager.DEFAULT_SNOOZE
  }

  async getTopics () {
    await this.getPolicy()
    return this.policy.bypasschecks.topics || []
  }

  filterRelevantSecrets (secretsList) {
    // Filter ignores first
    let types = this.policy.secretscanning.ignores.types || []
    const ignores = this.filteredSecretsByConditions(secretsList, types) || []
    this.log.debug(`Ignored Secrets ${ignores}`)
    const secrets = secretsList.filter(secret => !ignores.includes(secret))

    // Filter only the relevant ones
    types = this.policy.secretscanning.conditions.types || []
    const filteredSecretsByConditions = this.filteredSecretsByConditions(secrets, types)
    this.log.debug(`Secrets by conditions ${filteredSecretsByConditions}`)
    return filteredSecretsByConditions
  }

  filterRelevantAlerts (alertsList) {
    // Filter ignores first
    let ids = this.policy.codescanning.ignores.ids || []
    let names = this.policy.codescanning.ignores.names || []
    let cwes = this.policy.codescanning.ignores.cwes || []
    const ignores = this.filteredAlertsByConditions(alertsList, ids, names, cwes) || []
    this.log.debug(`Ignored Alerts ${ignores}`)
    const alerts = alertsList.filter(alert => !ignores.includes(alert))

    const filteredAlertsByLevel = this.filteredAlertsByLevel(alerts)
    this.log.debug(`Alerts by level ${filteredAlertsByLevel}`)

    ids = this.policy.codescanning.conditions.ids || []
    names = this.policy.codescanning.conditions.names || []
    cwes = this.policy.codescanning.conditions.cwes || []
    const filteredAlertsByConditions = this.filteredAlertsByConditions(alerts, ids, names, cwes)
    this.log.debug(`Alerts by conditions ${filteredAlertsByConditions}`)
    return filteredAlertsByConditions.concat(filteredAlertsByLevel)
  }

  filteredAlertsByLevel (alerts) {
    const relevantLevels = PolicyManager.codescanningAlertLevels.slice(PolicyManager.codescanningAlertLevels.indexOf(this.policy.codescanning.level))
    this.log.debug(`Relevant Levels for CodeScanning Alerts ${relevantLevels}`)
    return alerts.filter(alert => {
      this.log.debug(`>>>> ${alert.rule.security_severity_level}`)
      return alert.state === 'open' && relevantLevels.indexOf(alert.rule.security_severity_level) > -1
    })
  }

  /**
   * Use this when checking an individual alert
   * Used when undismissing an alert
   * @param {*} alert
   * @returns
   */
  isAlertByPolicy (alert) {
    let ids = this.policy.codescanning.ignores.ids || []
    let names = this.policy.codescanning.ignores.names || []
    let cwes = this.policy.codescanning.ignores.cwes || []

    if (this.isAlertByLevel(alert)) {
      return true
    } else if (this.isAlertByCondition(alert, ids, names, cwes)) {
      // These are ignores
      return false
    } else {
      ids = this.policy.codescanning.conditions.ids || []
      names = this.policy.codescanning.conditions.names || []
      cwes = this.policy.codescanning.conditions.cwes || []
      if (this.isAlertByCondition(alert, ids, names, cwes)) {
        // These are conditions
        return true
      }
    }
    return false
  }

  isAlertByLevel (alert) {
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

    const cwes = this.policy.codescanning.conditions.cwes || []
    filtered = cwes.filter(cwe => {
      return alert.rule.tags.filter(tag => tag.includes(cwe)).length > 0
    })
    if (filtered.length > 0) {
      return true
    }

    return false
  }

  isSecretByPolicy (secret) {
    if (this.isSecretByCondition(secret)) {
      return true
    }
    return false
  }

  isSecretByCondition (secret) {
    // Process ignores first
    let types = this.policy.secretscanning.ignores.types || []
    let filtered = this.filterSecretByType(types, secret)
    // Should be ignored
    if (filtered.length > 0) {
      return false
    }

    // Process conditions first
    types = this.policy.secretscanning.conditions.types || []
    filtered = this.filterSecretByType(types, secret)
    return filtered.length > 0
  }

  filterSecretByType(types, secret) {
    return types.filter(type => {
      this.log.debug(`=== ${type} ${secret.secret_type}`)
      const pattern = new Glob(type)
      return secret.secret_type.search(pattern) >= 0
    })
  }

  filteredAlertsByConditions (alerts, ids, names, cwes) {
    const openAlerts = alerts.filter(alert => {
      return alert.state === 'open'
    })

    const alertsByIds = openAlerts.filter(alert => {
      const _ = ids.filter(id => {
        this.log.debug(`=== ${id} ${alert.rule.id}`)
        const pattern = new Glob(id)
        return alert.rule.id.search(pattern) >= 0
      })
      return _.length > 0
    })

    const alertsByNames = openAlerts.filter(alert => {
      const _ = names.filter(name => {
        this.log.debug(`=== ${name} ${alert.rule.name}`)
        const pattern = new Glob(name)
        return alert.rule.name.search(pattern) >= 0
      })
      return _.length > 0
    })

    const alertsByCWEs = openAlerts.filter(alert => {
      const _ = cwes.filter(cwe => {
        this.log.debug(`=== ${cwe} ${alert.rule.tags}`)
        return alert.rule.tags.filter(tag => tag.includes(cwe)).length > 0
      })
      return _.length > 0
    })

    return alertsByIds.concat(alertsByNames).concat(alertsByCWEs)
  }

  filteredSecretsByConditions (secrets, types) {
    const openSecrets = secrets.filter(secret => {
      return secret.state === 'open'
    })

    const secretsByType = openSecrets.filter(secret => {
      const _ = types.filter(type => {
        this.log.debug(`=== ${type} ${secret.secret_type}`)
        const pattern = new Glob(type)
        return secret.secret_type.search(pattern) >= 0
      })
      return _.length > 0
    })

    return secretsByType
  }
}
