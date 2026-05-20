const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
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
const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({
      message: "Unauthorized access",
    });
  }
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).send({
      message: "Unauthorized access",
    });
  }
  try {
    const { payload } = await jwtVerify(token, JWKS);

    next();
  } catch (error) {
    return res.status(403).send({
      message: "Forbidden access",
    });
  }
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const db = client.db("medi-queue");
    const tutorCollection = db.collection("tutors");
    const BookedSessionsCollection = db.collection("booked-sessions");

    app.get("/tutors", verifyToken, async (req, res) => {
      try {
        const { tutorName, sessionStartDate, sessionEndDate } = req.query;

        let query = {};

        if (tutorName) {
          query.tutorName = {
            $regex: tutorName,
            $options: "i",
          };
        }

        if (sessionStartDate || sessionEndDate) {
          query.sessionStartDate = {};

          if (sessionStartDate) {
            query.sessionStartDate.$gte = sessionStartDate;
          }

          if (sessionEndDate) {
            query.sessionStartDate.$lte = sessionEndDate;
          }
        }

        const result = await tutorCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Something went wrong",
        });
      }
    });

    app.get("/available-tutors", verifyToken, async (req, res) => {
      const result = await tutorCollection.find().limit(6).toArray();
      res.send(result);
    });

    app.post("/tutors", async (req, res) => {
      const newTutor = req.body;
      const result = await tutorCollection.insertOne(newTutor);
      res.send(result);
    });

    app.get("/my-tutors", async (req, res) => {
      const email = req.query.email?.trim();
      const result = await tutorCollection.find({ userEmail: email }).toArray();

      res.send(result);
    });

    app.get("/tutors/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await tutorCollection.findOne(query);
      res.send(result);
    });
    app.get("/booked-sessions", verifyToken, async (req, res) => {
      const email = req.query.email?.trim();
      const result = await BookedSessionsCollection.find({
        userEmail: email,
      }).toArray();
      res.send(result);
    });

    app.patch("/booked-sessions/:id", verifyToken, async (req, res) => {
      try {
        const id = req.params.id;

        const filter = {
          _id: new ObjectId(id),
        };

        // First get booked session
        const bookedSession = await BookedSessionsCollection.findOne(filter);

        if (!bookedSession) {
          return res.status(404).send({
            message: "Booked session not found",
          });
        }

        // Update status
        const updateDoc = {
          $set: {
            status: req.body.status,
          },
        };

        const result = await BookedSessionsCollection.updateOne(
          filter,
          updateDoc,
        );

        // Increase tutor totalSlot by 1
        await tutorCollection.updateOne(
          {
            _id: new ObjectId(bookedSession.tutorId),
          },
          {
            $inc: {
              totalSlot: 1,
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });

    app.post("/booked-sessions", async (req, res) => {
      try {
        const newSession = req.body;
        const tutor = await tutorCollection.findOne({
          _id: new ObjectId(newSession.tutorId),
        });

        if (!tutor) {
          return res.status(404).send({
            success: false,
            message: "Tutor not found",
          });
        }
        const currentSlot = Number(tutor.totalSlot);

        if (currentSlot <= 0) {
          return res.status(400).send({
            success: false,
            message: "No available slots left.",
          });
        }

        const bookedResult =
          await BookedSessionsCollection.insertOne(newSession);

        const updateResult = await tutorCollection.updateOne(
          {
            _id: new ObjectId(newSession.tutorId),
          },
          {
            $inc: {
              totalSlot: -1,
            },
          },
        );
        const updatedTutor = await tutorCollection.findOne({
          _id: new ObjectId(newSession.tutorId),
        });

        return res.send({
          success: true,
          message:
            updatedTutor.totalSlot === 0
              ? "This session is fully booked. You can’t join at the moment."
              : "Booking successful",
          bookedResult,
          updatedSlot: updatedTutor.totalSlot,
        });
      } catch (error) {
        return res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
