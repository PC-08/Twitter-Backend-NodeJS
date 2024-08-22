const express = require('express')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'twitterClone.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

const authenticator = async (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'SECERT', async (error, payload) => {
      if (error) {
        console.log(jwtToken)
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

// API 1 REGISTER

app.post('/register/', async (request, response) => {
  const {username, password, name, gender} = request.body
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  console.log(dbUser)
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashedPassword = await bcrypt.hash(password, 10)
      const createUserQuery = `
      INSERT INTO 
        user (name,username,password,gender) 
      VALUES 
        (
          '${name}', 
          '${username}',
          '${hashedPassword}', 
          '${gender}'
        );`
      await db.run(createUserQuery)
      response.send('User created successfully')
    }
  } else {
    response.status(400)
    response.send('User already exists')
  }
})

// API 2 LOGIN

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const comparePassword = await bcrypt.compare(password, dbUser.password)
    if (comparePassword === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'SECERT')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

// API 3  /user/tweets/feed/

app.get('/user/tweets/feed/', authenticator, async (request, response) => {
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']
  console.log(dbUser)
  const getUserFollowingIDSQuery = `
  SELECT 
  user.username,
  tweet.tweet,
  tweet.date_time AS dateTime
  FROM
  tweet INNER JOIN user ON 
  tweet.user_id = user.user_id 
  WHERE
  tweet.user_id IN (
    SELECT
    following_user_id
    FROM
    follower
    WHERE 
    follower_user_id = ${userId}
  )
  ORDER BY 
  tweet.date_time DESC
  LIMIT 4
  `
  const userFollowingIDSArray = await db.all(getUserFollowingIDSQuery)
  response.send(
    userFollowingIDSArray.map(each => {
      return {
        username: each.username,
        tweet: each.tweet,
        dateTime: each.dateTime,
      }
    }),
  )
})

// API $ USER FOLLOWINGS

app.get('/user/following/', authenticator, async (request, response) => {
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']

  const getUserFollowingQuery = `
  SELECT
  name
  FROM 
  user
  WHERE 
  user_id IN (SELECT
    following_user_id
    FROM
    follower
    WHERE 
    follower_user_id = ${userId}) 
  `
  const uesrFollowingusersArray = await db.all(getUserFollowingQuery)
  response.send(uesrFollowingusersArray)
})

// API 5  /user/followers/

app.get('/user/followers/', authenticator, async (request, response) => {
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']

  const getUserFollowersQuery = `
  SELECT
  name
  FROM 
  user
  WHERE 
  user_id IN (SELECT
    follower_user_id
    FROM
    follower
    WHERE 
    following_user_id = ${userId}) 
  `
  const uesrFollowersusersArray = await db.all(getUserFollowersQuery)
  response.send(uesrFollowersusersArray)
})

// API 6 MY TWEETS

app.get('/tweets/:tweetId/', authenticator, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']

  const getTweetIdQuery = `
  SELECT
  tweet.tweet,
  COUNT(DISTINCT like.like_id) AS likes,
  COUNT(DISTINCT reply.reply_id) AS replies,
  tweet.date_time	 AS dateTime
  FROM
  tweet LEFT JOIN like on
  tweet.tweet_id = like.tweet_id
  LEFT JOIN reply ON
  tweet.tweet_id = reply.tweet_id
  where 
  tweet.tweet_id = ${tweetId} AND
  tweet.user_id IN (
    SELECT
    following_user_id
    FROM
    follower
    WHERE 
    follower_user_id = ${userId}
  )
  `
  const getTweetId = await db.get(getTweetIdQuery)

  if (getTweetId.tweet === null) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send(getTweetId)
  }
})

// API 7 /tweets/:tweetId/likes/

