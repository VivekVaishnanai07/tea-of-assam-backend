const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const loginRoutes = require("./routes/loginRoutes");
const productsRoute = require("./routes/productsRoutes");
const giftProductsRoute = require("./routes/giftProductsRoutes");
const clientsRoute = require("./routes/clientRoues");
const wishlistRoutes = require("./routes/wishlistRoutes");
const cartRoutes = require("./routes/cartRoutes");
const orderRoutes = require("./routes/orderRoutes");

// Admin Routes
const adminLoginRoutes = require("./routes/admin-routes/adminLoginRoutes");
const adminOverviewRoutes = require("./routes/admin-routes/adminOverviewRoutes");
const adminProductsRoutes = require("./routes/admin-routes/adminProductsRoutes");
const adminUsersRoutes = require("./routes/admin-routes/adminUsersRoutes");
const adminSalesRoutes = require("./routes/admin-routes/adminSalesRoutes");
const adminOrdersRoutes = require("./routes/admin-routes/adminOrdersRoutes");

dotenv.config();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3300;

// Middleware setup
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected successfully");
  })
  .catch((err) => {
    console.log("MongoDB connection error: ", err);
    process.exit(1); // Exit the process with a failure code
  });

// Public Side Routes
app.use("/api", loginRoutes);
app.use("/api/products", productsRoute);
app.use("/api/gift-products", giftProductsRoute);
app.use("/api/clients", clientsRoute);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

// Admin Side Routes
app.use("/api/admin", adminLoginRoutes);
app.use("/api/admin/overview", adminOverviewRoutes);
app.use("/api/admin/products", adminProductsRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/admin/sales", adminSalesRoutes);
app.use("/api/admin/orders", adminOrdersRoutes);


// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});