const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const app = express();
const port = process.env.PORT || 5000;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
// middleware
app.use(cors());
app.use(express.json());

app.post("/jwt", (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });

  res.send({ token });
});

//middleware function for verifying token
function verifyJWT(req, res, next) {
  const authorization = req.headers.authorization;
  // console.log(authorization);
  if (!authorization) {
    return res.status(401).send({ error: "Unauthorized access!" });
  }
  // step -2 . Verify if the provided token is valid or not.
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // console.log({ err });
    if (err) {
      return res.status(403).send({ error: "Unauthorized access!" });
    }
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oeh6vj2.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  const usersCollection = client.db("brainBloom").collection("users");
  const coursesCollection = client.db("brainBloom").collection("courses");

  // get all user
  app.get("/users", async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  });

  // current user data
  app.get("/users/:email", verifyJWT, async (req, res) => {
    const email = req.params.email;
    const query = { email: email }; // Creating a query object with the email field
    const result = await usersCollection.findOne(query);
    res.send(result);
  });

  // Save user in DB during sign up
  app.post("/users", async (req, res) => {
    const user = req.body;
    console.log(user);
    const result = await usersCollection.insertOne(user);
    res.send(result);
  });

  //get Courses

  app.get("/courses", async (req, res) => {
    const result = await coursesCollection.find().toArray();
    res.send(result);
  });

  // single course for course details
  app.get("/course/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await coursesCollection.findOne(query);

    res.send(result);
  });

  // search
  app.get("/courses/search/:searchText", async (req, res) => {
    const searchText = req.params.searchText;
    const minRating = parseFloat(req.params.searchText) || 0;
    const result = await coursesCollection
      .find({
        $or: [
          { category: { $regex: searchText, $options: "i" } },
          { "instructor.name": { $regex: searchText, $options: "i" } },
          { rating: { $gte: minRating, $regex: searchText } },
        ],
      })
      .toArray();

    res.send(result);
  });

  // enrolled a class by a student
  app.post("/enrolled", verifyJWT, async (req, res) => {
    const { userId, courseId } = req.body;

    const filter = { _id: new ObjectId(userId) };
    const user = await usersCollection.findOne(filter);

    if (user) {
      if (!user.enrolledCourses) {
        user.enrolledCourses = [courseId];
      } else {
        if (user.enrolledCourses.includes(courseId)) {
          return res.send({ error: true, message: "Already Enrolled!" });
        }

        user.enrolledCourses.push(classId);
      }
      // Update the user in the database
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(filter, updateDoc);
      return res.send(result);
    } else {
      return res.send({ message: "User not found" });
    }
    res.send([]);
  });

  app.patch("/fav", verifyJWT, async (req, res) => {
    const { userId, courseId } = req.body;

    const filter = { _id: new ObjectId(userId) };
    const user = await usersCollection.findOne(filter);

    if (user) {
      if (!user.favCourses) {
        user.favCourses = [courseId];
      } else {
        if (user.favCourses.includes(courseId)) {
          user.favCourses = user.favCourses.filter(
            (course) => course !== courseId
          );
          const updateDoc = { $set: user };
          const result = await usersCollection.updateOne(filter, updateDoc);
          return res.send({ error: true, message: "Remove From Favorite!" });
        }

        user.favCourses.push(courseId);
      }
      // Update the user in the database
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(filter, updateDoc);
      return res.send(result);
    } else {
      return res.send({ message: "User not found" });
    }
    res.send([]);
  });

  // for each instructor to add a cls ***
  app.post("/courses", verifyJWT, async (req, res) => {
    const doc = req.body;
    result = await coursesCollection.insertOne(doc);
    res.send(result);
  });

  //manage my courses
  app.get(
    "/courses/:email",
    verifyJWT,

    async (req, res) => {
      const email = req.params.email;
      const query = { "instructor.email": email };
      const result = await coursesCollection.find(query).toArray();
      res.send(result);
    }
  );

  // course status
  app.patch("/course/:id",  async (req, res) => {
    const id = req.params.id;
    console.log(id)
    const query = { _id: new ObjectId(id) };
    const body = req.body;
    const updatedData = {
      $set: {
        ...(body?.status && { status: body.status }),
      
      },
    };    const result = await coursesCollection.updateOne(query, updatedData);
    res.send(result);
  });

 
  app.delete("/deleteCourse/:id", verifyJWT, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await coursesCollection.deleteOne(query);
    res.send(result);
  });

  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send(`Brain Bloom is running at port ${port}`);
});

app.listen(port, () => {
  console.log(`Brain Bloom is running at port ${port}`);
});
