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
    
    app.post('/habits', addHabit);

    // GET endpoint to fetch habits by user email
    const getAllHabits = async(req, res) => {
      const email = req.params.email;
      const query = { userEmail: email };
      const result = await habits.find(query).toArray();
      res.send(result);
    };

    app.get('/habits/user/:email', getAllHabits);

    // GET endpoint to fetch all public habits with filters
    const browsePublicHabits = async(req, res) => {
      try {
        const { search, category, limit } = req.query;
        
        // Build query filter
        let filter = { isPublic: true };
        
        // Add category filter
        if (category) {
          filter.category = category;
        }
        
        // Query habits
        let query = habits.find(filter);
        
        if (limit) {
          query = query.limit(parseInt(limit));
        }
        
        let publicHabits = await query
          .sort({ createdAt: -1 }) // Sort by newest first
          .toArray();
        
        // Client-side search filtering (case-insensitive)
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

    // DELETE endpoint to delete a habit by id
    const deleteHabit = async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await habits.deleteOne(query);
      res.send(result);
    };

    app.delete('/habits/:id', deleteHabit);

    // GET endpoint to fetch a single habit by id
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

    // PUT endpoint to update a habit by id
    const updateHabitDetails = async(req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: data
      };
      const result = await habits.updateOne(filter, updatedDoc);
      res.send(result);
    };

    app.put('/habits/:id', updateHabitDetails);

    // POST endpoint to mark habit as complete
    const markHabitComplete = async(req, res) => {
      try {
        const id = req.params.id;
        const { date } = req.body;
        
        // Get the current habit
        const habit = await habits.findOne({ _id: new ObjectId(id) });
        
        if (!habit) {
          return res.status(404).send({ message: 'Habit not found' });
        }
        
        // Initialize completionHistory if it doesn't exist
        const completionHistory = habit.completionHistory || [];
        
        // Check if already completed for this date
        if (completionHistory.includes(date)) {
          return res.status(400).send({ message: 'Already completed for this date' });
        }
        
        // Add the new date to completion history
        completionHistory.push(date);
        
        // Calculate new streak
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
        
        // Update the habit with new completion history and streak
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

    app.post('/habits/:id/complete', markHabitComplete);
    
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
