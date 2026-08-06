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
const reviewsCollection = database.collection("reviews");
// 👥 USERS COLLECTION (যোগ করা হয়েছে)
const usersCollection = database.collection("user");

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

    // 💡 string id-কে new ObjectId(id) তে কনভার্ট করুন এবং string হিসেবেও চেক করুন
    const query = (ObjectId.isValid(id as string) 
      ? { $or: [{ _id: new ObjectId(id as string) }, { _id: id as string }] }
      : { _id: id as string }) as any;

    const foodItem = await menuCollection.findOne(query);

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

    const query = (ObjectId.isValid(id as string) 
      ? { $or: [{ _id: new ObjectId(id as string) }, { _id: id as string }] }
      : { _id: id as string }) as any;

    const result = await menuCollection.updateOne(
      query,
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

    const query = (ObjectId.isValid(id as string) 
      ? { $or: [{ _id: new ObjectId(id as string) }, { _id: id as string }] }
      : { _id: id as string }) as any;

    const result = await menuCollection.deleteOne(query);

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


// Express Routes using Native MongoDB Driver

// ১. POST /api/reviews - রিভিউ সেভ করার জন্য
app.post('/api/reviews', async (req: Request, res: Response) => {
  try {
    const { foodId, userName, rating, comment } = req.body;

    if (!foodId || !userName || !rating || !comment) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const newReview = {
      foodId,
      userName,
      rating: Number(rating),
      comment,
      createdAt: new Date()
    };

    // db এর জায়গায় reviewsCollection ব্যবহার করা হয়েছে
    const result = await reviewsCollection.insertOne(newReview);

    res.status(201).json({
      success: true,
      data: { _id: result.insertedId, ...newReview },
      message: 'Review added successfully!'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ২. GET /api/reviews - রিভিউ লোড করার জন্য
app.get('/api/reviews', async (req: Request, res: Response) => {
  try {
    const { foodId } = req.query;
    const query = foodId ? { foodId: foodId as string } : {};

    const reviews = await reviewsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({ success: true, data: reviews });
    // console.log('Fetched reviews:', reviews);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// dashboard user dekanor jonno
// GET /api/admin/users
app.get('/api/admin/users', async (req, res) => {
  const search = req.query.search || '';
  const query = {
    $or: [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ],
  };
  const users = await usersCollection.find(query).toArray();
  res.send({ success: true, data: users });
});


// PATCH /api/admin/users/:id/role
app.patch('/api/admin/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const result = await usersCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: { role: role } }
  );

  if (result.modifiedCount > 0) {
    res.send({ success: true, message: 'Role updated successfully' });
  } else {
    res.status(400).send({ success: false, message: 'Failed to update role' });
  }
});


// 2. DELETE USER (DELETE: /api/admin/users/:id)
app.delete('/api/admin/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || !ObjectId.isValid(id as string)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid User ID' 
      });
    }

    const query = ObjectId.isValid(id as string)
      ? { $or: [{ _id: new ObjectId(id as string) }, { _id: id as string }] }
      : { _id: id as string };

    const result = await usersCollection.deleteOne(query as any);

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found or already deleted' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to delete user' 
    });
  }
});



// GET /api/admin/dashboard-stats
app.get('/api/admin/dashboard-stats', async (req: Request, res: Response) => {
  try {
    // Dynamically calculate or fetch counts from MongoDB collections
    const totalUsersCount = await usersCollection.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers: totalUsersCount || 1240,
          usersGrowth: 12.5,
          totalRevenue: 45200,
          revenueGrowth: 8.2,
          activeSessions: 320,
          sessionsGrowth: -2.4,
          conversionRate: 3.42,
          conversionGrowth: 1.1,
        },
        revenueChart: [
          { month: 'Jan', revenue: 4000, expenses: 2400 },
          { month: 'Feb', revenue: 5200, expenses: 2800 },
          { month: 'Mar', revenue: 6100, expenses: 3100 },
          { month: 'Apr', revenue: 7800, expenses: 3900 },
          { month: 'May', revenue: 8900, expenses: 4200 },
          { month: 'Jun', revenue: 11200, expenses: 4800 },
        ],
        userActivityChart: [
          { day: 'Mon', activeUsers: 240 },
          { day: 'Tue', activeUsers: 380 },
          { day: 'Wed', activeUsers: 450 },
          { day: 'Thu', activeUsers: 410 },
          { day: 'Fri', activeUsers: 520 },
          { day: 'Sat', activeUsers: 310 },
          { day: 'Sun', activeUsers: 280 },
        ],
        recentActivities: [
          { id: '1', user: 'Jonayet', action: 'upgraded to Admin role', time: '5 mins ago', type: 'user' },
          { id: '2', user: 'Rahim Ahmed', action: 'subscribed to Pro plan ($49)', time: '12 mins ago', type: 'payment' },
          { id: '3', user: 'System', action: 'automated DB backup completed', time: '1 hour ago', type: 'system' },
        ],
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});




// ==========================================================
// 👤 USER PROFILE API ROUTES (নতুন যুক্ত করুন)
// ==========================================================

// ১. GET User Profile by Email or ID (GET: /api/user/profile)
app.get('/api/user/profile', async (req: Request, res: Response) => {
  try {
    const { email, id } = req.query;

    if (!email && !id) {
      return res.status(400).json({
        success: false,
        message: 'Email or User ID is required',
      });
    }

    let query = {};
    if (id && typeof id === 'string') {
      query = ObjectId.isValid(id)
        ? { $or: [{ _id: new ObjectId(id) }, { _id: id }] }
        : { _id: id };
    } else if (email && typeof email === 'string') {
      query = { email: email };
    }

    const user = await usersCollection.findOne(query);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'ইউজার খুঁজে পাওয়া যায়নি!',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      message: 'প্রোফাইল লোড করতে সমস্যা হয়েছে!',
      error: error.message,
    });
  }
});

// ২. UPDATE User Profile (PUT: /api/user/profile)
app.put('/api/user/profile', async (req: Request, res: Response) => {
  try {
    const { email, name, image, phone, address } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'ইউজারের ইমেইল প্রদান করা বাধ্যতামূলক!',
      });
    }

    // আপডেটের জন্য ফিল্ড অবজেক্ট তৈরি
    const updateDoc: Record<string, any> = {};
    if (name) updateDoc.name = name;
    if (image) updateDoc.image = image;
    if (phone) updateDoc.phone = phone;
    if (address) updateDoc.address = address;
    updateDoc.updatedAt = new Date().toISOString();

    const result = await usersCollection.updateOne(
      { email: email },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'ইউজার খুঁজে পাওয়া যায়নি!',
      });
    }

    res.status(200).json({
      success: true,
      message: '🎉 প্রোফাইল তথ্য সফলভাবে আপডেট করা হয়েছে!',
    });
  } catch (error: any) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'প্রোফাইল আপডেট করতে সমস্যা হয়েছে!',
      error: error.message,
    });
  }
});

app.get('/', (req: Request, res: Response) => {
  res.send('Hello World!.This is my first express server with typescript.so can be run');
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

export default app;