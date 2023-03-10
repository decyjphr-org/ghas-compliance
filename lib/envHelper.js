require('dotenv').config()

module.exports = class EnvHelper {

    static getEnv() {
        const {
          APP_ID: appId,
          PRIVATE_KEY: privateKey,
          WEBHOOK_SECRET: webhookSecret,
          LOG_FORMAT: logFormat,
          LOG_LEVEL: logLevel,
          LOG_MESSAGE_KEY: logMessageKey,
          LOG_LEVEL_IN_STRING: logLevelInString,
          TLS_KEY_PATH: tlsKeyPath,
          TLS_CERT_PATH: tlsCertPath,
          TLS_KEY: tlsKey,
          TLS_CERT: tlsCert,
          CSP: csp,
          CLOUD_AVAILABILITY_ZONE: cloudAvailabilityZone,
          CLOUD_INSTANCE_ID: cloudInstanceId,
          CONTAINER_ID: containerId,
          APPLICATIONID: applicationId,
          PRODUCTID: productId,
          PRODUCTLINEID: productLineId,
          ORGANIZATION: organization,
          ENVIRONMENT: environment,
          WEBHOOK_PROXY_URL: proxyUrl,
          MAX_ALERTS: maxAlerts = '75'
        } = process.env

        return {
            appId, 
            privateKey, 
            webhookSecret, 
            logFormat, 
            logLevel, 
            logMessageKey, 
            logLevelInString, 
            tlsKeyPath, 
            tlsCertPath, 
            tlsKey, 
            tlsCert, 
            csp, 
            cloudAvailabilityZone, 
            cloudInstanceId, 
            containerId, 
            applicationId, 
            productId, 
            productLineId, 
            organization, 
            environment,
            proxyUrl,
            maxAlerts: parseInt(maxAlerts)
        }
    }
    static toString() {
        let env = this.getEnv()
        delete env['privateKey']
        delete env['webhookSecret']
        delete env['tlsKey']
        delete env['tlsCert']
        
        return JSON.stringify(env, null, 2)
    }
}