const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("medi-queue");
    const tutorCollection = db.collection("tutors");
    const BookedSessionsCollection = db.collection("booked-sessions");

    app.get("/tutors", async (req, res) => {
      const result = await tutorCollection.find().toArray();
      res.send(result);
    });
    app.get("/available-tutors", async (req, res) => {
      const result = await tutorCollection.find().limit(6).toArray();
      res.send(result);
    });

    app.post("/tutors", async (req, res) => {
      const newTutor = req.body;
      console.log(newTutor, "newTutor is");
      const result = await tutorCollection.insertOne(newTutor);
      res.send(result);
    });

    app.get("/tutors/:id", async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tutorCollection.findOne(query);
      res.send(result);
    })
    app.get("/booked-sessions", async (req, res) => {
      const result = await BookedSessionsCollection.find().toArray();
      res.send(result);
    });
    app.post("/booked-sessions", async (req, res) => {
      const newSession = req.body;
      console.log(newSession, "newSession is");
      const result = await BookedSessionsCollection.insertOne(newSession);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
