
class Validator {
  // Refer to https://github.com/github/github/blob/master/lib/github/html/commit_path_parser.rb
  static #REPONAME_REGEX = /^(?:\w|\.|-)+$/i
  static #USERNAME_REGEX = /^-?[a-z0-9][a-z0-9\-_]*$/i
  static isValidRepoName (repoName) {
    if ((repoName.search(Validator.#REPONAME_REGEX)) >= 0) {
      return true
    }
    throw new Error(`Repo Name is Invalid ${repoName}; should match the pattern ${Validator.#REPONAME_REGEX}`)
  }

  static isValidUserName (userName) {
    if ((userName.search(Validator.#USERNAME_REGEX)) >= 0) {
      return true
    }
    throw new Error(`User or Org Name is Invalid ${userName}; should match the pattern ${Validator.#USERNAME_REGEX}`)
  }
}

module.exports = Validator
