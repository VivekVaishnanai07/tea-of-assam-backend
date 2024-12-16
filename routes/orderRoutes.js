const express = require("express");
const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const { addDays, format, isWeekend, nextMonday } = require("date-fns");
const verifyToken = require("../middlewares/verifyToken");
const { sendEmail } = require("../service/emailService");

const route = express.Router();

route.get("/:id", verifyToken(), (req, res) => {
  const clientId = req.params.id;
  const db = mongoose.connection;

  db.collection("toa_orders").find({ client_id: new ObjectId(clientId) }).toArray().then((response) => {
    res.send(response)
  })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: "Error placing order", error });
    });
});

route.get("/track/:id", verifyToken(), (req, res) => {
  const orderId = req.params.id;
  const db = mongoose.connection;

  db.collection("toa_orders").findOne({ _id: new ObjectId(orderId) }).then((response) => {
    res.send(response)
  })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: "Error placing order", error });
    });
});

route.post("/place-order", verifyToken(), async (req, res) => {
  const orderData = req.body;
  const db = mongoose.connection;

  function getDaySuffix(day) {
    const j = day % 10;
    const k = day % 100;
    if (j === 1 && k !== 11) {
      return `${day}st`;
    }
    if (j === 2 && k !== 12) {
      return `${day}nd`;
    }
    if (j === 3 && k !== 13) {
      return `${day}rd`;
    }
    return `${day}th`;
  }

  function calculateOrderTracking(orderDate, orderType) {
    const result = [];
    const orderTime = orderDate.getHours();
    const isAfter7PM = orderTime >= 19;

    // Step 1: Confirm Order
    const confirmDate = isAfter7PM ? addDays(orderDate, 1) : orderDate;
    let confirmDateFormatted = format(confirmDate, "EEE, d MMM");
    const confirmDay = parseInt(confirmDateFormatted.split(",")[1].trim()); // Get the day
    confirmDateFormatted = confirmDateFormatted.replace(/(\d+)/, (match) => getDaySuffix(confirmDay));

    result.push({
      label: "Order Confirmed",
      date: confirmDateFormatted,
    });

    // Step 2: Shipped
    const shippedDate = addDays(confirmDate, 1);
    let shippedDateFormatted = format(shippedDate, "EEE, d MMM");
    const shippedDay = parseInt(shippedDateFormatted.split(",")[1].trim()); // Get the day
    shippedDateFormatted = shippedDateFormatted.replace(/(\d+)/, (match) => getDaySuffix(shippedDay));

    result.push({
      label: "Shipped",
      date: shippedDateFormatted,
    });

    // Step 3: Out for Delivery
    let outForDeliveryDate = addDays(shippedDate, 1);

    if (orderType === "Work") {
      // Skip weekend for work deliveries
      if (isWeekend(outForDeliveryDate)) {
        outForDeliveryDate = nextMonday(outForDeliveryDate);
      }
    }

    let outForDeliveryDateFormatted = format(outForDeliveryDate, "EEE, d MMM");
    const outForDeliveryDay = parseInt(outForDeliveryDateFormatted.split(",")[1].trim()); // Get the day
    outForDeliveryDateFormatted = outForDeliveryDateFormatted.replace(/(\d+)/, (match) => getDaySuffix(outForDeliveryDay));

    result.push({
      label: "Out for Delivery",
      date: outForDeliveryDateFormatted,
    });

    // Step 4: Delivery
    let deliveryDateFormatted = format(outForDeliveryDate, "EEE, d MMM");
    const deliveryDay = parseInt(deliveryDateFormatted.split(",")[1].trim()); // Get the day
    deliveryDateFormatted = deliveryDateFormatted.replace(/(\d+)/, (match) => getDaySuffix(deliveryDay));

    result.push({
      label: "Delivery",
      date: deliveryDateFormatted,
    });

    return result;
  }

  const orderDocument = {
    "client_id": new ObjectId(orderData.clientId),
    "email": orderData.email,
    "order_date": new Date(),
    "order_status": orderData.orderStatus,
    "products": orderData.products,
    "order_total": orderData.orderTotal,
    "shipping_address": orderData.shippingAddress,
    "shipping_method": orderData.shippingMethod,
    "tracking_number": orderData.trackingNumber,
    "shipping_status": orderData.shippingStatus,
    "expected_delivery_date": calculateOrderTracking(new Date(), orderData.shippingAddress.type),
    "payment_method": orderData.paymentMethod,
    "amount": orderData.amount,
    "transaction_id": orderData.transaction_id,
  }

  if (orderData.paymentMethod === "UPI") {
    orderDocument.upi_id = orderData.upiId;
  }

  if (orderData.paymentMethod === "CARD") {
    orderDocument.card_number = orderData.cardNumber;
    orderDocument.card_expiry_date = orderData.cardExpiryDate;
    orderDocument.card_cvv = orderData.cvv;
  }

  await db.collection("toa_orders")
    .insertOne(orderDocument)
    .then(async (response) => {
      if (response.insertedId) {
        db.collection("toa_cart").deleteMany({ client_id: new ObjectId(orderData.clientId) })

        // User Activity Log
        db.collection("toa_users_activity").updateOne(
          { userId: new ObjectId(orderData.clientId) },
          { $set: { lastPurchase: new Date() } });

        // Update Stock and Sales
        for (const item of orderData.products) {
          await db.collection("toa_stock_and_sales").updateOne(
            { "product_id": new ObjectId(item.product_id) },
            {
              $inc: {
                "stock": -item.quantity,
                "sales": item.quantity,
              },
              $set: { "last_update_date": new Date() },
            }
          );
        };

        res.status(201).json({
          message: "Order placed successfully",
          orderId: response.insertedId,
        });

        const mailOptions = {
          from: 'teaofassamowner@gmail.com',
          to: orderDocument.email,
          subject: "Order Confirmation",
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  margin: 20px;
                  color: #333;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 20px;
                }
                th, td {
                  padding: 10px;
                  border: 1px solid #ddd;
                }
                th {
                  background-color: #f4f4f4;
                }
                .product-image {
                  max-width: 100px;
                  max-height: 100px;
                }
                .section-title {
                  font-size: 18px;
                  font-weight: bold;
                  margin-bottom: 10px;
                }
              </style>
            </head>
            <body>
              <h1>Order Confirmation</h1>
        
              <!-- Order Info -->
              <div>
                <h2>Order Information</h2>
                <table>
                  <tr>
                    <th>Order ID</th>
                    <td>${orderDocument._id}</td>
                  </tr>
                  <tr>
                    <th>Order Date</th>
                    <td>${new Date(orderDocument.order_date).toLocaleString()}</td>
                  </tr>
                  <tr>
                    <th>Status</th>
                    <td>${orderDocument.order_status}</td>
                  </tr>
                  <tr>
                    <th>Tracking Number</th>
                    <td>${orderDocument.tracking_number}</td>
                  </tr>
                </table>
              </div>
        
              <!-- Shipping Address -->
              <div>
                <h2>Shipping Address</h2>
                <table>
                  <tr>
                    <th>Name</th>
                    <td>${orderDocument.shipping_address.name}</td>
                  </tr>
                  <tr>
                    <th>Phone</th>
                    <td>${orderDocument.shipping_address.number}</td>
                  </tr>
                  <tr>
                    <th>Address</th>
                    <td>
                      ${orderDocument.shipping_address.street}, ${orderDocument.shipping_address.city}, ${orderDocument.shipping_address.state} - ${orderDocument.shipping_address.pinCode}
                    </td>
                  </tr>
                </table>
              </div>
        
              <!-- Products -->
              <div>
                <h2>Products</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Quantity</th>
                      <th>Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${orderDocument.products.map(product => `
                      <tr>
                        <td>${product.name}</td>
                        <td>${product.quantity}</td>
                        <td>${product.price}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
        
              <!-- Expected Delivery -->
              <div>
                <h2>Expected Delivery</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${orderDocument.expected_delivery_date.map(stage => `
                      <tr>
                        <td>${stage.label}</td>
                        <td>${stage.date}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
        
              <!-- Payment Info -->
              <div>
                <h2>Payment Information</h2>
                <table>
                  <tr>
                    <th>Method</th>
                    <td>${orderDocument.payment_method}</td>
                  </tr>
                  <tr>
                    <th>Amount</th>
                    <td>${orderDocument.amount}</td>
                  </tr>
                  <tr>
                    <th>Transaction ID</th>
                    <td>${orderDocument.transaction_id}</td>
                  </tr>
                </table>
              </div>
            </body>
            </html>
          `,
        };

        await sendEmail(mailOptions)
      } else {
        res.status(400).json({ message: "Failed to place order" });
      }
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ message: "Error placing order", error });
    });
});

route.post("/order-payment", verifyToken(), async (req, res) => {
  const orderData = req.body;
  const db = mongoose.connection;

  try {
    if (orderData) {
      // Prepare update fields
      const updateFields = {
        order_status: orderData.orderStatus,
        payment_method: orderData.paymentMethod,
      };

      // Add payment-specific details
      if (orderData.paymentMethod === "UPI") {
        updateFields.upi_id = orderData.upiId;
      } else if (orderData.paymentMethod === "CARD") {
        updateFields.card_number = orderData.cardNumber;
        updateFields.card_expiry_date = orderData.cardExpiryDate;
        updateFields.card_cvv = orderData.cvv;
      }

      // Update the document in a single operation
      const result = await db.collection("toa_orders").updateOne(
        { _id: new ObjectId(orderData.orderId), client_id: new ObjectId(orderData.clientId) },
        { $set: updateFields }
      );

      // Check if the update was successful
      if (result.modifiedCount > 0) {
        return res.status(200).json({ message: "Order payment updated successfully" });
      } else {
        return res.status(404).json({ message: "Order not found or already updated" });
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Error updating order payment", error });
  }
});

module.exports = route;