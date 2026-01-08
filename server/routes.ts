import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { ACCESSIBILITY_STATUS } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Places
  app.get(api.places.list.path, async (req, res) => {
    const search = req.query.search as string | undefined;
    if (search) {
      const results = await storage.searchPlaces(search);
      res.json(results);
    } else {
      const results = await storage.getPlaces();
      res.json(results);
    }
  });

  app.get(api.places.get.path, async (req, res) => {
    const place = await storage.getPlace(Number(req.params.id));
    if (!place) return res.status(404).json({ message: "Place not found" });
    res.json(place);
  });

  app.post(api.places.create.path, async (req, res) => {
    try {
      const input = api.places.create.input.parse(req.body);
      const place = await storage.createPlace(input);
      res.status(201).json(place);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Reviews
  app.get(api.reviews.list.path, async (req, res) => {
    const placeId = req.query.placeId ? Number(req.query.placeId) : undefined;
    const results = await storage.getReviews(placeId);
    res.json(results);
  });

  app.post(api.reviews.create.path, async (req, res) => {
    try {
      const input = api.reviews.create.input.parse(req.body);
      const review = await storage.createReview(input);
      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Petition
  app.get(api.petition.count.path, async (req, res) => {
    const total = await storage.getPetitionCount();
    res.json({ total });
  });

  app.post(api.petition.sign.path, async (req, res) => {
    const total = await storage.signPetition();
    res.json({ total });
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existing = await storage.getPlaces();
  if (existing.length === 0) {
    console.log("Seeding database...");
    
    // 1. SEPTA
    const septa = await storage.createPlace({
      name: "SEPTA Train Stations",
      category: "Transportation",
      accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
      description: "Some stations have elevators or ramps, but access varies across the network. Check specific station details before traveling.",
      imageUrl: "https://images.unsplash.com/photo-1518063264667-27b2354a9d70?auto=format&fit=crop&q=80&w=800", // Train/station placeholder
    });

    // 2. Art Museum
    await storage.createPlace({
      name: "Philadelphia Museum of Art",
      category: "Museum",
      accessibilityStatus: ACCESSIBILITY_STATUS.NOT_ACCESSIBLE,
      description: "Limited accessible entrances and challenging stair access. The famous 'Rocky Steps' are a major barrier.",
      imageUrl: "https://images.unsplash.com/photo-1534068590799-09895a701e3e?auto=format&fit=crop&q=80&w=800", // Museum placeholder
    });

    // 3. Free Library
    const library = await storage.createPlace({
      name: "Free Library of Philadelphia",
      category: "Library",
      accessibilityStatus: ACCESSIBILITY_STATUS.PARTIALLY_ACCESSIBLE,
      description: "Some accessible features are available, but barriers remain in older sections of the building.",
      imageUrl: "https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&q=80&w=800", // Library placeholder
    });

    // 4. Parkway Central Library
    await storage.createPlace({
      name: "Parkway Central Library",
      category: "Library",
      accessibilityStatus: ACCESSIBILITY_STATUS.NOT_ACCESSIBLE,
      description: "Major accessibility barriers reported by community members, including heavy doors and broken elevators.",
      imageUrl: "https://images.unsplash.com/photo-1541963463532-d68292c34b19?auto=format&fit=crop&q=80&w=800", // Library interior placeholder
    });

    // Add some reviews
    await storage.createReview({
      placeId: septa.id,
      content: "The elevator at my local station has been out for weeks!",
    });

    await storage.createReview({
      placeId: library.id,
      content: "Staff was very helpful in assisting me with the elevator.",
    });
    
    // Add some signatures
    await storage.signPetition();
    await storage.signPetition();
    await storage.signPetition();
    
    console.log("Database seeded!");
  }
}
