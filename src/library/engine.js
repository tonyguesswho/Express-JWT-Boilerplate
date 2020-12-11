'use strict'

module.exports = client => {
  let engine = client.engine

  // API's engine / functionality

  engine.test = () => {
      return true
  }
}
