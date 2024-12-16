const express = require("express");
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const router = express.Router();

router.get("/", verifyToken('admin'), async (req, res) => {
  try {
    const db = mongoose.connection;

    // Total Users
    const totalUsersResult = await db.collection("toa_users").aggregate([{ $count: "totalUsers" }]).toArray();
    const totalUsers = totalUsersResult[0]?.totalUsers || 0;

    // New Users Today
    const newUsersTodayResult = await db.collection("toa_users").aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        }
      },
      { $count: "newUsersToday" }
    ]).toArray();
    const newUsersToday = newUsersTodayResult[0]?.newUsersToday || 0;

    // Active Users
    const activeUsers = await db.collection("toa_users_activity").countDocuments({
      lastActivity: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
    });

    // Churn Rate
    const churnRate = await db.collection("toa_users_activity").countDocuments({
      $and: [
        { lastLogin: { $lt: new Date(new Date().setDate(new Date().getDate() - 30)) } },
        { lastPurchase: { $lt: new Date(new Date().setDate(new Date().getDate() - 30)) } }
      ]
    });

    // User Growth
    const userGrowth = await db.collection("toa_users").aggregate([
      { $project: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } } },
      { $match: { year: 2024 } },
      { $group: { _id: { year: "$year", month: "$month" }, newUsers: { $sum: 1 } } },
      { $sort: { "_id.month": 1 } },
      { $project: { _id: 0, name: { $concat: [{ $toString: "$_id.month" }, "-2024"] }, value: "$newUsers" } }
    ]).toArray();

    // User Activity Heatmap
    const userActivityHeatMap = await db.collection("toa_users_activity").aggregate([
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$lastActivity" },
          hourOfDay: { $hour: "$lastActivity" }
        }
      },
      {
        $group: {
          _id: {
            dayOfWeek: "$dayOfWeek",
            hourRange: {
              $switch: {
                branches: [
                  { case: { $lt: ["$hourOfDay", 4] }, then: "0-4" },
                  { case: { $lt: ["$hourOfDay", 8] }, then: "4-8" },
                  { case: { $lt: ["$hourOfDay", 12] }, then: "8-12" },
                  { case: { $lt: ["$hourOfDay", 16] }, then: "12-16" },
                  { case: { $lt: ["$hourOfDay", 20] }, then: "16-20" },
                  { case: { $gte: ["$hourOfDay", 20] }, then: "20-24" }
                ],
                default: "Unknown"
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $project: { dayOfWeek: "$_id.dayOfWeek", hourRange: "$_id.hourRange", count: 1, _id: 0 } },
      { $sort: { dayOfWeek: 1, hourRange: 1 } }
    ]).toArray();

    // User Demographics
    const userDemographics = await db.collection("toa_users").aggregate([
      {
        $addFields: {
          age: { $floor: { $divide: [{ $subtract: [new Date(), "$dateOfBirth"] }, 31557600000] } }
        }
      },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [18, 25, 35, 45, 55, 100],
          default: "55+",
          output: { count: { $sum: 1 } }
        }
      },
      { $project: { name: "$_id", value: "$count", _id: 0 } }
    ]).toArray();

    return res.json({
      totalUsers,
      newUsersToday,
      activeUsers,
      churnRate,
      userGrowth,
      userActivityHeatMap,
      userDemographics
    });
  } catch (err) {
    console.error("Error occurred:", err);
    return res.status(500).json({ error: "An error occurred while fetching the overview data." });
  }
});

router.get("/getUsers", verifyToken('admin'), (req, res) => {
  const db = mongoose.connection;
  // db.collection("toa_users").aggregate([
  //   {
  //     $lookup: {
  //       from: "toa_stock_and_sales",
  //       localField: "_id",
  //       foreignField: "product_id",
  //       as: "productDetails"
  //     }
  //   },
  //   {
  //     $unwind: {
  //       path: "$productDetails",
  //       preserveNullAndEmptyArrays: true
  //     }
  //   },
  //   {
  //     $project: {
  //       _id: "$productDetails.product_id",
  //       name: "$name",
  //       price: "$price",
  //       category: "$category",
  //       stock: "$productDetails.stock",
  //       sales: "$productDetails.sales"
  //     }
  //   }
  // ]).toArray()

  db.collection("toa_users").find().toArray().then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

router.post("/addNew", verifyToken('admin'), (req, res) => {
  const userData = req.body;
  const db = mongoose.connection;

  db.collection("toa_users").insertOne(
    {
      email: userData.email,
      mobileNumber: userData.mobileNumber,
      address: {
        street: userData.address.street,
        landmark: userData.address.landmark,
        city: userData.address.city,
        state: userData.address.state,
        pinCode: userData.address.pinCode,
        locality: userData.address.locality,
        type: userData.address.type
      },
      password: "password123",
      role: "client",
      firstName: userData.firstName,
      lastName: userData.lastName,
      gender: userData.gender,
      deliveryAddresses: [
        {
          name: userData.firstName + " " + userData.lastName,
          number: userData.mobileNumber,
          street: userData.address.street,
          landmark: userData.address.landmark,
          city: userData.address.city,
          state: userData.address.state,
          pinCode: userData.address.pinCode,
          locality: userData.address.locality,
          type: userData.address.type
        },
      ],
      createdAt: new Date()
    }
  ).then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

module.exports = router;