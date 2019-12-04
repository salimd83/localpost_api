require('dotenv').config()
const express = require("express");
const cors = require("cors");
const messageRouter = require("./routers/message");
const userRouter = require("./routers/user");
const connect = require("./database/connect");

const port = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
app.use(messageRouter);
app.use(userRouter);

connect(collections => {
  app.locals.messagesCollection = collections.messages;
  app.locals.usersCollection = collections.users;

  app.listen(port, () => console.log(`App listening on port ${port}!`));
});
