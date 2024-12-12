const express = require("express");
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const router = express.Router();

router.post("/", verifyToken('admin'), async (req, res) => {
  const { timeRange } = req.body;
  try {
    const db = mongoose.connection;

    // Total Sales
    const totalRevenueResult = await db.collection("tos_orders").aggregate([
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$amount" }
        }
      }
    ]).toArray();

    const totalSales = totalRevenueResult[0]?.totalSales || 0;

    // Average Order Value
    const averageOrderValueResult = await db.collection("tos_orders").aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalOrders: { $count: {} }
        }
      },
      {
        $project: {
          AOV: { $divide: ["$totalRevenue", "$totalOrders"] }
        }
      }
    ]).toArray();

    const averageOrderValue = averageOrderValueResult[0]?.AOV || 0;

    // Conversion Rate
    const conversionRateResult = await db.collection("tos_orders").aggregate([
      {
        $group: {
          _id: "$client_id",  // Grouping by customer ID
          totalOrders: { $count: {} }
        }
      },
      {
        $count: "totalCustomers"  // Count the number of customers
      }
    ]).toArray();

    const totalCustomers = conversionRateResult[0]?.totalCustomers || 0;
    const totalOrder = await db.collection("tos_orders").countDocuments({});
    const conversionRate = (totalOrder / totalCustomers) * 100;

    // Sales Growth (Sales for Current Month)
    function getFirstAndLastDateOfMonth(year, month) {
      const firstDate = new Date(year, month, 1); // First date of the month
      const lastDate = new Date(year, month + 1, 0); // Last date of the month

      // Adjusting the time for IST (UTC +5:30)
      firstDate.setHours(firstDate.getHours() + 5);
      firstDate.setMinutes(firstDate.getMinutes() + 30);

      lastDate.setHours(lastDate.getHours() + 5);
      lastDate.setMinutes(lastDate.getMinutes() + 30);

      return {
        firstDate: firstDate.toISOString(), // Convert to ISO string format
        lastDate: lastDate.toISOString() // Convert to ISO string format
      };
    }

    // Get first and last date of the current month
    const currentMonthDates = getFirstAndLastDateOfMonth(new Date().getFullYear(), new Date().getMonth());
    const lastMonthDates = getFirstAndLastDateOfMonth(new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear(), new Date().getMonth() === 0 ? 11 : new Date().getMonth() - 1);

    const currentMonthRevenue = await db.collection("tos_orders").aggregate([
      {
        $match: {
          order_date: { $gte: new Date(currentMonthDates.firstDate), $lt: new Date(currentMonthDates.lastDate) }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]).toArray();

    const previousMonthRevenue = await db.collection("tos_orders").aggregate([
      {
        $match: {
          order_date: { $gte: new Date(lastMonthDates.firstDate), $lt: new Date(lastMonthDates.lastDate) }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]).toArray();

    // Calculate sales growth manually
    const salesGrowth = ((currentMonthRevenue[0]?.totalRevenue - previousMonthRevenue[0]?.totalRevenue) / previousMonthRevenue[0]?.totalRevenue) * 100;

    // Sales Overview
    const period = timeRange;

    const aggregationPipeline = [
      {
        $match: {
          "order_date": {
            $gte: new Date("2024-01-01T00:00:00Z"),
            $lt: new Date("2024-12-31T23:59:59Z")
          },
          "order_status": "Completed"
        }
      },
      {
        $project: {
          timePeriod: {
            $switch: {
              branches: [
                {
                  case: { $eq: [period, "month"] },
                  then: { $month: "$order_date" } // Group by month if period is "month"
                },
                {
                  case: { $eq: [period, "week"] },
                  then: { $isoWeek: "$order_date" } // Group by week if period is "week"
                },
                {
                  case: { $eq: [period, "quarter"] },
                  then: {
                    $switch: {
                      branches: [
                        { case: { $lt: [{ $month: "$order_date" }, 4] }, then: 1 }, // Q1
                        { case: { $lt: [{ $month: "$order_date" }, 7] }, then: 2 }, // Q2
                        { case: { $lt: [{ $month: "$order_date" }, 10] }, then: 3 }, // Q3
                        { case: { $gte: [{ $month: "$order_date" }, 10] }, then: 4 } // Q4
                      ],
                      default: 0
                    }
                  }
                }, // Group by quarter if period is "quarter"
                {
                  case: { $eq: [period, "year"] },
                  then: { $year: "$order_date" } // Group by year if period is "year"
                }
              ],
              default: null
            }
          },
          total_sales: "$order_total"
        }
      },
      {
        $group: {
          _id: { timePeriod: "$timePeriod" },
          total_sales: { $sum: "$total_sales" }
        }
      },
      {
        $sort: { "_id.timePeriod": 1 }
      },
      {
        $project: {
          _id: 0,
          period: {
            $switch: {
              branches: [
                {
                  case: { $eq: [period, "month"] },
                  then: {
                    $arrayElemAt: [
                      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                      { $subtract: ["$_id.timePeriod", 1] } // Convert numeric month to name
                    ]
                  }
                },
                {
                  case: { $eq: [period, "quarter"] },
                  then: {
                    $concat: ["Q", { $toString: "$_id.timePeriod" }] // Format quarters as Q1, Q2, etc.
                  }
                },
                {
                  case: { $eq: [period, "week"] },
                  then: { $concat: ["Week ", { $toString: "$_id.timePeriod" }] } // Format weeks as "Week X"
                },
                {
                  case: { $eq: [period, "year"] },
                  then: { $toString: "$_id.timePeriod" } // Format years as year number
                }
              ],
              default: null
            }
          },
          sales: "$total_sales"
        }
      }
    ];

    // Run the aggregation query
    const salesOverview = await db.collection("tos_orders").aggregate(aggregationPipeline).toArray();

    // Send the computed data as a response
    return res.json({
      totalSales,
      averageOrderValue,
      conversionRate,
      salesGrowth,
      salesOverview
    });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'An error occurred while fetching the overview data.' });
  }
});

