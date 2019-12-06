const MongoClient = require("mongodb").MongoClient;

const url = process.env.MONGODB_URL;
const dbName = process.env.MONGODB_DB_NAME;
const client = new MongoClient(url, { useUnifiedTopology: true });

// Use connect method to connect to the Server
async function connect(callback) {
  try {
    await client.connect();
    const db = client.db(dbName);

    const messages = db.collection("messages");
    messages.createIndex({ location: "2dsphere" });

    db.createCollection("users", {
        validator: {
            $jsonSchema: {
                bsonType: "object",
                required: [ "firstName", "lastName", "email", "password" ],
                properties: {
                    firstName: {
                        bsonType: "string",
                        description: "must be a string and is required"
                    },
                    lastName: {
                        bsonType: "string",
                        description: "must be a string and is required"
                    },
                    email: {
                        bsonType: "string",
                        pattern: '^.+\@.+$',
                        description: "required and must be a valid email address"
                    },
                    password: {
                        bsonType: "string",
                        minLength: 6,
                        description: "required and must be at least 6 chracters"
                    }
                }
            }
        }
    });
    const users = db.collection("users")
    users.createIndex( { "email": 1 }, { unique: true } )


    callback({messages, users})
  } catch (e) {
    console.log("could not connect to database", e);
  }
}

module.exports = connect;
