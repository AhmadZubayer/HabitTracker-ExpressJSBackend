const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = 3000;
const app = express();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
 
    await client.connect();
    const database = client.db('habitTracker');
    const habitsCollection = database.collection('habits');
    
   
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // Routes
    app.get('/', (req, res) => {
      res.send('Habit Tracker Server is running');
    });

    // POST endpoint to create a new habit
    app.post('/habits', async (req, res) => {
      const data = req.body;
      const date = new Date();
      data.createdAt = date;
      console.log(data);
      const result = await habitsCollection.insertOne(data);
      res.send(result);
    });

    // GET endpoint to fetch all habits for a specific user by email
    app.get('/habits/user/:email', async (req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await habitsCollection.find(query).toArray();
      res.send(result);
    });

    // GET endpoint to fetch a single habit by ID
    app.get('/habits/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await habitsCollection.findOne(query);
      res.send(result);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, ()=> {
  console.log(`server is running on port ${port}`);
});
