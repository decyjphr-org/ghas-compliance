# Logging in Compliance App
Compliance app uses Pino for logging. The log level for the app can be set as an environment variable. The following env variables are relevant:
var | desc
-- | --
LOG_FORMAT=json | Send logs as JSON
LOG_LEVEL=[trace,debug,info,warn,error,critcal] | Set the logging level

Logs are sent to `stdout`, generally in `json` format, and they are streamed to Datadog by the Kubernetes Datadog agent.

`NOTE:` If the logs are too noisy, change the log level.

-----
## Details of Log messages:

| Indication | Location | level | Message  | 
-- | -- | -- | -- 
| In Octokit, an error is encountered after an API call to Github | ./lib/octokit-plugin-probot-request-logging.js:10 |     debug |`After GitHub request: ${method} ${url} - ${error.status}` | 
| In Octokit, before an API call to GitHub | ./lib/octokit-plugin-probot-request-logging.js:22 |     debug |`Before GitHub request: ${method} ${url}` | 
| In Octokit, after an API call to GitHub | ./lib/octokit-plugin-probot-request-logging.js:35 |     debug |`After GitHub request: ${method} ${url} GitHub response: ${JSON.stringify(result.headers)} - ${result.status}`  | 
| Abuse limit error is encountered after an API call | ./lib/proxy-aware-probot-octokit.js:23 |     warn | `Abuse limit hit with "${options.method} ${options.url}", retrying in ${retryAfter} seconds.` |
| Rate limit error is encountered after an API call | ./lib/proxy-aware-probot-octokit.js:33 |     warn | `Rate limit hit with "${options.method} ${options.url}", retrying in ${retryAfter} seconds.` |
| User is a security manager? | ./lib/secretScanningAlert.js:8 | debug |`Is the user a security Manager check returned ${isSecurityManager}` | 
| User is a security manager. Allow dismissal of secret | ./lib/secretScanningAlert.js:10 |   info |`The user is a SecurityManager. Do not revert the secret` | 
| Policy cannot be checked for a dismissed secret | ./lib/secretScanningAlert.js:17 |   error |`Unable to get Policy ${error}` | 
| Reopening a dismissed alert because of error | ./lib/secretScanningAlert.js:18 |   info |`Revert the secret because of error` | 
| Dismissed secret is not restricted by the policy | ./lib/secretScanningAlert.js:27 |   debug |`Do not revert the secret. No secret scanning alerts found for the Policy located at ${JSON.stringify(policyPath)}` | 
| Dismissed secret is restricted by the policy | ./lib/secretScanningAlert.js:30 | debug |`Secret scanning alert is found for the Policy located at ${JSON.stringify(policyPath)}` | 
| Reopen an alert that is restricted | ./lib/secretScanningAlert.js:31 | info |`The user is not a SecurityManager. Revert the secret` | 
| GHAS Compliance found alerts under the policy | ./lib/ghasCompliance.js:75 |     info |`Non-compliant Secret scanning alert(s) affecting this repo ${JSON.stringify(filteredSecrets, null, 2)}` | 
| GHAS Compliance found alerts under the policy | ./lib/ghasCompliance.js:96 |     debug |`Non-compliant Code scanning alert(s) affecting this branch ${JSON.stringify(filteredAlerts, null, 2)}` | 
| Unknown error encountered during policy evaluation | ./lib/ghasCompliance.js:118 |   error |`Unknown error while checking codescanning alerts for compliance ${e}` | 
| Policy check is underway for code scanning alerts | ./lib/ghasCompliance.js:152 | debug |`Checking policy for code scanning alerts` | 
| Policy cannot be checked because analysis wasn`t done  | ./lib/ghasCompliance.js:172 |     debug |` No analysis found for ${sha} Failing the checkrun ... ` | 
| Policy check is underway for code scanning alerts | ./lib/ghasCompliance.js:189 | debug |`Applying policy for secret scanning alerts` | 
| Unable to get alerts because 404 error  | ./lib/ghasCompliance.js:198 |     error |`Not found error checking for secret scanning alerts ${e}` | 
| Policy cannot be checked because of unexpected error | ./lib/ghasCompliance.js:205 |     error |`Unknown error checking for secret scanning alerts ${e}` | 
| Checking if the user who dismissed the alert is a security manager | ./lib/checkSecurityManager.js:4 |   debug |`Checking if the actor is security manager` | 
| Getting ready to call the API to get security manager teams | ./lib/checkSecurityManager.js:6 |   debug |`Calling API to get security managers ${JSON.stringify(context.octokit.request.endpoint(`GET /orgs/{org}/security-managers` | 
| Got a valid response when checking for security manager teams | ./lib/checkSecurityManager.js:11 |   debug |`Response from the call is ${JSON.stringify(resp)}` | 
| Getting ready to check if the user belongs to the security manager group | ./lib/checkSecurityManager.js:20 |       debug |`Getting membership for user in the security managers team ${JSON.stringify(params)}` | 
| User is a security manager  | ./lib/checkSecurityManager.js:22 |       debug |`User ${context.payload.sender.login} is a member of security manager team ${team.slug} membership ${JSON.stringify(membership)}` | 
| User is not a security manager | ./lib/checkSecurityManager.js:26 |         debug |`User ${context.payload.sender.login} is not a member of the Security manager team ${team.slug}` | 
| Cannot check if the user is a security manager because of unexpected error | ./lib/checkSecurityManager.js:29 |         error |`Unexpected error ${e} checking for security manager role for ${context.payload.sender.login} in the Security manager team ${team.slug}` | 
| User did not belong to any security manager teams set up in the org | ./lib/checkSecurityManager.js:34 |   debug |`No security matching teams found where ${context.payload.sender.login} is a member. Teams ${JSON.stringify(resp.data)}` | 
| No security manager teams set up in the org | ./lib/checkSecurityManager.js:38 |     debug |`${context.repo().owner} Org does not have Security manager teams set up ${e}` | 
| Cannot check if the user is a security manager because of unexpected error | ./lib/checkSecurityManager.js:40 |     error | `Unexpected error when checking for security manager role for ${context.payload.sender.login} = ${e}` |
| Getting ready to process a checkRun | ./lib/checkRun.js:10 | debug |`Received a Check run request for ${context.payload.check_run.name}` | 
| Policy cannot be checked for the checkrun | ./lib/checkRun.js:15 |   error |`Unable to get Policy ${error}` | 
| No checksuite found for checkrun, so fail the checkrun | ./lib/checkRun.js:26 |   debug |`No Check Suite request found for ${JSON.stringify(context.payload.check_run)}` | 
| Feature flag to skip compliance checks for checkruns | ./lib/checkRun.js:39 |     debug |`Skipped GHAS Compliance check because runtime settings: skipCheckAlways=true` | 
| Getting ready to handle repo dispatch for ghas compliance | ./lib/repoDispatch.js:39 | debug |`Received a Repo Dispatch with action ${JSON.stringify(action)} and payload ${JSON.stringify(clientPayload)}` | 
| Not a valid repo dispatch for GHAS Compliance app | ./lib/repoDispatch.js:46 |   debug |`Repo Dispatch ${JSON.stringify(action)} not valid for GHAS Compliance; skipping...` | 
| A checkrun will be created for the repo dispatch with the provided sha | ./lib/repoDispatch.js:52 |   debug |`Creating a checkrun with the provided sha ${clientPayload.head_sha}` | 
| A checkrun will be created for the repo dispatch with the calculated latest sha | ./lib/repoDispatch.js:63 |   debug |`Creating a checkrun with the latest commit for branch ${clientPayload.head_branch}` | 
| Feature flag to skip initial checkrun creation using repo dispatch | ./lib/repoDispatch.js:89 |     debug |`Skipping createInitialCheck runtime setting createInitialCheck=false` | 
| Feature flag to skip create branch protection setup using repo dispatch | ./lib/repoDispatch.js:102 |     debug |`Skipping createBranchProtection runtime setting createBranchProtection=false` | 
| Feature flag to skip enabling Advanced Security using repo dispatch | ./lib/repoDispatch.js:113 |     debug |`Skipping enableAdvSec runtime setting enableAdvSec=false` | 
| Initial checkrun creation using repo dispatch | ./lib/repoDispatch.js:145 |     debug |`Created the initial check for GHAS compliance ${JSON.stringify(res)}` | 
| Error during initial checkrun creation using repo dispatch | ./lib/repoDispatch.js:151 |     error |`Initial Check for GHAS Compliance failed with ${JSON.stringify(e)}` | 
| Branch protection setup using repo dispatch | ./lib/repoDispatch.js:163 |   debug |`Branch protection applied successfully ${JSON.stringify(res.url)}` | 
| Error during create branch protection setup using repo dispatch | ./lib/repoDispatch.js:166 |   error |`Error applying branch protection ${JSON.stringify(e)}` | 
| Enabled Advanced Security using repo dispatch | ./lib/repoDispatch.js:191 |   debug |`Advanced Security turned on successfully ${JSON.stringify(res.url)}` | 
| Error during enabling Advanced Security using repo dispatch | ./lib/repoDispatch.js:194 |   debug |`Error enabling Advanced Security ${JSON.stringify(e)}` | 
| Is the user a security manager | ./lib/codeScanningAlert.js:6 | debug |`Is the user a security Manager check returned ${isSecurityManager}` | 
| Alert will not be reopened since a security manager dismissed it  | ./lib/codeScanningAlert.js:8 |   info |`The user is a SecurityManager. Do not revert the alert` | 
| Policy cannot be checked because of unexpected error. Reopen the alert | ./lib/codeScanningAlert.js:15 |   error |`Unable to get Policy ${error}. Revert the alert` | 
| Alert is not restricted by policy so could be dismissed | ./lib/codeScanningAlert.js:24 |   debug |`Do not revert the alert. No alerts found confining to the Policy located at ${JSON.stringify(policyPath)}` | 
| Alert is restricted by policy so will be reopened | ./lib/codeScanningAlert.js:27 | debug |`Alert is found confining to the Policy located at ${JSON.stringify(policyPath)}` | 
| User is not a securtity manager | ./lib/codeScanningAlert.js:28 | info |`The user is not a SecurityManager. Revert the alert` | 
| Feature flag to use a policy from a repo | ./lib/policyManager.js:107 |       info |`Policypath defined. This is a beta feature.` | 
| Feature flag to use policy from a repo didn`t find a policy | ./lib/policyManager.js:111 |       info |`Unable to get policy from location ${JSON.stringify(policyPath)}, default policy will be used.` | 
| Feature flag to use policy from a repo didn`t find a policy | ./lib/policyManager.js:117 |       info |`Using default policy from the runtime config ${JSON.stringify(runtime.emptyPolicy)}` | 
| These secrets will be ignored based on policy | ./lib/policyManager.js:192 |   debug |`These secrets are ignored by policy ${JSON.stringify(ignores, null, 2)}` | 
| These secrets will not be ignored based on policy | ./lib/policyManager.js:198 |   debug |`These secrets are selected by conditions ${JSON.stringify(filteredSecretsByConditions, null, 2)}` | 
| These code scanning alerts will be ignored based on policy | ./lib/policyManager.js:208 |   debug |`These codescanning alerts are ignored by policy ${JSON.stringify(ignores, null, 2)}` | 
| These code scanning alerts will not be ignored based on policy | ./lib/policyManager.js:212 |   debug |`These codescanning alerts are selected by level ${JSON.stringify(filteredAlertsByLevel, null, 2)}` | 
| These code scanning alerts meet the policy | ./lib/policyManager.js:219 |   debug |`These codescanning alerts are selected by conditions ${JSON.stringify(filteredAlertsByConditions, null, 2)}` | 
| Individual alert being checked for restriction by policy | ./lib/policyManager.js:237 |   info |`Checking if alert ${JSON.stringify(alert)} is confined by policy` | 
| Individual alert being checked by level | ./lib/policyManager.js:239 |     info |`Alert level ${alert.rule.security_severity_level} meets the policy by isAlertByLevel` | 
| Individual alert is not restricted by level | ./lib/policyManager.js:242 |     info |`Alert level ${alert.rule.security_severity_level} does not meet the policy by isAlertByLevel` | 
| Individual alert being checked for skipping | ./lib/policyManager.js:249 |       info |`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} can be ignored ${ids} ${names} ${cwes}` | 
| Individual alert cannot be skipped | ./lib/policyManager.js:252 |       info |`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} cannot be ignored ${ids} ${names} ${cwes}` | 
| Individual alert is restricted by conditions | ./lib/policyManager.js:259 |         info |`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} meets the condition ${ids} ${names} ${cwes}` | 
| Individual alert is not restricted by conditions | ./lib/policyManager.js:262 |       info |`This alert ${alert.rule.id} ${alert.rule.name} ${alert.rule.tags} does not meet the condition ${ids} ${names} ${cwes}` | 
| Checking individual secret| ./lib/policyManager.js:301 |   info |`Checking if secret ${secret.secret_type} is confined by policy` | 
| Individual secret is restricted by policy | ./lib/policyManager.js:303 |     info |`This secret ${secret.secret_type} confines to policy` | 
| Individual secret is not restricted by policy | ./lib/policyManager.js:306 |   info |`This secret ${secret.secret_type} does not confine to policy` | 
| Individual secret can by ignored | ./lib/policyManager.js:316 |     info |`This secret ${secret.secret_type} can be ignored by policy ${types}` | 
| Individual secret cannot be ignored | ./lib/policyManager.js:319 |   info |`This secret ${secret.secret_type} cannot be ignored by policy ${types}` | 
| Individual secret is restricted by type | ./lib/policyManager.js:324 |     info |`This secret ${secret.secret_type} meets the policy by condition ${types}` | 
| Individual secret is not restricted by type | ./lib/policyManager.js:327 |     info |`This secret ${secret.secret_type} does not meet the policy by condition ${types}` | 
| Comparing by secret type | ./lib/policyManager.js:334 |     debug |`Comparing type in the policy ${type}, type in the secret ${secret.secret_type}` | 
| Comparing by ID | ./lib/policyManager.js:347 |       debug |`Comparing id in the policy ${id}, id in the codescanning alert ${alert.rule.id}` | 
| Comparing by name | ./lib/policyManager.js:357 |       debug |`Comparing name in the policy ${name}, name in the codescanning alert ${alert.rule.name}` | 
| Comparing CWE tags | ./lib/policyManager.js:367 |       debug |`Comparing CWE in the policy ${cwe}, CWE in the codescanning alert ${alert.rule.tags}` | 
| Comparing secret type | ./lib/policyManager.js:383 |       debug |`Comparing type in the policy ${type}, type in the secret ${secret.secret_type}` | 
| Cannot trigger a repository dispatch for a repo because of unexpected error | ./httpsapp.js:148 |   error |`Unexpected error in the trigger endpoint handler ${error}` | 
| Health endpoint fetching top 100 webhook deliveries for the app | ./httpsapp.js:177 |     debug |`Fetching the 100 Webhook Deliveries` | 
| Health endpoint checking the app installation | ./httpsapp.js:185 |     debug |`Fetching the App Installations` | 
| Health endpoint found a app installation | ./httpsapp.js:193 |       debug |`Installation ID: ${installation.id}` | 
| Health endpoint fetching the app details | ./httpsapp.js:194 |       debug |`Fetching the App Details` | 
| Health endpoint validated the app | ./httpsapp.js:198 |       debug |`Validated the app is configured properly = \n${JSON.stringify(app.data, null, 2)}` | 
| Cannot process health check due to unexpected error | ./httpsapp.js:230 |     error |`Unexpected error in the health endpoint handler ${error}` | 
| Handling a ping request | ./httpsapp.js:238 |   info |`Received ping; sending pong` | 
| Cannot process ping due to unexpected error | ./httpsapp.js:241 |   error |`Unexpected error in the ping endpoint handler ${error}` | 
| HTTPS server started | ./httpsapp.js:247 | info |`Started HTTPS Server` | 
| Getting the app details to create an octokit client for handling events not handled by probot | ./httpsapp.js:281 | debug |`Fetching installations` | 
| Got the app details to create an octokit client for handling events not handled by probot | ./httpsapp.js:287 | debug |`The installation for this app is ${JSON.stringify(installation)}` | 


## Logging Message Context
Most log messages will have certain standard metadata. These are:

**Key** | **Value**
-- | --
log_level | Log level
timestamp | timestamp
process::pid | process id
host::hostname | hostname
log::logger | Probot
csp | Cloud
cloud_availability_zone | AZ
cloud_instance_id | Instance Id
container_id | Kubernetes Pod
applicationid | AppId for GHAS Compliance App
productid | Product ID
productlineid | Product Line ID
organization | ECS
environment | Dev, Prod, etc.
ecs::version | ECS Version
name | ghas-compliance (Version) The value is derieved from package.json
childloggername | Could be Application or HTTP to differentiate the child logger name.

## Additional Logging Message Context
Logs generated when processing a webhook will have additional metadata. These are:

**Key** | **Value**
-- | --
traceId | RequestId. This is normally the `x-github-delivery` header
event | GitHub event that triggered the processing
sender | The user who triggered the event
org | The GitHub Org
repository | The GitHub repo
responseTime | time in millis. Generated for HTTP logs and also for logs at the end of processing.
req | Request object. Logged for HTTP logs
res | Response object. Logged for HTTP logs

## Sample Application Log
```json
{
  "log_level": "info",
  "@timestamp": "2022-11-30T13:13:36.628Z",
  "process": {
    "pid": 99970
  },
  "host": {
    "hostname": "Yadhavs-MacBook-Pro.local"
  },
  "log": {
    "logger": "probot"
  },
  "csp": "AWS",
  "cloud_availability_zone": "us-east-1",
  "cloud_instance_id": "UNKNOWN",
  "container_id": "UNKNOWN",
  "applicationid": "AP______",
  "productid": "PR______",
  "productlineid": "PL______",
  "organization": "ECS",
  "environment": "dev",
  "name": "ghas-compliance (1.0.0)",
  "childloggername": "application",
  "traceId": "ca32b830-70b0-11ed-81a2-df8b15595c01",
  "event": "check_run",
  "sender": "decyjphr",
  "org": "decyjphr-org",
  "repository": "decyjphr-ado-migration2",
  "responseTime": 3385,
  "ecs": {
    "version": "1.6.0"
  },
  "message": ">>>> Timing for **check_run** https://api.github.com/repos/decyjphr-org/decyjphr-ado-migration2/check-runs/9796434569 : 3 secs <<<<"
}
```

## Sample HTTP Log
```json
{
  "log_level": "info",
  "@timestamp": "2022-11-30T13:13:37.660Z",
  "process": {
    "pid": 99970
  },
  "host": {
    "hostname": "Yadhavs-MacBook-Pro.local"
  },
  "log": {
    "logger": "probot"
  },
  "csp": "AWS",
  "cloud_availability_zone": "us-east-1",
  "cloud_instance_id": "UNKNOWN",
  "container_id": "UNKNOWN",
  "applicationid": "AP______",
  "productid": "PR______",
  "productlineid": "PL______",
  "organization": "ECS",
  "environment": "dev",
  "name": "ghas-compliance (1.0.0)",
  "childloggername": "http",
  "req": {
    "id": "cc938b90-70b0-11ed-9697-7c7ff602478b",
    "method": "POST",
    "url": "/",
    "query": {},
    "params": {},
    "headers": {
      "host": "6.tcp.ngrok.io:19178",
      "user-agent": "GitHub-Hookshot/35a454f",
      "content-length": "13973",
      "accept": "*/*",
      "x-github-delivery": "cc938b90-70b0-11ed-9697-7c7ff602478b",
      "x-github-event": "check_run",
      "x-github-hook-id": "363406428",
      "x-github-hook-installation-target-id": "210920",
      "x-github-hook-installation-target-type": "integration",
      "x-hub-signature": "sha1=20da49cd1372a23b34e0fd15d648d89d94f9e5aa",
      "x-hub-signature-256": "sha256=4c75a9bbb0111ae8d597926c949e1648d9b56b826f6a3dc074ac7d15af0f75b1",
      "content-type": "application/json",
      "connection": "close"
    },
    "remoteAddress": "::1",
    "remotePort": 56125
  },
  "responseTime": 59,
  "ecs": {
    "version": "1.6.0"
  },
  "res": {
    "statusCode": 200,
    "headers": {
      "x-powered-by": "Express"
    }
  },
  "message": "POST /  200 - 59ms"
}
```