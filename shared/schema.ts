import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

export const places = pgTable("places", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Museum, Transportation, Library, etc.
  accessibilityStatus: text("accessibility_status").notNull(), // 'Accessible', 'Partially Accessible', 'Not Accessible'
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  placeId: integer("place_id").references(() => places.id).notNull(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const petitions = pgTable("petitions", {
  id: serial("id").primaryKey(),
  signatureCount: integer("signature_count").default(0).notNull(),
  lastSignedAt: timestamp("last_signed_at").defaultNow(),
});

// === INSERT SCHEMAS ===

export const insertPlaceSchema = createInsertSchema(places).omit({ id: true, updatedAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
// Petition is mainly a counter, but if we wanted to store signers we could. 
// For this prototype, a simple counter or a log of signatures is fine. 
// Let's make a table for individual signatures to be more realistic? 
// The prompt says "Visible counter that increases when signed". 
// A single row in 'petitions' is easiest for a global counter, or we count rows in a 'signatures' table.
// Let's use a 'signatures' table for better practice.
export const signatures = pgTable("signatures", {
  id: serial("id").primaryKey(),
  signedAt: timestamp("signed_at").defaultNow(),
});
export const insertSignatureSchema = createInsertSchema(signatures).omit({ id: true, signedAt: true });


// === TYPES ===

export type Place = typeof places.$inferSelect;
export type InsertPlace = z.infer<typeof insertPlaceSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Signature = typeof signatures.$inferSelect;

// Request/Response Types
export type PlaceResponse = Place;
export type ReviewResponse = Review;
export type SignatureResponse = { total: number };

// For the frontend to know the statuses
export const ACCESSIBILITY_STATUS = {
  ACCESSIBLE: 'Accessible',
  PARTIALLY_ACCESSIBLE: 'Partially Accessible',
  NOT_ACCESSIBLE: 'Not Accessible',
} as const;
