'use strict'

/* Dependencies */
const express = require('express')
const app = express()
const helmet = require('helmet')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const MongoStore = require('rate-limit-mongo')
const jwtValidator = require('express-jwt')

/* Configure our rest client */
const client = {
  apiSettings: require('./settings/api_settings.json'),
  appid: process.env.APPID || 1,
  engine: {}
}

app.use(helmet())
app.use(morgan('common'))
app.set('trust proxy', 1)
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

/* JWT Validation and erroring */
app.use(jwtValidator({
  secret: client.apiSettings.jwt.secret,
  algorithms: [client.apiSettings.jwt.algorithm]
})
  .unless({
    path: client.apiSettings.jwt.ignored_routes
  })
)

/* catchall error handling */
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ type: 'Authorization', errors: ['Invalid authorization token.'] })
  }
  next()
})

/* Require our engines/libs and pass our client */
require('./library/database.js')(client)
require('./library/engine.js')(client)

/* Rate Limiting */
const uri = `mongodb://${client.apiSettings.mongodb.host}:${client.apiSettings.mongodb.host.port}/${client.apiSettings.mongodb.database}`

const generalLimiter = rateLimit({
  store: new MongoStore({
    uri,
    collectionName: client.apiSettings.rate_limit.general.collection_name,
    user: client.apiSettings.mongodb.username,
    password: client.apiSettings.mongodb.password
  }),
  max: client.apiSettings.rate_limit.general.max,
  windowMs: client.apiSettings.rate_limit.general.window_ms
})

const authLimiter = rateLimit({
  store: new MongoStore({
    uri,
    collectionName: client.apiSettings.rate_limit.auth.collection_name,
    user: client.apiSettings.mongodb.username,
    password: client.apiSettings.mongodb.password
  }),
  max: client.apiSettings.rate_limit.auth.max,
  windowMs: client.apiSettings.rate_limit.auth.window_ms
})

app.use(generalLimiter) // Configured to 2000 request max per 10
app.use('/auth/', authLimiter) // Configured to 40 request max per 5 mins

/* Routing */

// Public endpoints
app.use('/', require('./routes/public/index.js')(client))
app.use('/auth', require('./routes/public/auth.js')(client))

// Private endpoints
app.use('/dashboard', require('./routes/private/dashboard.js')(client))

/* Listen on http */
app.listen(client.apiSettings.api.port, () => {
  console.log(`API instance: ${client.appid} - listening on port ${client.apiSettings.api.port}!`)

  // Connection loop to connect to mongodb
  console.log('Attempting to connect to database')
  client.connectDatabase()
    .then(() => {
      console.log('Connected database.')
    })
    .catch(() => {
      console.log('Failed to connect to database. Shutting down.')
      process.exit(1)
    })
})
