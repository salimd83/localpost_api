const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth");

router.post("/messages", auth, async (req, res) => {
  try {
    const results = await req.app.locals.messagesCollection.insertOne({
      message: req.body.message,
      owner: req.user._id,
      location: {
        type: "Point",
        coordinates: [parseFloat(req.body.long), parseFloat(req.body.lat)]
      },
      createdAt: Date.now()
    });
    res.status(201).send({
      ...results.ops[0],
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.lastName,
        id: req.user._id,
        createdAt: req.user.createdAt
      }
    });
  } catch (e) {
    console.log(e);
    res
      .status(500)
      .send({ message: "could not insert message please try again" });
  }
});

router.get("/messages", auth, async (req, res) => {
  try {
    const results = await req.app.locals.messagesCollection
      .aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [
                parseFloat(req.query.long),
                parseFloat(req.query.lat)
              ]
            },
            distanceField: "distance",
            maxDistance: Math.round(parseFloat(req.query.long)),
            spherical: true
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $project: { "user.password": 0, "user.tokens": 0 }
        },
        {
          $sort: {createdAt: -1}
        }
      ])
      .toArray();
    res.send(results);
  } catch (e) {
    console.log(e);
    res.status(400).send({ message: "Wrong request params" });
  }
});

module.exports = router;
