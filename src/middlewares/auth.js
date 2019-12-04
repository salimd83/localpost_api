const jwt = require('jsonwebtoken')
const ObjectId = require('mongodb').ObjectID

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '')
        const decoded = jwt.verify(token, 'locationmessageapp')
        const user = await req.app.locals.usersCollection.findOne({ _id: ObjectId(decoded._id), 'tokens.token': token })

        if(!user) throw new Error()

        req.token = token
        req.user = user
        next()
    } catch (e) {
        res.status(401).send({error: 'please authenticate!'})
    }
}

module.exports = auth