app.get('/tweets/:tweetId/likes/', authenticator, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']

  const getTweetIdLIKESQuery = `
  SELECT
  user.username
  FROM
  tweet INNER JOIN like ON
  tweet.tweet_id = like.tweet_id
  INNER JOIN user ON 
  user.user_id = like.user_id 
  INNER JOIN follower ON
  tweet.user_id = follower.following_user_id
  where 
  tweet.tweet_id = ${tweetId} AND
  follower.follower_user_id	 = ${userId} 
  `
  const getTweetIdetTweetIdLIKESArray = await db.all(getTweetIdLIKESQuery)
  let likearry = []
  getTweetIdetTweetIdLIKESArray.map(each => {
    likearry.push(each.username)
  })
  if (getTweetIdetTweetIdLIKESArray.length === 0) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    response.send({likes: likearry})
  }
})

// API 8

app.get(
  '/tweets/:tweetId/replies/',
  authenticator,
  async (request, response) => {
    const {tweetId} = request.params
    const {username} = request
    const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
    const dbUser = await db.get(checkUSerQuery)
    const userId = dbUser['user_id']
    const check_usrFlowwouery = `
    SELECT * 
    FROM 
    follower f
INNER JOIN 
    tweet t ON f.following_user_id = ${tweetId}
WHERE 
    f.follower_user_id = t.user_id
AND 
    t.tweet_id = ${tweetId}`
    const chexkuser = await db.get(check_usrFlowwouery)

    if (chexkuser === undefined) {
      response.status(401)
      response.send('Invalid Request')
    } else {
      const getrepliesquery = `
    SELECT u.username AS name, r.reply
FROM follower f
INNER JOIN tweet t ON f.following_user_id = t.user_id
INNER JOIN reply r ON t.tweet_id = r.tweet_id
INNER JOIN user u ON r.user_id = u.user_id
WHERE f.follower_user_id = ${userId}
  AND t.tweet_id =${tweetId};
  ;`
      const repliesArray = await db.all(getrepliesquery)
      const replies = []
      repliesArray.map(each => {
        replies.shift(each)
      })
      if (replies.length === 0) {
        response.status(401)
        response.send('Invalid Request')
      } else {
        response.send({replies})
      }
    }
  },
)

// API 9 user TWEETs

app.get('/user/tweets/', authenticator, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']

  const getmyTweetsQuery = `
SELECT 
    t.tweet AS tweet,
    COUNT(DISTINCT l.like_id) AS likes,
    COUNT(DISTINCT r.reply_id) AS replies,
    t.date_time AS dateTime
FROM 
    tweet t
LEFT JOIN 
    like l ON t.tweet_id = l.tweet_id
LEFT JOIN 
    reply r ON t.tweet_id = r.tweet_id
WHERE 
    t.user_id = ${userId}
GROUP BY 
    t.tweet_id, t.tweet, t.date_time
ORDER BY 
    t.date_time DESC;

  `
  const getmyTweetsArray = await db.all(getmyTweetsQuery)
  response.send(getmyTweetsArray)
})

// API 10

app.post('/user/tweets/', authenticator, async (request, response) => {
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']
  const {tweet} = request.body
  const postTweet = `
  INSERT INTO
  tweet(tweet,user_id)
  VALUES('${tweet}',
  ${userId})`
  await db.run(postTweet)
  response.send('Created a Tweet')
})

// API 11
app.delete('/tweets/:tweetId/', authenticator, async (request, response) => {
  const {tweetId} = request.params
  const {username} = request
  const checkUSerQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(checkUSerQuery)
  const userId = dbUser['user_id']
  const gettweet = `
  SELECT * FROM 
  tweet
  WHERE
  tweet.user_id = ${userId} AND 
  tweet.tweet_id = ${tweetId}`

  const tweetc = await db.get(gettweet)
  console.log(tweetc)

  if (tweetc === undefined) {
    response.status(401)
    response.send('Invalid Request')
  } else {
    const deletetweetquery = `
  DELETE
  FROM
  tweet
  WHERE
  tweet.user_id = ${userId} AND 
  tweet.tweet_id = ${tweetId}`
    await db.run(deletetweetquery)
    response.send('Tweet Removed')
  }
})

module.exports = app