// router.get("/getProducts", verifyToken('admin'), (req, res) => {
//   const db = mongoose.connection;

//   db.collection("tos_products").aggregate([
//     {
//       $lookup: {
//         from: "tos_stock_and_sales",
//         localField: "_id",
//         foreignField: "product_id",
//         as: "productDetails"
//       }
//     },
//     {
//       $unwind: {
//         path: "$productDetails",
//         preserveNullAndEmptyArrays: true
//       }
//     },
//     {
//       $project: {
//         _id: "$productDetails.product_id",
//         name: "$name",
//         price: "$price",
//         category: "$category",
//         stock: "$productDetails.stock",
//         sales: "$productDetails.sales"
//       }
//     }
//   ]).toArray().then((response) => {
//     return res.send(response);
//   }).catch((error) => {
//     console.error(error);
//   })
// });

// router.post("/addNew", verifyToken('admin'), (req, res) => {
//   const ProductData = req.body;
//   const db = mongoose.connection;

//   db.collection("tos_products").insertOne(
//     {
//       name: ProductData.name,
//       brandName: ProductData.brandName,
//       price: ProductData.price,
//       category: ProductData.category,
//       size: ProductData.size,
//       image: ProductData.image,
//       featured: false,
//       desc: ProductData.desc
//     }
//   ).then((response) => {
//     if (response.insertedId) {
//       db.collection("tos_stock_and_sales").insertOne(
//         {
//           product_id: response.insertedId,
//           stock: ProductData.stock,
//           sales: 0,
//           last_update_date: new Date()
//         }
//       );
//     }
//     return res.send(response);
//   }).catch((error) => {
//     console.error(error);
//   })
// });

module.exports = router;