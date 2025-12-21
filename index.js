const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = 3000;
const app = express();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = "mongodb+srv://habit_tracker:8UzxkckFb29APC4V@cluster0.hxct4cf.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    
    // Setup database and collection
    const database = client.db('habitTracker');
    const habits = database.collection('habits');

    // POST endpoint to create a new habit
    const addHabit = async(req, res) => {
      const data = req.body;
      const date = new Date();
      data.createdAt = date;
      console.log(data);
      const result = await habits.insertOne(data);
      res.send(result);
    };
    
    app.post('/habits', addHabit);

    // GET endpoint to fetch habits by user email
    const getAllHabits = async(req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await habits.find(query).toArray();
      res.send(result);
    };

    app.get('/habits/user/:email', getAllHabits);

    // DELETE endpoint to delete a habit by id
    const deleteHabit = async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await habits.deleteOne(query);
      res.send(result);
    };

    app.delete('/habits/:id', deleteHabit);
    
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req,res) => {
res.send('hello from express');
});

app.listen(port, ()=> {
console.log(`server is running on port ${port}`);
});
