const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const ObjectId = require("mongodb").ObjectID;
const router = express.Router();
const auth = require("../middlewares/auth");
const multer = require("multer");
const sharp = require("sharp");

const emailConfig = {
  service: "gmail",
  auth: {
    user: "salimdirani@gmail.com",
    pass: process.env.GMAIL_PASS
  }
};

// to be set in a config file
const baseUrl = process.env.BASE_URL;

router.post("/users", async (req, res) => {
  try {
    req.body.password = await hashPass(req.body.password);

    const results = await req.app.locals.usersCollection.insertOne({
      ...req.body,
      isEmailVerified: false,
      tokens: [],
      createdAt: new Date()
    });
    const user = results.ops[0];

    const token = jwt.sign(
      { _id: user._id.toString() },
      process.env.JWT_SECRET
    );

    await req.app.locals.usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          tokens: user.tokens.concat({ token })
        }
      }
    );

    res.status(201).send({
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.lastName,
        id: user._id,
        createdAt: user.createdAt
      },
      token
    });
  } catch (e) {
    console.log(e);
    res
      .status(400)
      .send(e.code === 11000 ? { message: "Email already in use" } : "");
  }
});

router.get("/users/sendVerificationEmail", auth, async (req, res) => {
  if (req.user.isEmailVerified) {
    console.log("Email already verified");
    res.send({ message: "email already verified" });
    return;
  }
  var transporter = nodemailer.createTransport(emailConfig);

  var mailOptions = {
    from: "salimdirani@gmail.com",
    to: req.user.email,
    subject: "Location message app: email verification",
    html: `
          Dear ${req.user.firstName} ${req.user.lastName} <br /><br />
          Thank you for registering with Location messages app. <br />
          To complete registration you need to click the link below to verify your account:<br />
          <a href="${baseUrl}/users/verifyEmail?t=${req.token}&r=${req.query.redirect}">${baseUrl}/users/verifyEmail?t=${req.token}&r=${req.query.redirect}</a>
          <br />
          <br />
          Sincerly,<br />
          Location Message Team
        `
  };

  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
      res.status(500).send();
      return;
    }

    res
      .status(200)
      .send({ message: "Follow the email sent to your account to verify it." });
  });
});

router.get("/users/verifyEmail", async (req, res) => {
  try {
    const token = req.query.t;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await req.app.locals.usersCollection.findOne({
      _id: ObjectId(decoded._id),
      "tokens.token": token
    });

    if (!user) throw new Error();

    await req.app.locals.usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          isEmailVerified: true
        }
      }
    );

    // res.send({ message: "email verified" });
    res.redirect(req.query.r);
  } catch (e) {
    res.status(401).send({ error: "please authenticate!" });
  }
});

router.post("/users/login", async (req, res) => {
  try {
    const user = await req.app.locals.usersCollection.findOne({
      email: req.body.email
    });
    if (!user) throw new Error("Wrong email/password combination");

    const isMatch = await bcrypt.compare(req.body.password, user.password);
    if (!isMatch) throw new Error("Wrong email/password combination");

    const token = jwt.sign(
      { _id: user._id.toString() },
      process.env.JWT_SECRET
    );
    await req.app.locals.usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          tokens: user.tokens.concat({ token })
        }
      }
    );

    res.send({
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.lastName,
        id: user._id,
        createdAt: user.createdAt
      },
      token
    });
  } catch (e) {
    console.log(e);
    res.status(401).send({ message: e.message });
  }
});

