const express = require("express");
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const router = express.Router();

// router.get("/", verifyToken('admin'), async (req, res) => {
//   try {
//     const db = mongoose.connection;

//     // Total Revenue
//     const totalRevenueResult = await db.collection("tos_orders").aggregate([
//       {
//         $group: {
//           _id: null,
//           totalRevenue: { $sum: "$amount" }
//         }
//       }
//     ]).toArray();

//     const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0; // Directly get the number

//     // Total Products
//     const totalProductsResult = await db.collection("tos_products").aggregate([
//       { $count: "totalProducts" }
//     ]).toArray();

//     const totalProducts = totalProductsResult[0]?.totalProducts || 0;

//     // Top Selling Products
//     const topSelling = await db.collection("tos_stock_and_sales").countDocuments({ sales: { $gt: 4 } });

//     // Low Stock Products
//     const lowStock = await db.collection("tos_stock_and_sales").countDocuments({ stock: { $lt: 30 } });

//     // Send the computed data as a response
//     return res.json({
//       totalProducts,
//       topSelling,
//       lowStock,
//       totalRevenue
//     });
//   } catch (err) {
//     console.error('Error occurred:', err);
//     return res.status(500).json({ error: 'An error occurred while fetching the overview data.' });
//   }
// });

router.get("/getUsers", verifyToken('admin'), (req, res) => {
  const db = mongoose.connection;
  // db.collection("tos_users").aggregate([
  //   {
  //     $lookup: {
  //       from: "tos_stock_and_sales",
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

  db.collection("tos_users").find().toArray().then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

router.post("/addNew", verifyToken('admin'), (req, res) => {
  const userData = req.body;
  const db = mongoose.connection;

  db.collection("tos_users").insertOne(
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