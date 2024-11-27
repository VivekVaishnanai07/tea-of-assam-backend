const express = require('express');
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');

const router = express.Router();

router.get("/", (req, res) => {
  const db = mongoose.connection;

  db.collection("tos_products").find().toArray().then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

router.get("/:id", (req, res) => {
  const productsId = req.params.id;
  const db = mongoose.connection;

  db.collection("tos_products").findOne({ _id: new ObjectId(productsId) }).then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

module.exports = router;