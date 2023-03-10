// This custom plugin overrides the default probotRequestLogging plugin and logs the Octokit API request.
const probotRequestLogging = function (octokit) {
  octokit.hook.error('request', (error, options) => {
    if ('status' in error) {
      const { method, url } =
        octokit.request.endpoint.parse(options)
      const msg = `After GitHub request: ${method} ${url} - ${error.status}`

      // @ts-ignore log.debug is a pino log method and accepts a fields object
      try {
        const rateLimitHeaders = {}
        for (const key of Object.keys(error.response.headers)) {
          if (key.toLowerCase().startsWith('x-ratelimit-')) {
          // convert to integer
            if (!key.toLowerCase().endsWith('-resource')) {
              rateLimitHeaders[key] = parseFloat(error.response.headers[key])
            } else {
              rateLimitHeaders[key] = error.response.headers[key]
            }
          }
        }
        octokit.log.debug(Object.assign({}, octokit.log.bindings(), { rateLimitHeaders }) || {}, msg)
      } catch (error) {
        console.error(error)
      }
    }

    throw error
  })

  octokit.hook.before('request', async (options) => {
    const { method, url, request, ...params } =
    octokit.request.endpoint.parse(options)
    let msg = `Before GitHub request: ${method} ${url}`
    if (url.includes('check-runs') && params.body.status) {
      msg = `Before GitHub request: ${method} ${url} check-run-${params.body.status}`
    }
    // @ts-ignore log.debug is a pino log method and accepts a fields object
    try {
      octokit.log.debug(octokit.log.bindings() || {}, msg)
    } catch (error) {
      console.error(error)
    }
  })

  octokit.hook.after('request', (result, options) => {
    const { method, url, request, ...params } =
      octokit.request.endpoint.parse(options)
    const msg = `After GitHub request: ${method} ${url} GitHub response: ${result.status}`

    // @ts-ignore log.debug is a pino log method and accepts a fields object
    try {
      const rateLimitHeaders = {}
      for (const key of Object.keys(result.headers)) {
        if (key.toLowerCase().startsWith('x-ratelimit-')) {
          // convert to integer
          if (!key.toLowerCase().endsWith('-resource')) {
            rateLimitHeaders[key] = parseFloat(result.headers[key])
          } else {
            rateLimitHeaders[key] = result.headers[key]
          }
        }
      }
      octokit.log.debug(Object.assign({}, octokit.log.bindings(), { rateLimitHeaders }) || {}, msg)
    } catch (error) {
      console.error(error)
    }
  })
}
module.exports = probotRequestLogging
