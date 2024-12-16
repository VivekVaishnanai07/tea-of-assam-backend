const express = require("express");
const mongoose = require('mongoose');
const verifyToken = require("../../middlewares/verifyToken");

const router = express.Router();

router.get("/", verifyToken('admin'), async (req, res) => {
  try {
    const db = mongoose.connection;

    // Total Revenue
    const totalRevenueResult = await db.collection("toa_orders").aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" }
        }
      }
    ]).toArray();

    const totalRevenue = totalRevenueResult[0]?.totalRevenue || 0; // Directly get the number

    // Total Products
    const totalProductsResult = await db.collection("toa_products").aggregate([
      { $count: "totalProducts" }
    ]).toArray();

    const totalProducts = totalProductsResult[0]?.totalProducts || 0;

    // Top Selling Products
    const topSelling = await db.collection("toa_stock_and_sales").countDocuments({ sales: { $gt: 4 } });

    // Low Stock Products
    const lowStock = await db.collection("toa_stock_and_sales").countDocuments({ stock: { $lt: 30 } });

    // Send the computed data as a response
    return res.json({
      totalProducts,
      topSelling,
      lowStock,
      totalRevenue
    });
  } catch (err) {
    console.error('Error occurred:', err);
    return res.status(500).json({ error: 'An error occurred while fetching the overview data.' });
  }
});

router.get("/getProducts", verifyToken('admin'), (req, res) => {
  const db = mongoose.connection;

  db.collection("toa_products").aggregate([
    {
      $lookup: {
        from: "toa_stock_and_sales",
        localField: "_id",
        foreignField: "product_id",
        as: "productDetails"
      }
    },
    {
      $unwind: {
        path: "$productDetails",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: "$productDetails.product_id",
        name: "$name",
        price: "$price",
        category: "$category",
        stock: "$productDetails.stock",
        sales: "$productDetails.sales"
      }
    }
  ]).toArray().then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

router.post("/addNew", verifyToken('admin'), (req, res) => {
  const ProductData = req.body;
  const db = mongoose.connection;

  db.collection("toa_products").insertOne(
    {
      name: ProductData.name,
      brandName: ProductData.brandName,
      price: ProductData.price,
      category: ProductData.category,
      size: ProductData.size,
      image: ProductData.image,
      featured: false,
      desc: ProductData.desc
    }
  ).then((response) => {
    if (response.insertedId) {
      db.collection("toa_stock_and_sales").insertOne(
        {
          product_id: response.insertedId,
          stock: ProductData.stock,
          sales: 0,
          last_update_date: new Date()
        }
      );
    }
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

module.exports = router;