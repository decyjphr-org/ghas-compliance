const envHelper = require('../../../lib/EnvHelper')

describe('Env test', function () {

  test('Test Env **', () => {
    // Make sure you have a .env file in the root of your project
    expect(envHelper.getEnv().appId).toBe('210920')
  })
  
//   test('Test Print Env **', () => {
//     // Make sure you have a .env file in the root of your project
//     expect(envHelper.toString()).toBe(
// `{
//   "appId": "210920",
//   "logLevel": "trace",
//   "csp": "AWS",
//   "cloudAvailabilityZone": "us-east-1",
//   "cloudInstanceId": "UNKNOWN",
//   "containerId": "UNKNOWN",
//   "applicationId": "AP______",
//   "productId": "PR______",
//   "productLineId": "PL______",
//   "organization": "ECS",
//   "environment": "dev",
//   "proxyUrl": "https://smee.io/c0K6pSzcAyvvTjF",
//   "maxAlerts": 75
// }`)
//   })
})

