const express = require("express");
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const verifyToken = require("../middlewares/verifyToken");

const route = express.Router();

route.get("/:client_id", verifyToken(), (req, res) => {
  const client_id = req.params.client_id;
  const db = mongoose.connection;

  db.collection("toa_cart").aggregate([
    {
      $match: { client_id: new ObjectId(client_id) }
    },
    {
      $lookup: {
        from: "toa_products",
        localField: "product_id",
        foreignField: "_id",
        as: "cartProductsList"
      }
    },
    {
      $lookup: {
        from: "toa_gift_products",
        localField: "product_id",
        foreignField: "_id",
        as: "giftProductsList"
      }
    },
    {
      $unwind: {
        path: "$cartProductsList",
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
        quantity: 1,
        product_id: { $ifNull: ["$cartProductsList._id", "$giftProductsList._id"] },
        brandName: { $ifNull: ["$cartProductsList.brandName", "$giftProductsList.brandName"] },
        name: { $ifNull: ["$cartProductsList.name", "$giftProductsList.name"] },
        image: { $ifNull: ["$cartProductsList.image", "$giftProductsList.image"] },
        price: { $ifNull: ["$cartProductsList.price", "$giftProductsList.price"] },
        category: { $ifNull: ["$cartProductsList.category", "$giftProductsList.category"] },
        size: { $ifNull: ["$cartProductsList.size", "$giftProductsList.size"] },
        featured: { $ifNull: ["$cartProductsList.featured", "$giftProductsList.featured"] },
        slug: { $ifNull: ["$cartProductsList.slug", "$giftProductsList.slug"] },
        desc: { $ifNull: ["$cartProductsList.desc", "$giftProductsList.desc"] }
      }
    }
  ]).toArray().then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

route.post("/add-cart", verifyToken(), (req, res) => {
  const { product_id, client_id, quantity } = req.body;
  const db = mongoose.connection;

  db.collection("toa_cart")
    .countDocuments({ product_id: new ObjectId(product_id), client_id: new ObjectId(client_id) })
    .then((count) => {
      if (count > 0) {
        // Product already then increase count of quantity
        db.collection("toa_cart")
          .updateOne(
            { product_id: new ObjectId(product_id), client_id: new ObjectId(client_id) },
            { $inc: { quantity: quantity } } // Increase the quantity by the given amount
          )
          .then((result) => {
            res.status(200).json({ message: 'Product quantity updated in cart', result });
          })
          .catch((error) => {
            console.error(error);
            res.status(500).json({ message: 'Error updating quantity in cart', error });
          });
      } else {
        // Add the product to cart
        db.collection("toa_cart")
          .insertOne({
            product_id: new ObjectId(product_id),
            client_id: new ObjectId(client_id),
            quantity: quantity,
          })
          .then((result) => {
            res.status(201).json({ message: 'Product added to cart', result });
          })
          .catch((error) => {
            console.error(error);
            res.status(500).json({ message: 'Error adding product to cart', error });
          });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'Error checking cart', error });
    });
});

route.delete("/:client_id/:product_id", verifyToken(), (req, res) => {
  const { product_id, client_id } = req.params;
  const db = mongoose.connection;

  db.collection("toa_cart").deleteOne({
    product_id: new ObjectId(product_id),
    client_id: new ObjectId(client_id)
  })
    .then((result) => {
      if (result.deletedCount > 0) {
        res.status(200).json({ message: 'Product removed from cart' });
      } else {
        res.status(404).json({ message: 'Product not found in cart' });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'Error removing product from cart', error });
    });
});

route.patch("/increase-quantity/:client_id/:product_id", verifyToken(), (req, res) => {
  const { client_id, product_id } = req.params;
  const db = mongoose.connection;

  db.collection("toa_cart").updateOne(
    { client_id: new ObjectId(client_id), product_id: new ObjectId(product_id) },
    { $inc: { quantity: 1 } } // Increment the quantity by 1
  )
    .then((result) => {
      if (result.matchedCount > 0) {
        res.status(200).json({ message: 'Product quantity increased in cart' });
      } else {
        res.status(404).json({ message: 'Product not found in cart' });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'Error increasing product quantity in cart', error });
    });
});

route.patch("/decrease-quantity/:client_id/:product_id", verifyToken(), (req, res) => {
  const { client_id, product_id } = req.params;
  const db = mongoose.connection;

  db.collection("toa_cart").findOneAndUpdate(
    {
      client_id: new ObjectId(client_id),
      product_id: new ObjectId(product_id),
      quantity: { $gt: 1 }
    },
    { $inc: { quantity: -1 } },
    { returnDocument: 'after' }
  )
    .then((result) => {
      console.log(result);
      if (result) {
        res.status(200).json({ message: 'Product quantity decreased in cart', updatedCartItem: result.value });
      } else {
        res.status(404).json({ message: 'Product not found in cart or quantity already at minimum' });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: 'Error decreasing product quantity in cart', error });
    });
});

module.exports = route;