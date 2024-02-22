const express = require('express')
const path = require('path')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()

app.use(express.json())

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(-1)
  }
}
initializeDBAndServer()

module.exports = app

const convertObjecttoResponseObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertObjecttoResponseObject2 = dbObject2 => {
  return {
    districtId: dbObject2.district_id,
    districtName: dbObject2.district_name,
    stateId: dbObject2.state_id,
    cases: dbObject2.cases,
    cured: dbObject2.cured,
    active: dbObject2.active,
    deaths: dbObject2.deaths,
  }
}

// API 1

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const authenticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//  API 2

app.get('/states/', authenticationToken, async (request, response) => {
  const getStatesQuery = `
  SELECT *
  FROM state
  ORDER BY state_id;`
  const allStates = await db.all(getStatesQuery)
  response.send(
    allStates.map(dbObject => convertObjecttoResponseObject(dbObject)),
  )
})

//  API 3

app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT *
  FROM state
  WHERE state_id = ${stateId};`

  const state = await db.get(getStateQuery)
  response.send(convertObjecttoResponseObject(state))
})

//  API 4

app.post('/districts/', authenticationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body

  const createDistrict = `
  INSERT INTO
    district (district_name, state_id, cases, cured, active, deaths)
  VALUES (
    '${districtName}',
    ${stateId},
    ${cases},
    ${cured},
    ${active},
    ${deaths}
  );`

  await db.run(createDistrict)
  response.send('District Successfully Added')
})

//  API 5

app.get(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params

    const getDistrictQuery = `
    SELECT *
    FROM district
    WHERE district_id = ${districtId};`

    const district = await db.get(getDistrictQuery)
    response.send(convertObjecttoResponseObject2(district))
  },
)

//  API 6

app.delete(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params

    const deleteDistrictQuery = `
  DELETE FROM
    district
  WHERE district_id = ${districtId};`

    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//  API 7

app.put(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params

    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updateDistrictQuery = `
  UPDATE district
  SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
  WHERE 
    district_id = ${districtId};`

    await db.run(updateDistrictQuery)
    response.send('District Details Updated')
  },
)

//  API 8

app.get(
  '/states/:stateId/stats/',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params

    const getStatsQuery = `
  SELECT 
    sum(cases) AS totalCases,
    sum(cured) AS totalCured,
    sum(active) AS totalActive,
    sum(deaths) AS totalDeaths
  FROM 
    district
  WHERE 
    state_id = ${stateId};`

    const stats = await db.get(getStatsQuery)
    response.send(stats)
  },
)
