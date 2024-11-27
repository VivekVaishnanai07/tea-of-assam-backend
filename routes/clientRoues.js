const express = require('express');
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const verifyToken = require("../middlewares/verifyToken");

const router = express.Router();

router.get("/:id", verifyToken(), (req, res) => {
  const clientId = req.params.id;
  const db = mongoose.connection;

  db.collection("tos_clients").findOne({ _id: new ObjectId(clientId) }).then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

router.post("/add-deliveryAddress/:id", verifyToken(), (req, res) => {
  const clientId = req.params.id;
  const { newAddress } = req.body;
  const db = mongoose.connection;
  db.collection("tos_clients").updateOne(
    { "_id": new ObjectId(clientId) },
    {
      $push: {
        deliveryAddresses: {
          name: newAddress.name,
          number: newAddress.mobile,
          street: newAddress.streetAddress,
          city: newAddress.city,
          state: newAddress.state,
          pinCode: newAddress.zip,
          locality: newAddress.locality,
          type: newAddress.type
        }
      }
    }
  ).then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

router.patch("/update-deliveryAddress/:id", verifyToken(), (req, res) => {
  const clientId = req.params.id;
  const { address } = req.body;
  const db = mongoose.connection;

  db.collection("tos_clients").updateOne(
    { "_id": new ObjectId(clientId) },
    {
      $set: {
        "deliveryAddresses.$.name": address.name,
        "deliveryAddresses.$.number": address.mobile,
        "deliveryAddresses.$.street": address.streetAddress,
        "deliveryAddresses.$.city": address.city,
        "deliveryAddresses.$.state": address.state,
        "deliveryAddresses.$.pinCode": address.zip,
        "deliveryAddresses.$.locality": address.locality,
        "deliveryAddresses.$.type": address.type
      }
    }
  ).then((response) => {
    return res.send(response);
  }).catch((error) => {
    console.error(error);
  })
});

module.exports = router;