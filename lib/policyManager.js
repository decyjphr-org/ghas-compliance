const yaml = require('js-yaml')
const path = require('path')
const fs = require('fs')
const Glob = require('./glob')
const PolicyError = require('./policyError')
module.exports = class PolicyManager {
  static FILE_NAME = 'policyconfig.yml'
  static DEFAULT_SNOOZE = 0
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
    tools:
    - Semgrep
    - mobsf
    - CodeQL
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

  static codescanningAlertLevels = ['notes', 'warning', 'low', 'moderate', 'medium', 'error', 'high', 'critical']

  constructor (context, log) {
    this.context = context
    this.log = log
    this.policyPath = undefined
    this.policy = undefined
  }

  async getRuntimeSettings () {
    try {
      if (!PolicyManager.RUNTIME_SETTINGS) {
        const runtimeFilePath = process.env.RUNTIME_SETTINGS_FILE || '../runtime.yml'
        const pathToConfig = path.resolve(__dirname, runtimeFilePath)
        if (fs.existsSync(pathToConfig)) {
          const configFile = Buffer.from(fs.readFileSync(pathToConfig, 'utf8'))
          PolicyManager.RUNTIME_SETTINGS = await yaml.load(configFile)
        } else {
          // PolicyManager.RUNTIME_SETTINGS = await yaml.load(PolicyManager.DEFAULT_RUNTIME_CONFIG)
          throw new PolicyError(`No Runtime settings found. Check location ${pathToConfig}`)
        }
      }

      return PolicyManager.RUNTIME_SETTINGS
    } catch (error) {
      throw new PolicyError(`Unable to load runtime settings. ${error}`)
    }
  }

  async getPolicyPath () {
    // For now, we are commenting this logic in lieu of the below logic
    // We only get policypath from the runtime settings and not from the repo config file
    // this.policyPath = await this.context.config(PolicyManager.FILE_NAME)

    // if (!this.policyPath || !this.policyPath.repo) {
    //  this.policyPath = (await this.getRuntimeSettings()).policyPath
    // }
    this.policyPath = this.policyPath || (await this.getRuntimeSettings()).policyPath
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

      // This is the default path. We don't expect policypath to be set (it is really a beta feature)
      if (!this.policyPath) {
        this.policy = Object.assign({}, runtime.emptyPolicy, runtime)
        return this.policy
      } else {
        this.log.info('Policypath defined. This is a beta feature.')
      }

      const response = await this.context.octokit.repos.getContent(this.policyPath).catch(e => {
        this.log.info(`Unable to get policy from location ${JSON.stringify(this.policyPath)}, default policy will be used.`)
      })

      // Ignore in case path is a folder
      // - https://developer.github.com/v3/repos/contents/#response-if-content-is-a-directory
      if (!response || Array.isArray(response.data)) {
        this.log.info(`Using default policy from the runtime config ${JSON.stringify(runtime.emptyPolicy)}`)
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
    this.log.debug(`These secrets are ignored by policy ${JSON.stringify(ignores, null, 2)}`)
    const secrets = secretsList.filter(secret => !ignores.includes(secret))

    // Filter only the relevant ones
    types = this.policy.secretscanning.conditions.types || []
    const filteredSecretsByConditions = this.filteredSecretsByConditions(secrets, types)
    this.log.debug(`These secrets are selected by conditions ${JSON.stringify(filteredSecretsByConditions, null, 2)}`)
    return filteredSecretsByConditions
  }

  filterRelevantAlerts (alertsList) {
    // Filter alerts by tool and is open
    let alerts = this.filteredAlertsByToolAndOpen(alertsList)
    this.log.debug(`These codescanning alerts are selected by tools ${JSON.stringify(this.policy.tools, null, 2)} are ${alerts.length}`)

    // Filter ignores 
    let ids = this.policy.codescanning.ignores.ids || []
    let names = this.policy.codescanning.ignores.names || []
    let cwes = this.policy.codescanning.ignores.cwes || []
    const ignores = this.filteredAlertsByConditions(alerts, ids, names, cwes) || []
    this.log.debug(`These codescanning alerts are ignored by policy ${JSON.stringify(ignores, null, 2)}`)
    alerts = alerts.filter(alert => !ignores.includes(alert))

    // Get alerts that meets the level
    const filteredAlertsByLevel = this.filteredAlertsByLevel(alerts)
    this.log.debug(`These codescanning alerts are selected by level ${JSON.stringify(filteredAlertsByLevel, null, 2)}`)
    alerts = alerts.filter(alert => !filteredAlertsByLevel.includes(alert))

    // Get alerts that meets the conditions
    ids = this.policy.codescanning.conditions.ids || []
    names = this.policy.codescanning.conditions.names || []
    cwes = this.policy.codescanning.conditions.cwes || []
    const filteredAlertsByConditions = this.filteredAlertsByConditions(alerts, ids, names, cwes)
    this.log.debug(`These codescanning alerts are selected by conditions ${JSON.stringify(filteredAlertsByConditions, null, 2)}`)
    return filteredAlertsByConditions.concat(filteredAlertsByLevel)
  }

  filteredAlertsByLevel (alerts) {
    const relevantLevels = PolicyManager.codescanningAlertLevels.slice(PolicyManager.codescanningAlertLevels.indexOf(this.policy.codescanning.level))
    return alerts.filter(alert => {
      return relevantLevels.indexOf(alert.rule.security_severity_level) > -1
    })
  }

  filteredAlertsByToolAndOpen (alerts) {
    return alerts.filter(alert => {
      return alert.state === 'open' && this.policy.codescanning.tools.indexOf(alert.tool.name) > -1
    })
  }

  /**
   * Use this when checking an individual alert
   * Used when undismissing an alert
   * @param {*} alert
   * @returns
   */
  isAlertByPolicy (alert) {
    this.log.info(`Checking if alert ${JSON.stringify(alert)} is confined by policy`)
    if (!this.isAlertByTool(alert)) {
      this.log.info(`Alerts from tool name ${alert.tool.name} is not managed the policy`)
      return false
    } else if (this.isAlertByLevel(alert)) {
      this.log.info(`Alert level ${alert.rule.security_severity_level} meets the policy by isAlertByLevel`)
      return true
    } else {
      this.log.info(`Alert level ${alert.rule.security_severity_level} does not meet the policy by isAlertByLevel`)

      // Process Ignores
      let ids = this.policy.codescanning.ignores.ids || []
      let names = this.policy.codescanning.ignores.names || []
      let cwes = this.policy.codescanning.ignores.cwes || []
      if (this.isAlertByCondition(alert, ids, names, cwes)) {
        this.log.info(`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} can be ignored ${ids} ${names} ${cwes}`)
        return false
      } else {
        this.log.info(`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} cannot be ignored ${ids} ${names} ${cwes}`)

        // Process conditions
        ids = this.policy.codescanning.conditions.ids || []
        names = this.policy.codescanning.conditions.names || []
        cwes = this.policy.codescanning.conditions.cwes || []
        if (this.isAlertByCondition(alert, ids, names, cwes)) {
          this.log.info(`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} meets the condition ${ids} ${names} ${cwes}`)
          return true
        }
        this.log.info(`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} does not meet the condition ${ids} ${names} ${cwes}`)
      }
    }
    return false
  }

  isAlertByLevel (alert) {
    const relevantLevels = PolicyManager.codescanningAlertLevels.slice(PolicyManager.codescanningAlertLevels.indexOf(this.policy.codescanning.level))
    return relevantLevels.indexOf(alert.rule.security_severity_level) > -1
  }

  isAlertByTool (alert) {
    return this.policy.codescanning.tools.indexOf(alert.tool.name) > -1
  }

  isAlertByCondition (alert, ids, names, cwes) {
    let filtered = ids.filter(id => {
      const pattern = new Glob(id)
      return alert.rule.id.search(pattern) >= 0
    })
    if (filtered.length > 0) {
      return true
    }

    filtered = names.filter(name => {
      const pattern = new Glob(name)
      return alert.rule.name.search(pattern) >= 0
    })
    if (filtered.length > 0) {
      return true
    }

    filtered = cwes.filter(cwe => {
      return alert.rule.tags.filter(tag => tag.includes(cwe)).length > 0
    })
    if (filtered.length > 0) {
      return true
    }

    return false
  }

  isSecretByPolicy (secret) {
    this.log.info(`Checking if secret ${secret.secret_type} is confined by policy`)
    if (this.isSecretByCondition(secret)) {
      this.log.info(`This secret ${secret.secret_type} confines to policy`)
      return true
    }
    this.log.info(`This secret ${secret.secret_type} does not confine to policy`)
    return false
  }

  isSecretByCondition (secret) {
    // Process ignores first
    let types = this.policy.secretscanning.ignores.types || []
    let filtered = this.filterSecretByType(types, secret)
    // Should be ignored
    if (filtered.length > 0) {
      this.log.info(`This secret ${secret.secret_type} can be ignored by policy ${types}`)
      return false
    }
    this.log.info(`This secret ${secret.secret_type} cannot be ignored by policy ${types}`)
    // Process conditions first
    types = this.policy.secretscanning.conditions.types || []
    filtered = this.filterSecretByType(types, secret)
    if (filtered.length > 0) {
      this.log.info(`This secret ${secret.secret_type} meets the policy by condition ${types}`)
      return true
    } else {
      this.log.info(`This secret ${secret.secret_type} does not meet the policy by condition ${types}`)
      return false
    }
  }

  filterSecretByType (types, secret) {
    return types.filter(type => {
      this.log.debug(`Comparing type in the policy ${type}, type in the secret ${secret.secret_type}`)
      const pattern = new Glob(type)
      return secret.secret_type.search(pattern) >= 0
    })
  }

  filteredAlertsByConditions (alerts, ids, names, cwes) {
    const alertsByIds = alerts.filter(alert => {
      const _ = ids.filter(id => {
        this.log.debug(`Comparing id in the policy ${id}, id in the codescanning alert ${alert.rule.id}`)
        const pattern = new Glob(id)
        return alert.rule.id.search(pattern) >= 0
      })
      return _.length > 0
    })
    
    let remainingAlerts = alerts.filter(alert => !alertsByIds.includes(alert))

    const alertsByNames = remainingAlerts.filter(alert => {
      const _ = names.filter(name => {
        this.log.debug(`Comparing name in the policy ${name}, name in the codescanning alert ${alert.rule.name}`)
        const pattern = new Glob(name)
        return alert.rule.name.search(pattern) >= 0
      })
      return _.length > 0
    })
    remainingAlerts = remainingAlerts.filter(alert => !alertsByNames.includes(alert))

    const alertsByCWEs = remainingAlerts.filter(alert => {
      const _ = cwes.filter(cwe => {
        this.log.debug(`Comparing CWE in the policy ${cwe}, CWE in the codescanning alert ${alert.rule.tags}`)
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
        this.log.debug(`Comparing type in the policy ${type}, type in the secret ${secret.secret_type}`)
        const pattern = new Glob(type)
        return secret.secret_type.search(pattern) >= 0
      })
      return _.length > 0
    })

    return secretsByType
  }
}
