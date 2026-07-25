// import express, { Request, Response } from 'express';
// import cors from 'cors';
// import dotenv from 'dotenv';

// dotenv.config();

// const app = express();
// const port = process.env.PORT || 5000;

// app.use(cors());
// app.use(express.json());

// const { MongoClient, ServerApiVersion } = require('mongodb');

// app.get('/', (req: Request, res: Response) => {
//   res.send('Hello World!.This is my first express server with typescript');
// });


// // all code copy for mongodb drivers



// const uri = "mongodb+srv://<db_username>:<db_password>@cluster0.axh4m1p.mongodb.net/?appName=Cluster0";

// // Create a MongoClient with a MongoClientOptions object to set the Stable API version
// const client = new MongoClient(uri, {
//   serverApi: {
//     version: ServerApiVersion.v1,
//     strict: true,
//     deprecationErrors: true,
//   }
// });

// async function run() {
//   try {
//     // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
//     // Send a ping to confirm a successful connection
//     await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
//     // Ensures that the client will close when you finish/error
//     // await client.close();
//   }
// }
// run().catch(console.dir);





// app.listen(port, () => {
//   console.log(`Server listening on port ${port}`);
// });




import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient, ServerApiVersion } from 'mongodb'; // <-- Fixed Here!

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB URI (.env file theke anatai standard practice)
const uri = process.env.MONGODB_URI || "";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


// interface Menu {
//   title: string;
//   content: string[];
//   year: number;
//   cast: string[];
// }

async function run() {
  try {

     const database = client.db("foodflow");
    const menuCollection = database.collection("all-menu");
    app.post('/api/all-menu', async(req:Request, res:Response)=>{
       const menu = req.body;
       const result = await menuCollection.insertOne(menu);
       res.send(result);
    })

    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
  } 
  // NOTE: Production API-er jonno client.close() na korai bhalo, karon API request chalu thake.
}

run().catch(console.dir);

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!.This is my first express server with typescript.so can be run');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});