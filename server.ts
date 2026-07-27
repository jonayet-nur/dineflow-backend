import { ObjectId } from 'mongodb'; //   একদম ওপরে এটি ইম্পোর্ট 
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



async function run() {
  try {

     const database = client.db("foodflow");
    const menuCollection = database.collection("all-menu");

    app.post('/api/all-menu', async(req:Request, res:Response)=>{
       const menu = req.body;
       const result = await menuCollection.insertOne(menu);
       res.send(result);
    })


// GET ALL MENU ITEMS (Search, Filter, Sort & Pagination সহ)
app.get('/api/all-menu', async (req: Request, res: Response) => {
  try {
    // ১. Query Parameters রিসিভ করা (ডিফল্ট ভ্যালু সহ)
    const {
      search,        // সার্চ কি-ওয়ার্ড (যেমন: burger, pizza)
      category,      // ক্যাটাগরি ফিল্টার
      dietaryType,   // veg, non-veg, vegan ফিল্টার
      sort = 'newest',// newest, oldest, price-low, price-high
      page = 1,      // বর্তমান পেজ নম্বর
      limit = 10,    // প্রতি পেজে কতটি আইটেম দেখাবে
    } = req.query;

    // ২. Dynamic Query Filter অবজেক্ট তৈরি (Record<string, any> টাইপ যুক্ত করা হয়েছে)
    const query: Record<string, any> = {};

    // 🔍 Search Logic (নাম এবং সংক্ষিপ্ত বর্ণনায় খুঁজবে - Case-insensitive)
    if (search && typeof search === 'string') {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { shortDesc: { $regex: search, $options: 'i' } },
      ];
    }

    // 🏷️ Category Filter Logic
    if (category && typeof category === 'string') {
      query.category = category;
    }

    // 🥗 Dietary Type Filter Logic
    if (dietaryType && typeof dietaryType === 'string') {
      query.dietaryType = dietaryType;
    }

    // ↕️ Sorting Logic (Record<string, 1 | -1> টাইপ যুক্ত করা হয়েছে)
    let sortOptions: Record<string, 1 | -1> = { _id: -1 }; // ডিফল্ট: নতুনগুলো আগে

    if (sort === 'oldest') {
      sortOptions = { _id: 1 };
    } else if (sort === 'price-low') {
      sortOptions = { price: 1 };
    } else if (sort === 'price-high') {
      sortOptions = { price: -1 };
    } else if (sort === 'newest') {
      sortOptions = { _id: -1 };
    }

    // 📄 Pagination Calculation
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    // ৩. ডাটাবেজ থেকে ডাটা এবং টোটাল কাউন্ট তুলে আনা
    const [menuItems, totalItems] = await Promise.all([
      menuCollection
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      menuCollection.countDocuments(query),
    ]);

    // ৪. Pagination Metadata হিসেব করা
    const totalPages = Math.ceil(totalItems / limitNum);

    // ৫. রেসপন্স পাঠানো
    res.status(200).json({
      success: true,
      totalItems,
      totalPages,
      currentPage: pageNum,
      limit: limitNum,
      count: menuItems.length,
      data: menuItems,
    });
  } catch (error: any) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({
      success: false,
      message: 'সার্ভার থেকে ডেটা লোড করতে সমস্যা হয়েছে!',
      error: error.message,
    });
  }
});



// 2. GET SINGLE FOOD ITEM BY ID
app.get('/api/all-menu/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 💡 ২. string id-কে new ObjectId(id) তে কনভার্ট করুন
    const foodItem = await menuCollection.findOne({ _id: new ObjectId(id as string) });

    if (!foodItem) {
      return res.status(404).json({
        success: false,
        message: 'এই আইডি-র কোনো খাবার পাওয়া যায়নি!',
      });
    }

    res.status(200).json({
      success: true,
      data: foodItem,
    });
  } catch (error: any) {
    console.error('Error fetching single food item:', error);
    res.status(500).json({
      success: false,
      message: 'ডেটা ফেচ করতে সমস্যা হয়েছে!',
      error: error.message,
    });
  }
});

app.get('/api/featured', async (req, res) => {
  try {
    // 'products' এর জায়গায় আপনার MongoDB collection-এর আসল নাম দিন
    const featuredItems = await database.collection('all-menu')
                                  .find({ isFeatured: true })
                                  .toArray();

    res.status(200).json(featuredItems);
  } catch (error) {
    res.status(500).json({ message: "Server error"});
  }
});

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