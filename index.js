const express = require("express");
const path = require("path");

const cors = require("cors");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv").config();
const fs = require("fs");
const connectDB = require("./config/dbConnection");
const adminRoutes = require("./routes/admin");
const categoryRoutes = require("./routes/category");
const http = require("http");
const { Server } = require("socket.io");
// require("./functions/scheduler");
require("./cron/expireMediaRequests");

connectDB();
const app = express();
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);
// const session = require("express-session");
const port = process.env.PORT || 4000;

// app.use(
//   session({
//     resave: false,
//     saveUninitialized: true,
//     secret: process.env.SESSION_SECRET,
//     cookie: {
//       maxAge: 30 * 24 * 60 * 60 * 1000,
//     },
//   })
// );

// const dir = [
//   "./logs",
//   "./public/uploads/users",
//   "./public/uploads/artist",
//   "./public/uploads/art",
//   "./public/uploads/documents",
//   "./public/uploads/videos",
// ];

// for (let data of dir) {
//   if (!fs.existsSync(data)) {
//     fs.mkdirSync(data, { recursive: true });
//   }
// }

// const limiter = rateLimit({
// 	windowMs: 15 * 60 * 1000,
// 	max: 10000,
// 	message: "Too many request from this IP",
// });

// app.use(limiter);
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: true, limit: "30mb" }));
const directory = path.join(__dirname, "public");
app.use(express.static(directory));

app.use("/health", (req, res) => res.send(`Welcome to the server`));
// app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/user", require("./routes/userRoutes"));
// app.use("/api/general", require("./routes/generalRoutes"));

app.use("/api/admin", adminRoutes);
app.use("/api/category", categoryRoutes);
app.use("/api/seller", require("./routes/seller"));
app.use("/api/buyer", require("./routes/buyer"));
app.use("/api/chat", require("./routes/chat"));


const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.set("io", io);

require("./socket")(io);


server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});