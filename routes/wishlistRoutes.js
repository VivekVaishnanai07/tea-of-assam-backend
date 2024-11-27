const express = require("express");
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const verifyRoleOrToken = require("../middlewares/verifyRoleOrToken");

const route = express.Router();

route.get("/:client_id", verifyRoleOrToken(), (req, res) => {
  const client_id = req.params.client_id;
  const db = mongoose.connection;

  db.collection("tos_wishlist").aggregate([
    {
      $match: { client_id: new ObjectId(client_id) }
    },
    {
      $lookup: {
        from: "tos_products",
        localField: "product_id",
        foreignField: "_id",
        as: "wishlists"
      }
    },
    {
      $lookup: {
        from: "tos_gift_products",
        localField: "product_id",
        foreignField: "_id",
        as: "giftProductsList"
      }
    },
    {
      $unwind: {
        path: "$wishlists",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $unwind: {
        path: "$giftProductsList",
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        product_id: { $ifNull: ["$wishlists._id", "$giftProductsList._id"] },
        brandName: { $ifNull: ["$wishlists.brandName", "$giftProductsList.brandName"] },
        name: { $ifNull: ["$wishlists.name", "$giftProductsList.name"] },
        image: { $ifNull: ["$wishlists.image", "$giftProductsList.image"] },
        price: { $ifNull: ["$wishlists.price", "$giftProductsList.price"] },
        category: { $ifNull: ["$wishlists.category", "$giftProductsList.category"] },
        size: { $ifNull: ["$wishlists.size", "$giftProductsList.size"] },
        featured: { $ifNull: ["$wishlists.featured", "$giftProductsList.featured"] },
        slug: { $ifNull: ["$wishlists.slug", "$giftProductsList.slug"] },
        desc: { $ifNull: ["$wishlists.desc", "$giftProductsList.desc"] }
      }
    }
  ]).toArray().then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

route.post("/add-wishlist", verifyRoleOrToken(), (req, res) => {
  const { product_id, client_id } = req.body;
  const db = mongoose.connection;

  db.collection("tos_wishlist")
    .countDocuments({ product_id: new ObjectId(product_id), client_id: new ObjectId(client_id) })
    .then((count) => {
      if (count > 0) {
        // Product already in wishlist
        return res.status(400).json({ message: 'This product is already in your wishlist' });
      } else {
        // Add the product to wishlist
        db.collection("tos_wishlist")
          .insertOne({
            product_id: new ObjectId(product_id),
            client_id: new ObjectId(client_id),
          })
          .then((result) => {
            res.status(201).json({ message: 'Product added to wishlist', result });
          })
          .catch((error) => {
            console.error(error);
            res.status(500).json({ message: 'Error adding product to wishlist', error });
          });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'Error checking wishlist', error });
    });
});

route.delete("/:client_id/:product_id", verifyRoleOrToken(), (req, res) => {
  const { product_id, client_id } = req.params;
  const db = mongoose.connection;

  db.collection("tos_wishlist").deleteOne({
    product_id: new ObjectId(product_id),
    client_id: new ObjectId(client_id)
  })
    .then((result) => {
      if (result.deletedCount > 0) {
        res.status(200).json({ message: 'Product removed from wishlist' });
      } else {
        res.status(404).json({ message: 'Product not found in wishlist' });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'Error removing product from wishlist', error });
    });
});


module.exports = route;