const express = require("express");
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const router = express.Router();

router.get("/", verifyToken('admin'), async (req, res) => {
  try {
    const db = mongoose.connection;

    // Revenue
    const revenueResult = await db.collection("tos_orders").aggregate([
      {
        $unwind: "$products"
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $multiply: ["$products.quantity", "$products.price"]
            }
          }
        }
      }
    ]).toArray();

    // Users
    const users = await db.collection("tos_users").aggregate([
      {
        $count: "total_users"
      }
    ]).toArray();

    // Orders 
    const orders = await db.collection("tos_orders").aggregate([
      {
        $count: "total_orders"
      }
    ]).toArray();

    // Page Views
    const pageViews = await db.collection("tos_users_activity").aggregate([
      {
        $count: "total_page_views"
      }
    ]).toArray();

    const analyticsData = [
      { name: 'Revenue', value: `$${revenueResult[0].totalRevenue}`, change: 12.5, icon: "DollarSign" },
      { name: 'Users', value: users[0].total_users, change: 8.3, icon: "Users" },
      { name: 'Orders', value: orders[0].total_orders, change: -6.9, icon: "ShoppingBag" },
      { name: 'Page Views', value: pageViews[0].total_page_views, change: 19.4, icon: "Eye" }
    ]

    // Revenue and Target 
    const currentYear = new Date().getFullYear();
    const monthlyTargets = [3000, 8000, 5000, 40000, 7500, 4000, 5500, 5500, 6800, 10000, 15200, 40000];

    const revenueAndTarget = await db.collection("tos_orders").aggregate([
      {
        // Match orders for the current year
        $match: {
          order_date: {
            $gte: new Date(`${currentYear}-01-01T00:00:00Z`),
            $lt: new Date(`${currentYear + 1}-01-01T00:00:00Z`)
          },
          order_status: { $ne: "cancelled" } // Exclude cancelled orders
        }
      },
      {
        // Group by month
        $group: {
          _id: { month: { $month: "$order_date" } },
          Revenue: { $sum: "$order_total" }
        }
      },
      {
        // Sort results by month
        $sort: { "_id.month": 1 }
      },
      {
        // Add month name and monthly target
        $project: {
          _id: 0,
          month: {
            $arrayElemAt: [
              ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
              { $subtract: ["$_id.month", 1] }
            ]
          },
          Revenue: 1,
          Target: { $arrayElemAt: [monthlyTargets, { $subtract: ["$_id.month", 1] }] } // Add monthly target
        }
      }
    ]).toArray();

    // Product Performance
    const productPerformanceResult = await db.collection("tos_orders").aggregate([
      {
        $unwind: "$products"
      },
      {
        $addFields: {
          year: { $year: "$order_date" }
        }
      },
      {
        $match: {
          year: { $gte: currentYear - 4 }
        }
      },
      {
        $group: {
          _id: "$year",
          total_sales: { $sum: "$products.quantity" },
          total_revenue: {
            $sum: {
              $multiply: ["$products.quantity", "$products.price"]
            }
          },
          total_profit: {
            $sum: {
              $multiply: [
                "$products.quantity",
                {
                  $subtract: [
                    "$products.price",
                    { $ifNull: ["$products.cost_price", 0] }
                  ]
                }
              ]
            }
          }
        }
      },
      {
        $project: {
          name: "$_id",
          Sales: "$total_sales",
          Revenue: "$total_revenue",
          Profit: "$total_profit",
          _id: 0
        }
      },
      {
        $sort: { name: 1 }
      }
    ]).toArray();

    const productPerformance = Array.from({ length: 5 }, (_, i) => {
      const year = currentYear - 4 + i;
      return (
        productPerformanceResult.find(item => item.name === year) || {
          name: year,
          Sales: 0,
          Revenue: 0,
          Profit: 0
        }
      );
    });

    // Send the computed data as a response
    return res.json({
      analyticsData,
      revenueAndTarget,
      productPerformance,
    });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'An error occurred while fetching the overview data.' });
  }
});

module.exports = router;