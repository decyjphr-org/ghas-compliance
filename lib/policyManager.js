const yaml = require('js-yaml')
module.exports = class PolicyManager {
  constructor (context, log, policy) {
    this.context = context
    this.policy = policy
    this.log = log
    console.log(JSON.stringify(this.policy))
  }

/**
* Loads a file from GitHub
*
* @param params Params to fetch the file with
* @return The parsed YAML file
*/
  async getPolicy () {
    try {
      // const params = Object.assign(this.repo, { path: this.path, ref: this.ref })
      const response = await this.context.octokit.repos.getContent(this.policy).catch(e => {
        this.log.error(`Error getting policy ${e}`)
      })

      // Ignore in case path is a folder
      // - https://developer.github.com/v3/repos/contents/#response-if-content-is-a-directory
      if (Array.isArray(response.data)) {
        return null
      }

      // we don't handle symlinks or submodule
      // - https://developer.github.com/v3/repos/contents/#response-if-content-is-a-symlink
      // - https://developer.github.com/v3/repos/contents/#response-if-content-is-a-submodule
      if (typeof response.data.content !== 'string') {
        return
      }
      return yaml.load(Buffer.from(response.data.content, 'base64').toString()) || {}
    } catch (e) {
      if (e.status === 404) {
        return null
      }
      throw e
    }
  }
}
