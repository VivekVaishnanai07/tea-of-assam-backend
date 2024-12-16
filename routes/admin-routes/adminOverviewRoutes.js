const express = require("express");
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const router = express.Router();

router.get("/", verifyToken('admin'), async (req, res) => {
  try {
    const db = mongoose.connection;

    // Total Sales
    const totalSalesResult = await db.collection('toa_orders').aggregate([
      { $match: { payment_method: "UPI" } || { payment_method: "CARD" } }, // Adjust status as needed
      { $group: { _id: 0, totalSales: { $sum: "$order_total" } } }
    ]).toArray();
    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

    // New Users (users who registered in the past 30 days)
    const newUsersResult = await db.collection("toa_users").aggregate([
      {
        "$match": {
          "createdAt": {
            "$gte": new Date(new Date() - 30 * 24 * 60 * 60 * 1000)  // 7 days ago
          }
        }
      },
      {
        "$count": "new_users_count"
      }
    ]).toArray();
    const newUsers = newUsersResult.length > 0 ? newUsersResult[0].new_users_count : 0;

    // Total Products
    const totalProductsResult = await db.collection('toa_products').aggregate([
      { $count: "totalProducts" }
    ]).toArray();
    const totalProducts = totalProductsResult.length > 0 ? totalProductsResult[0].totalProducts : 0;

    // Conversion Rate
    const totalUsers = await db.collection('toa_users').countDocuments();  // Total users
    const usersWithOrders = (await db.collection('toa_orders').distinct("client_id")).length;
    const conversionRate = totalUsers > 0 ? (usersWithOrders / totalUsers) * 100 : 0;

    // Sales Overview
    const salesOverview = await db.collection("toa_orders").aggregate([
      {
        $addFields: {
          order_date: { $toDate: "$order_date" }
        }
      },
      {
        $match: {
          order_date: {
            $gte: new Date("2023-07-01T05:38:50.725Z"),
            $lt: new Date()
          }
        }
      },
      {
        $project: {
          year: { $year: "$order_date" },
          month: { $month: "$order_date" },
          amount: 1
        }
      },
      {
        $group: {
          _id: { year: "$year", month: "$month" },
          total_sales: { $sum: "$amount" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      },
      {
        $project: {
          _id: 0,
          name: {
            $switch: {
              branches: [
                { case: { $eq: ["$_id.month", 1] }, then: "Jan" },
                { case: { $eq: ["$_id.month", 2] }, then: "Feb" },
                { case: { $eq: ["$_id.month", 3] }, then: "Mar" },
                { case: { $eq: ["$_id.month", 4] }, then: "Apr" },
                { case: { $eq: ["$_id.month", 5] }, then: "May" },
                { case: { $eq: ["$_id.month", 6] }, then: "Jun" },
                { case: { $eq: ["$_id.month", 7] }, then: "Jul" },
                { case: { $eq: ["$_id.month", 8] }, then: "Aug" },
                { case: { $eq: ["$_id.month", 9] }, then: "Sep" },
                { case: { $eq: ["$_id.month", 10] }, then: "Oct" },
                { case: { $eq: ["$_id.month", 11] }, then: "Nov" },
                { case: { $eq: ["$_id.month", 12] }, then: "Dec" }
              ],
              default: "Unknown"
            }
          },
          value: "$total_sales"
        }
      }
    ]).toArray();

    // Category Distribution
    const categoryDistribution = await db.collection("toa_products").aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          category: "$_id",
          count: 1,
          _id: 0
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$count" },
          categories: { $push: { category: "$category", count: "$count" } }
        }
      },
      {
        $unwind: "$categories"
      },
      {
        $project: {
          _id: 0,
          name: "$categories.category",
          value: "$categories.count",
          percentage: { $multiply: [{ $divide: ["$categories.count", "$total"] }, 100] }
        }
      }
    ]).toArray();

    // Send the computed data as a response
    return res.json({
      totalSales,
      newUsers,
      totalProducts,
      salesOverview,
      categoryDistribution,
      conversionRate: conversionRate.toFixed(2)  // Round to 2 decimal places
    });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'An error occurred while fetching the overview data.' });
  }
});

module.exports = router;