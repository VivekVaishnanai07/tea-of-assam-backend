const express = require("express");
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const router = express.Router();

router.get("/", verifyToken('admin'), async (req, res) => {
  try {
    const db = mongoose.connection;

    // Total Pending Orders
    const totalOrders = await db.collection("toa_orders").countDocuments({});

    // Total Pending Orders
    const totalPendingOrders = await db.collection("toa_orders").countDocuments({ order_status: { $in: ["Pending", "Processing"] } });

    // Total Completed Orders
    const totalCompletedOrders = await db.collection("toa_orders").countDocuments({ order_status: "Delivered" });

    // Total Orders Revenue
    const totalOrdersRevenueResult = await db.collection("toa_orders").aggregate([
      {
        $match: { order_status: "Delivered" }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]).toArray();

    const totalRevenue = totalOrdersRevenueResult[0]?.totalRevenue || 0;

    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Start of the week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date();
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of the week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);

    // Generate all days of the current week
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      const formattedDay = day.toISOString().slice(5, 10).replace("-", "/"); // Format as MM/DD
      weekDates.push({ value: formattedDay, name: 0 }); // Default with count 0
    }

    // MongoDB Query
    const dailyOrdersResult = await db.collection("toa_orders").aggregate([
      {
        $match: {
          order_date: {
            $gte: startOfWeek,
            $lte: endOfWeek
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%m/%d", date: "$order_date" } }, // Format as MM/DD
          count: { $sum: 1 } // Count orders
        }
      },
      {
        $project: {
          _id: 0,
          value: "$_id", // Day as MM/DD
          name: "$count" // Orders count
        }
      }
    ]).toArray();

    const dailyOrders = weekDates.map(day => {
      const order = dailyOrdersResult.find(o => o.value === day.value);
      return order || day; // Use the order data if available, else default day
    });

    // Category Distribution
    const categoryDistribution = await db.collection("toa_orders").aggregate([
      {
        $group: {
          _id: "$order_status",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          name: "$_id",
          value: "$count",
          _id: 0
        },
      },
      {
        $sort: {
          name: 1
        }
      }
    ]).toArray();

    // Orders List
    const ordersList = await db.collection("toa_orders").aggregate([
      {
        $project: {
          _id: 0,
          id: "$_id",
          customer: "$shipping_address.name",
          total: "$amount",
          status: "$order_status",
          date: "$order_date"
        }
      }
    ]).toArray();

    // Send the computed data as a response
    return res.json({
      totalOrders,
      totalPendingOrders,
      totalCompletedOrders,
      totalRevenue,
      dailyOrders,
      categoryDistribution,
      ordersList
    });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'An error occurred while fetching the overview data.' });
  }
});

module.exports = router;