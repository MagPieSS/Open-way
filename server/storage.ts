import { db } from "./db";
import {
  places, reviews, signatures,
  type Place, type InsertPlace,
  type Review, type InsertReview,
  type Signature
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Places
  getPlaces(): Promise<Place[]>;
  getPlace(id: number): Promise<Place | undefined>;
  createPlace(place: InsertPlace): Promise<Place>;
  searchPlaces(query: string): Promise<Place[]>;

  // Reviews
  getReviews(placeId?: number): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;

  // Petition
  signPetition(): Promise<number>;
  getPetitionCount(): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getPlaces(): Promise<Place[]> {
    return await db.select().from(places).orderBy(desc(places.updatedAt));
  }

  async getPlace(id: number): Promise<Place | undefined> {
    const [place] = await db.select().from(places).where(eq(places.id, id));
    return place;
  }

  async createPlace(place: InsertPlace): Promise<Place> {
    const [newPlace] = await db.insert(places).values(place).returning();
    return newPlace;
  }

  async searchPlaces(query: string): Promise<Place[]> {
    const lowercaseQuery = query.toLowerCase();
    // Simple search - in a real app use ILIKE or TSVECTOR
    // Drizzle with SQLite doesn't strictly have ILIKE everywhere, but this is PG.
    // We can use sql`...` for ILIKE.
    return await db.select().from(places).where(
      sql`lower(${places.name}) LIKE ${`%${lowercaseQuery}%`}`
    );
  }

  async getReviews(placeId?: number): Promise<Review[]> {
    if (placeId) {
      return await db.select().from(reviews).where(eq(reviews.placeId, placeId)).orderBy(desc(reviews.createdAt));
    }
    return await db.select().from(reviews).orderBy(desc(reviews.createdAt));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async signPetition(): Promise<number> {
    await db.insert(signatures).values({});
    return this.getPetitionCount();
  }

  async getPetitionCount(): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)` }).from(signatures);
    return Number(result.count);
  }
}

export const storage = new DatabaseStorage();
