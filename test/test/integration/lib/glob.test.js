const Glob = require('../../../lib/Glob')
const PolicyManager = require('../../../lib/Glob')


describe('glob test', function () {

  test('Test Glob **', () => {
    let str = 'test/web/xss'
    let pattern = new Glob('**/xss')
    expect(str.search(pattern)>=0).toBeTruthy()

    pattern = new Glob('**/*.txt')
    str = 'sub/3.txt'
    expect(str.search(pattern)>=0).toBeTruthy()

    pattern = new Glob('**/csrf-protection-disabled')
    str = 'java/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeTruthy()
  })

  test('Test Glob *', () => {
    let str = 'web/xss'
    let pattern = new Glob('*/xss')
    expect(str.search(pattern)>=0).toBeTruthy()

    pattern = new Glob('./[0-9].*')
    str = './1.gif'
    expect(str.search(pattern)>=0).toBeTruthy()
    str = './2.gif'
    expect(str.search(pattern)>=0).toBeTruthy()

    pattern = new Glob('*/csrf-protection-disabled')
    str = 'java/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeTruthy()
    str = 'rb/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeTruthy()

    pattern = new Glob('*/hardcoded-credential*')
    str = 'java/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeFalsy()
    str = 'rb/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeFalsy()
    str = 'cs/hardcoded-credentials'
    expect(str.search(pattern)>=0).toBeTruthy()
    str = 'java/hardcoded-credential-api-call'
    expect(str.search(pattern)>=0).toBeTruthy()

  })

  test('Test Glob no *', () => {
    let pattern = new Glob('csrf-protection-disabled')
    let str = 'java/hardcoded-credential-api-call'
    expect(str.search(pattern)>=0).toBeFalsy()
    str = 'cs/test/hardcoded-credentials'
    expect(str.search(pattern)>=0).toBeFalsy()
    str = 'rb/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeTruthy()
    str = 'java/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeTruthy()

    pattern = new Glob('csrf')
    str = 'java/hardcoded-credential-api-call'
    expect(str.search(pattern)>=0).toBeFalsy()
    str = 'cs/test/hardcoded-credentials'
    expect(str.search(pattern)>=0).toBeFalsy()
    str = 'rb/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeTruthy()
    str = 'java/csrf-protection-disabled'
    expect(str.search(pattern)>=0).toBeTruthy()
  })
  
})

