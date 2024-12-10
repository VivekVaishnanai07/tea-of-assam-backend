const express = require("express");
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const route = express.Router();

route.get("/", verifyToken('admin'), async (req, res) => {
  try {
    const db = mongoose.connection;

    // Total Sales
    const totalSalesResult = await db.collection('tos_orders').aggregate([
      { $match: { order_status: "Completed" } }, // Adjust status as needed
      { $group: { _id: 0, totalSales: { $sum: "$order_total" } } }
    ]).toArray();
    const totalSales = totalSalesResult.length > 0 ? totalSalesResult[0].totalSales : 0;

    // New Users (users who registered in the past 30 days)
    const now = new Date(); // Current date
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1); // Start of last month
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 1); // Start of current month

    const newUsers = await db.collection('tos_users').countDocuments({
      createdAt: {
        $gte: startOfLastMonth.toISOString(),
        $lt: endOfLastMonth.toISOString()
      }
    });

    // Total Products
    const totalProductsResult = await db.collection('tos_products').aggregate([
      { $count: "totalProducts" }
    ]).toArray();
    const totalProducts = totalProductsResult.length > 0 ? totalProductsResult[0].totalProducts : 0;

    // Conversion Rate
    const totalUsers = await db.collection('tos_users').countDocuments();  // Total users
    const usersWithOrders = (await db.collection('tos_orders').distinct("client_id")).length;
    const conversionRate = totalUsers > 0 ? (usersWithOrders / totalUsers) * 100 : 0;

    // Sales Overview
    const salesOverview = await db.collection("tos_orders").aggregate([
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
    const categoryDistribution = await db.collection("tos_orders").aggregate([
      {
        $unwind: "$products"
      },
      {
        $group: {
          _id: "$products.category",
          value: {
            $sum: {
              $multiply: [
                "$products.quantity",
                { $toDouble: "$products.price" } // Convert price to a number before multiplication
              ]
            }
          }
        }
      },
      {
        $project: {
          name: "$_id",
          value: 1,
          _id: 0
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

module.exports = route;