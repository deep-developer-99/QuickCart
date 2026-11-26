import test from "node:test";
import assert from "node:assert/strict";
import { createCloudinarySrcSet, optimizeCloudinaryImageUrl } from "../cloudinaryImage.ts";

test("Cloudinary URLs get stable format, quality, and responsive width transformations", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v123/items/apples.jpg";
  assert.equal(optimizeCloudinaryImageUrl(url, { width: 480 }), "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_480/v123/items/apples.jpg");
  assert.match(createCloudinarySrcSet(url, [240, 480]), /w_240.*240w, .*w_480.*480w/);
});

test("existing crop and gravity transforms are preserved without duplicate format settings", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_900,h_600/v123/banner.jpg";
  assert.equal(optimizeCloudinaryImageUrl(url, { width: 480 }), "https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,h_600,f_auto,q_auto,w_480/v123/banner.jpg");
});

test("non-Cloudinary resources remain unchanged and do not receive srcsets", () => {
  const url = "https://images.example.com/item.jpg?width=original";
  assert.equal(optimizeCloudinaryImageUrl(url, { width: 480 }), url);
  assert.equal(createCloudinarySrcSet(url, [240, 480]), undefined);
});