router.post("/users/forgotPassword", async (req, res) => {
  console.log(req.body.email);
  const user = await req.app.locals.usersCollection.findOne({
    email: req.body.email
  });

  if (!user) {
    res.status(404).send({ message: "Account does not exisit" });
    return;
  }

  const token = jwt.sign({ _id: user._id.toString() }, process.env.JWT_SECRET2);

  var transporter = nodemailer.createTransport(emailConfig);

  var mailOptions = {
    from: "salimdirani@gmail.com",
    to: user.email,
    subject: "Location message app: email verification",
    html: `
          Dear ${user.firstName} ${user.lastName} <br /><br />
          You recently requested to change password. <br />
          To change your password use the link below:<br />
          <a href="${req.body.redirect}?t=${token}">${req.body.redirect}?t=${token}</a>
          <br />
          <br />
          Sincerly,<br />
          Location Message Team
        `
  };

  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
      res.status(500).send();
      return;
    }

    res.status(200).send({ message: "email sent successfully" });
  });
});

router.post("/users/resetPassword", async (req, res) => {
  if (!req.body.token) {
    res.status(404).send();
  }
  const decoded = jwt.verify(req.body.token, process.env.JWT_SECRET2);
  const user = await req.app.locals.usersCollection.findOne({
    _id: ObjectId(decoded._id)
  });

  if (!user) res.status(404).send();

  const hashedPass = await hashPass(req.body.password);

  try {
    const token = jwt.sign(
      { _id: user._id.toString() },
      process.env.JWT_SECRET
    );
    await req.app.locals.usersCollection.updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPass,
          tokens: [{ token }]
        }
      }
    );
    res.send({
      token,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.lastName,
        id: user._id,
        createdAt: user.createdAt
      }
    });
  } catch (e) {
    console.log(e);
    res.status(400).send(e.message);
  }
});

router.post("/users/logout", auth, async (req, res) => {
  try {
    req.user.tokens = req.user.tokens.filter(token => {
      return token.token !== req.token;
    });
    await req.app.locals.usersCollection.updateOne(
      { _id: req.user._id },
      {
        $set: {
          tokens: req.user.tokens
        }
      }
    );
    res.send();
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

router.post("/users/logoutAll", auth, async (req, res) => {
  try {
    req.user.tokens = [];
    await req.app.locals.usersCollection.updateOne(
      { _id: req.user._id },
      {
        $set: {
          tokens: []
        }
      }
    );
    res.send();
  } catch (e) {
    res.status(500).send();
  }
});

router.get("/users/me", auth, async (req, res) => {
  res.send({
    firstName: req.user.firstName,
    lastName: req.user.lastName,
    email: req.user.email,
    id: req.user._id,
    createdAt: req.user.createdAt
  });
});

const upload = multer({
  limits: {
    filesize: 2000000,
    fileFilter(req, file, cb) {
      if (!file.originalname.match(/\.(jpg|jpeg|gif|png)$/)) {
        return cb(new Error("Please upload an image"));
      }
      cb(undefined, true);
    }
  }
});

router.post(
  "/user/me/avatar",
  auth,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const buffer = await sharp(req.file.buffer)
        .resize({ width: 250, height: 250 })
        .png()
        .toBuffer();
      await req.app.locals.usersCollection.updateOne(
        { _id: req.user._id },
        {
          $set: {
            avatar: buffer
          }
        }
      );
      res.send();
    } catch (e) {
      req.status(500).send();
    }
  },
  (error, req, res, next) => {
    res.status(400).send({ error: error.message });
  }
);

router.delete("/user/me/avatar", auth, async (req, res) => {
  try {
    await req.app.locals.usersCollection.updateOne(
      { _id: req.user._id },
      {
        $set: {
          avatar: undefined
        }
      }
    );
    res.send();
  } catch (e) {
    res.status(500).send();
  }
});

router.get("/users/:id/avatar", async (req, res) => {
  try {
    const user = await req.app.locals.usersCollection.findOne({
      _id: ObjectId(req.params.id)
    });

    if (!user) {
      throw new Error();
    }

    if (!user.avatar) {
      res.redirect(
        `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}`
      );
    }

    res.set("Content-Type", "image/png");
    res.send(user.avatar.buffer);
  } catch (e) {
    res.status(404).send();
  }
});

async function hashPass(pass) {
  return await bcrypt.hash(pass, 8);
}

module.exports = router;
