require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// ✅ Models
const Room = mongoose.model("Room", {
  name: String,
  location: String,
  price: Number,
  beds: [{ bedId: Number, status: String }]
});

const Booking = mongoose.model("Booking", {
  roomId: String,
  bedId: Number,
  userName: String,
  userEmail: String,
  phone: String,
  status: String
});

// ✅ APIs
app.get("/rooms", async (req, res) => {
  const rooms = await Room.find();
  const bookings = await Booking.find({ status: "CONFIRMED" });

  const updatedRooms = rooms.map(room => {
    const beds = room.beds.map(bed => {
      const booking = bookings.find(
        b => b.roomId == room._id.toString() && b.bedId === bed.bedId
      );

      return {
        ...bed.toObject(),
        userName: booking ? booking.userName : null
      };
    });

    return {
      ...room.toObject(),
      beds
    };
  });

  res.json(updatedRooms);
});
app.post("/book", async (req, res) => {
  const { roomId, bedId, userName, userEmail, phone } = req.body;

  const room = await Room.findById(roomId);

  // ✅ FIX: check room exists
  if (!room) {
    return res.json({ message: "Room not found" });
  }

  const bed = room.beds.find(b => b.bedId === bedId);

  // ✅ FIX: check bed exists
  if (!bed) {
    return res.json({ message: "Bed not found" });
  }

  if (bed.status === "occupied") {
    return res.json({ message: "Already booked" });
  }

  bed.status = "occupied";
  await room.save();

  await Booking.create({
    roomId,
    bedId,
    userName,
    userEmail,
    phone,
    status: "CONFIRMED"
  });

  res.json({ message: "Booking confirmed" });
});

//Cancel API
app.post("/cancel", async (req, res) => {
  const { roomId, bedId } = req.body;

  const room = await Room.findById(roomId);
  if (!room) return res.json({ message: "Room not found" });

  const bed = room.beds.find(b => b.bedId === bedId);
  if (!bed) return res.json({ message: "Bed not found" });

  // ✅ NEW CONDITION (VERY IMPORTANT)
  if (bed.status === "available") {
    return res.json({ message: "Bed is already vacated" });
  }

  // make available
  bed.status = "available";
  await room.save();

  // remove booking
  await Booking.updateOne(
    { roomId, bedId, status: "CONFIRMED" },
    { $set: { status: "CANCELLED" } }
  );

  res.json({ message: "Bed vacated successfully" });
});

app.get("/bookings", async (req, res) => {
  const data = await Booking.find();
  res.json(data);
});

// ✅ Seed data
app.get("/seed", async (req, res) => {
  await Room.deleteMany();

  const rooms = [];

  for (let i = 1; i <= 13; i++) {
    rooms.push({
      name: `PG Room ${i}`,
      location: "Hosur",
      price: 5000 + i * 100,
      beds: [
        { bedId: 1, status: "available" },
        { bedId: 2, status: "available" },
        { bedId: 3, status: "available" },
        { bedId: 4, status: "available" },
        { bedId: 5, status: "available" }
      ]
    });
  }

  await Room.insertMany(rooms);

  res.send("Rooms seeded");
});

// ✅ Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));