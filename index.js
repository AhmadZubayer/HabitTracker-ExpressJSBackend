const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = 3000;

const admin = require("firebase-admin");
const serviceAccount = require("./habirtracker-mern-firebase-adminsdk.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const app = express();
app.use(cors());
app.use(express.json());

const verifyFireBaseToken = async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    const token = authorization.split(' ')[1];
    
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        console.log('inside token', decoded)
        req.token_email = decoded.email;
        next();
    }
    catch (error) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hxct4cf.mongodb.net/?appName=Cluster0`;
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
    // await client.connect();
    
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
    
    app.post('/habits', verifyFireBaseToken, addHabit);

    // GET endpoint to fetch habits with optional user email filter
    const getAllHabits = async(req, res) => {
      const email = req.query.email;
      const query = {};
      if (email) {
        query.userEmail = email;
        if (email !== req.token_email) {
          return res.status(403).send({ message: 'forbidden access' });
        }
      }
      const result = await habits.find(query).toArray();
      res.send(result);
    };

    app.get('/habits', verifyFireBaseToken, getAllHabits);

    const browsePublicHabits = async(req, res) => {
      try {
        const { search, category, limit } = req.query;
      
        let filter = { isPublic: true };
        
      
        if (category) {
          filter.category = category;
        }
        
        let query = habits.find(filter);
        
        if (limit) {
          query = query.limit(parseInt(limit));
        }
        
        let publicHabits = await query
          .sort({ createdAt: -1 })
          .toArray();
        
        if (search) {
          const searchLower = search.toLowerCase();
          publicHabits = publicHabits.filter(habit => 
            habit.title.toLowerCase().includes(searchLower) ||
            habit.description.toLowerCase().includes(searchLower)
          );
        }
        
        res.json(publicHabits);
      } catch (error) {
        console.error('Error fetching public habits:', error);
        res.status(500).json({ error: 'Failed to fetch public habits' });
      }
    };

    app.get('/habits/public', browsePublicHabits);

    
    const deleteHabit = async(req, res) => {
      const id = req.params.id;
      const habit = await habits.findOne({ _id: new ObjectId(id) });
      if (!habit) {
        return res.status(404).send({ message: 'Habit not found' });
      }
      if (habit.userEmail !== req.token_email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const query = { _id: new ObjectId(id) };
      const result = await habits.deleteOne(query);
      res.send(result);
    };

    app.delete('/habits/:id', verifyFireBaseToken, deleteHabit);

  
    const habitDetails = async(req, res) => {
      try {
        const id = req.params.id;
        const habit = await habits.findOne({ _id: new ObjectId(id) });
        
        if (!habit) {
          return res.status(404).send({ message: 'Habit not found' });
        }
        
        res.send(habit);
      } catch (error) {
        console.error('Error fetching habit:', error);
        res.status(500).send({ message: 'Failed to fetch habit' });
      }
    };

    app.get('/habits/:id', habitDetails);

    
    const updateHabitDetails = async(req, res) => {
      const id = req.params.id;
      const habit = await habits.findOne({ _id: new ObjectId(id) });
      if (!habit) {
        return res.status(404).send({ message: 'Habit not found' });
      }
      if (habit.userEmail !== req.token_email) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: data
      };
      const result = await habits.updateOne(filter, updatedDoc);
      res.send(result);
    };

    app.put('/habits/:id', verifyFireBaseToken, updateHabitDetails);

    
    const markHabitComplete = async(req, res) => {
      try {
        const id = req.params.id;
        const { date } = req.body;
        
      
        const habit = await habits.findOne({ _id: new ObjectId(id) });
        
        if (!habit) {
          return res.status(404).send({ message: 'Habit not found' });
        }
        if (habit.userEmail !== req.token_email) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        const completionHistory = habit.completionHistory || [];
        if (completionHistory.includes(date)) {
          return res.status(400).send({ message: 'Already completed for this date' });
        }
        completionHistory.push(date);
        
        const calculateStreak = (completionHistory) => {
          if (!completionHistory || completionHistory.length === 0) return 0;
          
          const sortedDates = completionHistory.sort((a, b) => new Date(b) - new Date(a));
          let streak = 0;
          
          for (let i = 0; i < sortedDates.length; i++) {
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() - i);
            const expectedDateStr = expectedDate.toISOString().split('T')[0];
            
            if (sortedDates[i] === expectedDateStr) {
              streak++;
            } else {
              break;
            }
          }
          
          return streak;
        };
        
        const newStreak = calculateStreak(completionHistory);
        
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            completionHistory: completionHistory,
            currentStreak: newStreak
          }
        };
        
        const result = await habits.updateOne(filter, updatedDoc);
        
        res.send({ 
          success: true, 
          message: 'Habit marked as complete',
          completionHistory,
          currentStreak: newStreak,
          result 
        });
      } catch (error) {
        console.error('Error marking habit complete:', error);
        res.status(500).send({ message: 'Failed to mark habit complete' });
      }
    };

    app.post('/habits/:id/complete', verifyFireBaseToken, markHabitComplete);
    
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
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
