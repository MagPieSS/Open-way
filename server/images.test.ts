import { describe, it, expect, beforeAll, afterAll } from "vitest";
import sharp from "sharp";
import path from "path";
import { readFile } from "fs/promises";
import { cleanImage, UploadError } from "./images";
import { uploadsDir } from "./uploads";
import { startTestServer, TestClient, registerUser, type TestServer } from "./test-helpers";

// A small photo carrying the metadata a phone adds: who took it, where, and which way up.
async function phonePhoto(): Promise<Buffer> {
  return sharp({ create: { width: 4, height: 2, channels: 3, background: "red" } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .withExif({
      IFD0: { Artist: "Jane Doe" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "39/1 57/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "75/1 9/1 0/1" },
    })
    .toBuffer();
}

describe("cleanImage", () => {
  it("drops EXIF (GPS, author) from JPEGs", async () => {
    const original = await phonePhoto();
    expect((await sharp(original).metadata()).exif?.toString("latin1")).toContain("Jane Doe");

    const cleaned = await cleanImage(original, "image/jpeg");
    const metadata = await sharp(cleaned).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(cleaned.toString("latin1")).not.toContain("Jane Doe");
  });

  it("keeps the photo upright after removing the orientation tag", async () => {
    const cleaned = await cleanImage(await phonePhoto(), "image/jpeg");
    const metadata = await sharp(cleaned).metadata();
    expect(metadata.orientation).toBeUndefined();
    expect([metadata.width, metadata.height]).toEqual([2, 4]);
  });

  it("drops EXIF from PNG and WebP too", async () => {
    const png = await sharp({ create: { width: 3, height: 3, channels: 4, background: "blue" } })
      .png().withExif({ IFD0: { Artist: "Jane Doe" } }).toBuffer();
    const webp = await sharp({ create: { width: 3, height: 3, channels: 3, background: "green" } })
      .webp().withExif({ IFD0: { Artist: "Jane Doe" } }).toBuffer();

    expect((await sharp(await cleanImage(png, "image/png")).metadata()).exif).toBeUndefined();
    expect((await sharp(await cleanImage(webp, "image/webp")).metadata()).exif).toBeUndefined();
  });

  it("rejects a file that isn't an image", async () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    await expect(cleanImage(html, "image/png")).rejects.toBeInstanceOf(UploadError);
  });

  it("rejects an image labelled as a different type", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    await expect(cleanImage(png, "image/jpeg")).rejects.toThrow("don't match");
  });

  it("rejects unsupported types", async () => {
    await expect(cleanImage(Buffer.from("x"), "image/svg+xml")).rejects.toBeInstanceOf(UploadError);
  });
});

describe("POST /api/uploads/proxy", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("stores photos without their location metadata", async () => {
    const client = new TestClient(server.baseUrl);
    await registerUser(client);

    const res = await client.request("POST", "/api/uploads/proxy", await phonePhoto(), { "content-type": "image/jpeg" });
    expect(res.status).toBe(200);

    const stored = await readFile(path.join(uploadsDir(), path.basename(res.body.objectPath)));
    expect((await sharp(stored).metadata()).exif).toBeUndefined();
    expect(stored.toString("latin1")).not.toContain("Jane Doe");
  });

  it("explains a bad upload without leaking server details", async () => {
    const client = new TestClient(server.baseUrl);
    await registerUser(client);

    const res = await client.request("POST", "/api/uploads/proxy", Buffer.from("not an image"), { "content-type": "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("That file isn't a readable image.");
  });
});
