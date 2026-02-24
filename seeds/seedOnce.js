import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import Event from "../models/Event.js";
import User from "../models/User.js";

const seedOrganizer = {
  name: "Seed Organizer",
  email: "seed-organizer@events.com",
  password: "password123",
  plan: "premium",
};

const sampleEvents = [
  {
    title: "Tech Innovators Conference 2026",
    description:
      "A full-day conference for innovators, startups, and investors to discuss AI and web technologies.",
    date: "2026-05-12",
    venue: "Bengaluru Convention Center",
    location: "Bengaluru Convention Center",
    price: 199,
    imageUrl: "https://picsum.photos/seed/tech-innovators/900/500",
  },
  {
    title: "Indie Music Festival",
    description:
      "An outdoor festival showcasing indie bands with food stalls and creative workshops.",
    date: "2026-06-20",
    venue: "Cubbon Park",
    location: "Cubbon Park",
    price: 49,
    imageUrl: "https://picsum.photos/seed/indie-music/900/500",
  },
  {
    title: "Art & Design Workshop",
    description:
      "Hands-on sessions on design thinking, illustration, and portfolio reviews.",
    date: "2026-04-08",
    venue: "Kala Academy",
    location: "Kala Academy",
    price: 29,
    imageUrl: "https://picsum.photos/seed/art-design/900/500",
  },
  {
    title: "Cloud Engineering Summit",
    description:
      "A technical summit focused on cloud architecture, DevOps, and platform engineering.",
    date: "2026-08-21",
    venue: "World Trade Center",
    location: "World Trade Center",
    price: 149,
    imageUrl: "https://picsum.photos/seed/cloud-summit/900/500",
  },
  {
    title: "Sustainability Expo",
    description:
      "An expo featuring clean-energy startups, sustainable products, and climate discussions.",
    date: "2026-10-03",
    venue: "KTPO Exhibition Center",
    location: "KTPO Exhibition Center",
    price: 35,
    imageUrl: "https://picsum.photos/seed/sustainability-expo/900/500",
  },
];

const seedOnce = async () => {
  try {
    await connectDB();

    const existingEventCount = await Event.countDocuments();
    if (existingEventCount > 0) {
      console.log(
        `Skipping seed: ${existingEventCount} event(s) already exist in database.`,
      );
      process.exit(0);
    }

    let organizer = await User.findOne({ email: seedOrganizer.email });

    if (!organizer) {
      organizer = await User.create({
        ...seedOrganizer,
        password: await bcrypt.hash(seedOrganizer.password, 10),
      });
      console.log(`Created seed organizer: ${organizer.email}`);
    }

    const eventsToInsert = sampleEvents.map((event) => ({
      title: event.title,
      description: event.description,
      date: event.date,
      venue: event.venue,
      location: event.location,
      price: Number(event.price || 0),
      createdBy: organizer._id,
      eventAdmins: [organizer._id],
      organizerName: organizer.name,
      organizerContact: organizer.email,
      media: event.imageUrl
        ? [
            {
              type: "image",
              url: event.imageUrl,
            },
          ]
        : [],
      ticketTypes: [
        {
          name: "General Admission",
          price: Number(event.price || 0),
          quantity: 100,
          sold: 0,
          description: "",
        },
      ],
      approvalStatus: "approved",
      approvalNote: "Seeded data",
    }));

    const inserted = await Event.insertMany(eventsToInsert);
    console.log(`Inserted ${inserted.length} event(s).`);
    process.exit(0);
  } catch (error) {
    console.error("Seed-once failed:", error);
    process.exit(1);
  }
};

seedOnce();
