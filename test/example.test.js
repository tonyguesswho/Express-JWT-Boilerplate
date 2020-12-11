'use strict'

const client = {
  apiSettings: require('../src/settings/api_settings.json'),
  engine: {}
}

beforeAll(async () => {
  /* Get our functionality engine */
  require('../src/library/engine.js')(client)

  /* Connect our database */
  require('../src/library/database')(client)

  /* Connect database */
  await client.connectDatabase()
    .then(() => console.log('Database connected.'))
    .catch(e => { throw new Error('Could not connect to database') })
}, 10000) // 10 second timeout connecting to db

/* Begin unit testing */
test('test function returns true', () => {
  expect(client.engine.test()).toBe(true)
})