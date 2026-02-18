import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db.js";
import User from "../models/User.js";
import Event from "../models/Event.js";
import Booking from "../models/Booking.js";

const users = [
  {
    name: "Alice Organizer",
    email: "alice@events.com",
    password: "password123",
  },
  { name: "Bob Attendee", email: "bob@users.com", password: "password123" },
];

const eventsTemplate = [
  {
    title: "Tech Innovators Conference 2026",
    description:
      "A full-day conference bringing together innovators, startups, and investors to discuss the future of AI and web technologies.",
    date: "2026-05-12",
    venue: "Bengaluru Convention Center",
    location: "Bengaluru Convention Center",
    price: 199,
    imageUrl: "https://picsum.photos/seed/tech-innovators/900/500",
  },
  {
    title: "Indie Music Festival",
    description:
      "An outdoor festival showcasing indie bands from across the country with food stalls and workshops.",
    date: "2026-06-20",
    venue: "Cubbon Park",
    location: "Cubbon Park",
    price: 49,
    imageUrl: "https://picsum.photos/seed/indie-music/900/500",
  },
  {
    title: "Art & Design Workshop",
    description:
      "Hands-on sessions on modern design thinking, illustration, and portfolio reviews for creatives.",
    date: "2026-04-08",
    venue: "Kala Academy",
    location: "Kala Academy",
    price: 29,
    imageUrl: "https://picsum.photos/seed/art-design/900/500",
  },
  {
    title: "Food Truck Carnival",
    description:
      "A weekend of gourmet street food, chef demos, and live music featuring top local food trucks.",
    date: "2026-07-11",
    venue: "Palace Grounds",
    location: "Palace Grounds",
    price: 25,
    imageUrl: "https://picsum.photos/seed/food-truck-carnival/900/500",
  },
  {
    title: "Cloud Engineering Summit",
    description:
      "A technical summit focused on cloud architecture, DevOps best practices, and platform engineering.",
    date: "2026-08-21",
    venue: "World Trade Center",
    location: "World Trade Center",
    price: 149,
    imageUrl: "https://picsum.photos/seed/cloud-summit/900/500",
  },
  {
    title: "Photography Walkathon",
    description:
      "Guided photo walk around iconic city spots with mentoring sessions on framing and storytelling.",
    date: "2026-04-26",
    venue: "Lalbagh Botanical Garden",
    location: "Lalbagh Botanical Garden",
    price: 19,
    imageUrl: "https://picsum.photos/seed/photo-walkathon/900/500",
  },
  {
    title: "Winter Coding Hackathon",
    description:
      "A 24-hour team hackathon to build practical products around civic tech, health, and education.",
    date: "2026-11-14",
    venue: "Innovation Hub Campus",
    location: "Innovation Hub Campus",
    price: 10,
    imageUrl: "https://picsum.photos/seed/winter-hackathon/900/500",
  },
  {
    title: "Sustainability Expo",
    description:
      "An expo featuring clean-energy startups, sustainable products, and panel discussions on climate action.",
    date: "2026-10-03",
    venue: "KTPO Exhibition Center",
    location: "KTPO Exhibition Center",
    price: 35,
    imageUrl: "https://picsum.photos/seed/sustainability-expo/900/500",
  },
];

const seed = async () => {
  try {
    await connectDB();

    // Create users (will hash their passwords via existing auth flow when they register; here we store plain for simplicity)
    // Remove existing sample users by email first to avoid duplicates
    await User.deleteMany({ email: { $in: users.map((u) => u.email) } });
    const createdUsers = await User.insertMany(users);
    console.log(`Created ${createdUsers.length} users`);

    const organizer = createdUsers[0];
    const attendee = createdUsers[1];

    // Create events with organizer info
    await Event.deleteMany({
      title: { $in: eventsTemplate.map((e) => e.title) },
    });
    const eventsToInsert = eventsTemplate.map((e) => ({
      ...e,
      createdBy: organizer._id,
      eventAdmins: [organizer._id],
      organizerName: organizer.name,
      organizerContact: organizer.email,
    }));

    const createdEvents = await Event.insertMany(eventsToInsert);
    console.log(`Created ${createdEvents.length} events`);

    // Create a booking for attendee on first event
    await Booking.deleteMany({});
    const booking = await Booking.create({
      user: attendee._id,
      event: createdEvents[0]._id,
      paymentStatus: "paid",
    });
    console.log(`Created booking ${booking._id}`);

    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
};

seed();
