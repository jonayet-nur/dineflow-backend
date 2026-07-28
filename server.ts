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


const database = client.db("foodflow");
const menuCollection = database.collection("all-menu");
const ordersCollection = database.collection("orders");

// Connect to MongoDB asynchronously, but don't block route registration
client.connect().then(() => {
  console.log("Pinged your deployment. You successfully connected to MongoDB!");
}).catch(console.dir);

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


// ==========================================================
// 📦 ORDER API ROUTES (নতুন যুক্ত করা হয়েছে)
// ==========================================================

// ১. নতুন অর্ডার তৈরি করা (POST: /api/orders)
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const orderData = req.body;

    // সার্ভারে অর্ডার সৃষ্টির সময় একটি টাইমস্ট্যাম্প যুক্ত করা
    const newOrder = {
      ...orderData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await ordersCollection.insertOne(newOrder);

    res.status(201).json({
      success: true,
      message: '🎉 আপনার অর্ডারটি সফলভাবে ডাটাবেসে সংরক্ষণ করা হয়েছে!',
      insertedId: result.insertedId,
    });
  } catch (error: any) {
    console.error('Order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'অর্ডার সেভ করতে সমস্যা হয়েছে!',
      error: error.message,
    });
  }
});

// ২. সব অর্ডার দেখার জন্য (GET: /api/orders - Admin-এর জন্য কাজে লাগবে)
// app.get('/api/orders', async (req: Request, res: Response) => {
//   try {
//     const orders = await ordersCollection
//       .find()
//       .sort({ createdAt: -1 }) // নতুন অর্ডারগুলো আগে দেখাবে
//       .toArray();

//     res.status(200).json({
//       success: true,
//       count: orders.length,
//       data: orders,
//     });
//   } catch (error: any) {
//     console.error('Error fetching orders:', error);
//     res.status(500).json({
//       success: false,
//       message: 'অর্ডারগুলো ফেচ করতে সমস্যা হয়েছে!',
//       error: error.message,
//     });
//   }
// });

// 📦 সব অর্ডার ফেচ করার জন্য GET মেথড (index.ts / server.ts)
app.get('/api/orders', async (req: Request, res: Response) => {
  try {
    const orders = await ordersCollection
      .find()
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({
      success: false,
      message: 'অর্ডারগুলো লোড করতে সমস্যা হয়েছে!',
      error: error.message,
    });
  }
});

// ৩. Update Order Status (Fixed db issue & ObjectId cast)
app.patch('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string; // 👈 string টাইপে কাস্ট করা হয়েছে
    const { status } = req.body;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'অবৈধ অর্ডার ID!' });
    }

    const result = await ordersCollection.updateOne( // 👈 db.collection এর বদলে ordersCollection
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date().toISOString() } }
    );

    res.status(200).json({ success: true, message: 'Status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});


// ৪. Delete Order API (Fixed db issue & Overload Error)
app.delete('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string; // 👈 string টাইপ নিশ্চিত করা হয়েছে

    // 1. Check if ID is valid MongoDB ObjectId
    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false, 
        message: 'অবৈধ বা ভুল অর্ডার ID!' 
      });
    }

    // 2. Delete from MongoDB using ordersCollection
    const result = await ordersCollection.deleteOne({ // 👈 db.collection-এর জায়গায় ordersCollection
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'অর্ডারটি খুঁজে পাওয়া যায়নি!' 
      });
    }

    // 3. Return Success Response
    return res.status(200).json({ 
      success: true, 
      message: 'অর্ডারটি সফলভাবে মুছে ফেলা হয়েছে!' 
    });

  } catch (error: any) {
    console.error('Delete Error in Express:', error);
    return res.status(500).json({ 
      success: false, 
      message: error?.message || 'সার্ভারে অভ্যন্তরীণ ত্রুটি হয়েছে!' 
    });
  }
});



//dashboard er all foods e delete and update er jonno api route create kora holo

// ✏️ UPDATE MENU ITEM (PUT: /api/all-menu/:id)
app.put('/api/all-menu/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const updatedData = req.body;

    // _id ফিল্ড রিমুভ করে দেওয়া হচ্ছে যাতে MongoDB error না দেয়
    delete updatedData._id;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'অবৈধ খাবার ID!' });
    }

    const result = await menuCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ success: false, message: 'খাবারটি খুঁজে পাওয়া যায়নি!' });
    }

    res.status(200).json({
      success: true,
      message: 'খাবার তথ্য সফলভাবে আপডেট করা হয়েছে!',
    });
  } catch (error: any) {
    console.error('Update Menu Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 🗑️ DELETE MENU ITEM (DELETE: /api/all-menu/:id)
app.delete('/api/all-menu/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'অবৈধ খাবার ID!' });
    }

    const result = await menuCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'খাবারটি খুঁজে পাওয়া যায়নি!' });
    }

    res.status(200).json({
      success: true,
      message: 'খাবারটি সফলভাবে মুছে ফেলা হয়েছে!',
    });
  } catch (error: any) {
    console.error('Delete Menu Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!.This is my first express server with typescript.so can be run');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;