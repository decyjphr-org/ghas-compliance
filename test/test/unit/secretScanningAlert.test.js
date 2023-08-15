const { handleSecretScanningAlert } = require('../../lib/secretScanningAlert')
const policyManagerReal = require('../../lib/policyManager')
const secretscanningCreatedPushProtectionPayload = require('../fixtures/secretscanning_created.push_protection.event.json')

describe('handleSecretScanningAlert', () => {
  let context, log

  beforeEach(() => {
    context = {
      payload: secretscanningCreatedPushProtectionPayload,
      repo: jest.fn().mockReturnValue({
        alert_number: secretscanningCreatedPushProtectionPayload.alert.number,
        state: 'open'
      }),
      octokit: {
        secretScanning: {
          updateAlert: jest.fn()
        }
      }
    }
    log = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    }
  })

  it('should update the alert state to open if the user is not a SecurityManager and the secret is detected by policy', async () => {
    // const mockPolicyManager = {
    //   getPolicy: jest.fn().mockResolvedValue(),
    //   getPolicyPath: jest.fn().mockResolvedValue('/path/to/policy'),
    //   isSecretByPolicy: jest.fn().mockReturnValue(true)
    // }
    // jest.mock('../../lib/policyManager', () => jest.fn().mockImplementation(() => mockPolicyManager))

    // const isSecurityManager = false
    // jest.mock('../../lib/checkSecurityManager', () => ({
    //   checkSecurityManager: jest.fn().mockResolvedValue(isSecurityManager)
    // }))

    await handleSecretScanningAlert(context, log)

    // expect(mockPolicyManager.getPolicy).toHaveBeenCalled()
    // expect(mockPolicyManager.getPolicyPath).toHaveBeenCalled()
    // expect(mockPolicyManager.isSecretByPolicy).toHaveBeenCalled()

    expect(context.octokit.secretScanning.updateAlert).toHaveBeenCalledWith({
      alert_number: context.payload.alert.number,
      state: 'open'
    })
    //expect(log.debug).toHaveBeenCalledWith('Checking if the actor is security manager')
    //expect(log.info).toHaveBeenCalledWith('Is the user a security Manager check returned false')
  })
/*
  it('should not update the alert state if the user is a SecurityManager', async () => {
    const isSecurityManager = true
    jest.mock('./checkSecurityManager', () => ({
      checkSecurityManager: jest.fn().mockResolvedValue(isSecurityManager)
    }))

    await handleSecretScanningAlert(context, log)

    expect(context.octokit.secretScanning.updateAlert).not.toHaveBeenCalled()
    expect(log.debug).toHaveBeenCalledWith(`Is the user a security Manager check returned ${isSecurityManager}`)
    expect(log.info).toHaveBeenCalledWith('The user is a SecurityManager. Do not revert the secret')
  })

  it('should update the alert state to open if there is an error getting the policy', async () => {
    const policyManager = {
      getPolicy: jest.fn().mockRejectedValue(new Error('Failed to get policy')),
      getPolicyPath: jest.fn().mockResolvedValue('/path/to/policy'),
      isSecretByPolicy: jest.fn().mockReturnValue(true)
    }
    jest.mock('./policyManager', () => jest.fn().mockImplementation(() => policyManager))

    const isSecurityManager = false
    jest.mock('./checkSecurityManager', () => ({
      checkSecurityManager: jest.fn().mockResolvedValue(isSecurityManager)
    }))

    await handleSecretScanningAlert(context, log)

    expect(policyManager.getPolicy).toHaveBeenCalled()
    expect(policyManager.getPolicyPath).toHaveBeenCalled()
    expect(policyManager.isSecretByPolicy).not.toHaveBeenCalled()
    expect(context.octokit.secretScanning.updateAlert).toHaveBeenCalledWith({
      alert_number: context.payload.alert.number,
      state: 'open'
    })
    expect(log.debug).toHaveBeenCalledWith(`Do not revert the secret. No secret scanning alerts found for the Policy located at "${JSON.stringify('/path/to/policy')}"`)
    expect(log.error).toHaveBeenCalledWith('Unable to get Policy Error: Failed to get policy')
    expect(log.info).toHaveBeenCalledWith('secret-alert-reopened because of error')
  })

  it('should not update the alert state if the secret is not detected by policy', async () => {
    const policyManager = {
      getPolicy: jest.fn().mockResolvedValue(),
      getPolicyPath: jest.fn().mockResolvedValue('/path/to/policy'),
      isSecretByPolicy: jest.fn().mockReturnValue(false)
    }
    jest.mock('./policyManager', () => jest.fn().mockImplementation(() => policyManager))

    const isSecurityManager = false
    jest.mock('./checkSecurityManager', () => ({
      checkSecurityManager: jest.fn().mockResolvedValue(isSecurityManager)
    }))

    await handleSecretScanningAlert(context, log)

    expect(policyManager.getPolicy).toHaveBeenCalled()
    expect(policyManager.getPolicyPath).toHaveBeenCalled()
    expect(policyManager.isSecretByPolicy).toHaveBeenCalled()
    expect(context.octokit.secretScanning.updateAlert).not.toHaveBeenCalled()
    expect(log.debug).toHaveBeenCalledWith(`Do not revert the secret. No secret scanning alerts found for the Policy located at "${JSON.stringify('/path/to/policy')}"`)
  })
*/
})
