
'use strict'

/**
 * Dependencies
 */
const express = require('express')
const router = express.Router()
const { body, validationResult } = require('express-validator')
const argon2 = require('argon2')
const jwt = require('jsonwebtoken')
const shortuid = require('short-uuid')()

module.exports = client => {
  /* Our main index endpoint */
  router.get('/', (req, res) => {
    res.send('Welcome to the auth endpoint.')
  })

  /* Our registration endpoint */
  router.post('/register', [
    body('email').isEmail().normalizeEmail(),
    body('username').isLength({ min: 3, max: 32 }),
    body('password').isLength({ min: 5, max: 100 })
  ], async (req, res) => {
    // If validation error occured, error with errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ type: 'validation', errors: errors.array() }) // Return validation errors
    }

    // Check if email in use
    const userEmailCheck = await client.database.collection('users').findOne({ email: req.body.email })
    if (userEmailCheck) {
      return res.status(400).json({ type: 'database', errors: ['Email or username already in use.'] })
    }

    // Check if username in use
    const userNameCheck = await client.database.collection('users').findOne({ email: req.body.username })
    if (userNameCheck) {
      return res.status(400).json({ type: 'database', errors: ['Email or username already in use.'] })
    }

    // Hash our password
    const hash = await argon2.hash(req.body.password)
    if (!hash) return res.status(500).json({ type: 'server', errors: ['Internal server error.'] })

    // Write user account to database
    await client.database.collection('users').insert({
      uuid: shortuid.new(),
      email: req.body.email,
      username: req.body.username,
      password: hash
    })
      .then(res.status(200).json({ status: 'success' }))
  })

  /* Our authentication endpoint */
  router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 5, max: 100 })
  ], async (req, res) => {
    // If validation error occured, error with errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ type: 'validation', errors: errors.array() }) // Return validation errors
    }

    // Check if email exist
    const userEntryCheck = await client.database.collection('users').findOne({ email: req.body.email })
    if (!userEntryCheck) {
      return res.status(400).json({ type: 'database', errors: ['Invalid email or password.'] })
    }

    // Check password
    const validation = await argon2.verify(userEntryCheck.password, req.body.password)
    if (!validation) return res.status(400).json({ type: 'database', errors: ['Invalid email or password.'] })

    // Create and sign a JWT containing the user ID
    const token = jwt.sign(
      { uuid: userEntryCheck.uuid },
      client.apiSettings.jwt.secret,
      {
        algorithm: client.apiSettings.jwt.algorithm,
        expiresIn: client.apiSettings.jwt.expiresIn
      })
    res
      .status(200)
      .json({ status: 'success', token })
  })

  return router
}
