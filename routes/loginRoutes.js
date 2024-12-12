const express = require("express");
const mongoose = require('mongoose');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../service/emailService');


const route = express.Router();
// OTP store (in-memory for now, use Redis or MongoDB in production)
const otpStore = {};

function formatDate(date) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  const day = String(date.getDate()).padStart(2, '0'); // Ensure two-digit day
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month}, ${year}`;
}

const db = mongoose.connection;

// Login Route
route.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await db.collection("tos_users").findOne({ email });
    if (!user) {
      return res.status(400).send('Your Email is incorrect');
    }

    // Check password (assuming you have password hashed and use or similar)
    if (user.password !== password) {
      return res.status(400).send('Incorrect password');
    }

    // Generate OTP and send it via email
    const otp = Math.floor(100000 + Math.random() * 900000);  // Generate OTP
    const mailOptions = {
      from: 'teaofassamowner@gmail.com',
      to: email,
      subject: "Your OTP Code",
      html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <title>Static Template</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Rubik:ital,wght@0,500;1,500&display=swap" rel="stylesheet">
      </head>
      
      <body style="margin: 0; font-family: 'Rubik', sans-serif; background: #f4f7ff; font-size: 14px;">
        <div style="
              width: 100%;
              min-height: 100vh;
              background: #f4f7ff;
              background-image: url(https://plus.unsplash.com/premium_photo-1666865792992-4c0286ef070a?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D);
              background-repeat: no-repeat;
              background-size: 100% 452px;
              margin-bottom: 20px;
              padding-bottom: 20px;
              background-position: top center;
              font-size: 14px;
              color: #434343;
            ">
          <header style="padding: 32px;">
            <table style="width: 100%">
              <tbody>
                <tr style="height: 0">
                  <td>
                    <img alt="" src="https://tea-of-assam.vercel.app/assets/headerlogo-pfT6lU7d.png" height="50px" />
                  </td>
                  <td style="text-align: right">
                    <span style="font-size: 16px; line-height: 30px; color: #ffffff">${formatDate(new Date())}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </header>
          <main>
            <div
              style="margin: 26px; padding: 26px; background: #ffffff; border-radius: 30px; text-align: center; display: flex; height: 450px; align-items: center; justify-content: center;">
              <div style="width: 100%; max-width: 700px; margin: 0 auto">
                <h1 style="margin: 0; font-size: 30px; font-weight: bold; color: #1f1f1f;"> Your OTP </h1>
                <p style="margin: 0; margin-top: 17px; font-size: 18px; font-weight: 500;">Hey ${user.firstName}
                  ${user.lastName},</p>
                <p style="margin: 0; margin-top: 17px; font-weight: 500; font-size: 16px; letter-spacing: 0.56px;">
                  Thank you for choosing Tea of Assam! To complete the procedure of changing your email address,
                  please use the following OTP (One-Time Password). This OTP is valid for the next <span
                    style="font-weight: 600; color: #1f1f1f;">5 minutes</span>.
                  For your security, please do not share this code with anyone, including Tea of Assam employees.
                  If you did not request this change, please contact our support team immediately.
                </p>
                <p
                  style="margin: 0; margin-top: 60px; font-size: 40px; font-weight: 600; letter-spacing: 25px; color: #ba3d4f;">
                  ${otp}</p>
              </div>
            </div>
            <p style="max-width: 400px; margin: 0 auto; text-align: center; font-weight: 500; color: #8c8c8c;">Need help? Ask
              at
              <a href="mailto:teaofassam@gmail.com" style="color: #499fb6; text-decoration: none;">teaofassam@gmail.com</a> or
              visit our
              <a href="" target="_blank" style="color: #499fb6; text-decoration: none;">Help Center</a>
            </p>
          </main>
          <footer
            style="width: 100%; max-width: 490px; margin: 20px auto 20px; text-align: center; border-top: 1px solid #e6ebf1;">
            <p style="margin: 0; font-size: 16px; font-weight: 600; color: #434343;">Tea Of Assam</p>
            <p style="margin: 0; margin-top: 16px; color: #434343">Copyright © 2022 Company. All rights reserved.</p>
          </footer>
        </div>
      </body>
      </html>`
    };
    await sendEmail(mailOptions);

    otpStore[email] = { otp, expiresAt: Date.now() + 2 * 60 * 1000 };
    return res.json({ message: 'OTP sent to your email address' });
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

// OTP Verification Route
route.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  console.log(email);
  try {
    // Check if OTP exists for the provided email
    const storedOtp = otpStore[email];
    if (!storedOtp) {
      return res.status(400).send('OTP not found for this email');
    }

    // Check if OTP has expired
    if (Date.now() > storedOtp.expiresAt) {
      delete otpStore[email];  // Delete expired OTP
      return res.status(400).send('OTP has expired, please request a new one');
    }

    // Check if the provided OTP matches the stored OTP
    if (storedOtp.otp !== parseInt(otp)) {
      return res.status(400).send('Invalid OTP');
    }

    // OTP is valid, delete OTP from memory (optional)
    delete otpStore[email];

    // Generate JWT Token after OTP verification
    const user = await db.collection("tos_users").findOne({ email });

    if (user.role === 'admin') {
      return res.status(403).send("Access Denied");
    }

    // Generate JWT Token
    const tokenData = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };

    const token = jwt.sign(tokenData, process.env.JWT_SECRET_KEY, { expiresIn: '24h' });

    const userActiveLogFind = await db.collection("tos_users_activity").findOne({ userId: new ObjectId(user._id) });
    if (userActiveLogFind) {
      db.collection("tos_users_activity").updateOne(
        { userId: new ObjectId(user._id) },
        { $set: { lastLogin: new Date() } });
    } else {
      db.collection("tos_users_activity").insertOne(
        {
          userId: new ObjectId(user._id),
          lastLogin: new Date(),
          lastPurchase: new Date(),
          lastActivity: new Date()
        });
    }

    return res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});


module.exports = route;