import assert from "node:assert/strict";
import test from "node:test";
import Address from "../../models/Address";
import Vendor from "../../models/Vendor";
import { createAddress, getUserAddresses, updateAddress } from "../addressService";
import { updateVendorShopLocation } from "../vendorShopService";
import { optionalCoordinates } from "../../utils/optionalCoordinates";

const setModelMethod = (name: string, value: unknown, model: object = Address) => {
  const original = Object.getOwnPropertyDescriptor(model, name);
  Object.defineProperty(model, name, {
    configurable: true,
    writable: true,
    value,
  });
  return () => {
    if (original) Object.defineProperty(model, name, original);
    else Reflect.deleteProperty(model, name);
  };
};

test("optional coordinates accept only complete valid pairs and do not invent missing values", () => {
  assert.deepEqual(optionalCoordinates({}), {});
  assert.deepEqual(optionalCoordinates({ latitude: null, longitude: null }), {});
  assert.deepEqual(optionalCoordinates({ latitude: 0, longitude: 0 }), {
    latitude: 0,
    longitude: 0,
  });
  assert.throws(() => optionalCoordinates({ latitude: 12.5 }), /valid coordinate pair/);
  assert.throws(() => optionalCoordinates({ latitude: 91, longitude: 10 }), /valid coordinate pair/);
  assert.throws(() => optionalCoordinates({ latitude: 10, longitude: Number.NaN }), /valid coordinate pair/);
});

test("address creation persists supplied valid coordinates and omits missing coordinates", async () => {
  const persisted: Record<string, unknown>[] = [];
  const restore = setModelMethod("create", async (value: Record<string, unknown>) => {
    persisted.push(value);
    return value;
  });
  try {
    await createAddress("user-1", {
      fullName: "Customer",
      phone: "+919625226196",
      addressLine: "1 Main Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      latitude: 18.5204,
      longitude: 73.8567,
    });
    await createAddress("user-1", {
      fullName: "Customer",
      phone: "+919625226196",
      addressLine: "Old address",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
    });

    assert.equal(persisted[0].latitude, 18.5204);
    assert.equal(persisted[0].longitude, 73.8567);
    assert.equal(Object.hasOwn(persisted[1], "latitude"), false);
    assert.equal(Object.hasOwn(persisted[1], "longitude"), false);
  } finally {
    restore();
  }
});

test("address retrieval returns persisted coordinates", async () => {
  const saved = [{
    _id: "address-1",
    addressLine: "1 Main Road",
    latitude: 18.5204,
    longitude: 73.8567,
  }];
  const query = {
    sort() { return this; },
    skip() { return this; },
    limit() { return Promise.resolve(saved); },
  };
  const restoreFind = setModelMethod("find", () => query);
  const restoreCount = setModelMethod("countDocuments", async () => 1);
  try {
    const result = await getUserAddresses("user-1");
    assert.equal(result.data[0].latitude, 18.5204);
    assert.equal(result.data[0].longitude, 73.8567);
  } finally {
    restoreFind();
    restoreCount();
  }
});

test("address updates preserve saved coordinates when no new pair is supplied", async () => {
  const saved = {
    phone: "+919625226196",
    latitude: 18.5204,
    longitude: 73.8567,
    addressLine: "Old address",
    async save() { return this; },
  };
  const restore = setModelMethod("findOne", async () => saved);
  try {
    const result = await updateAddress("address-1", "user-1", {
      addressLine: "New address",
    });
    assert.equal(result.latitude, 18.5204);
    assert.equal(result.longitude, 73.8567);
    assert.equal(result.addressLine, "New address");
  } finally {
    restore();
  }
});

test("address phone is required and validated on create and update", async () => {
  const restoreCreate = setModelMethod("create", async (value: Record<string, unknown>) => value);
  try {
    await assert.rejects(() => createAddress("user-1", {
      fullName: "Customer", phone: "   ", addressLine: "1 Main Road", city: "Pune", state: "Maharashtra", pincode: "411001",
    }), /Phone number is required/);
    await assert.rejects(() => createAddress("user-1", {
      fullName: "Customer", phone: "123", addressLine: "1 Main Road", city: "Pune", state: "Maharashtra", pincode: "411001",
    }), /Please enter a valid mobile number/);
  } finally {
    restoreCreate();
  }

  const saved = { phone: "+919625226196", addressLine: "Old address", async save() { return this; } };
  const restoreFind = setModelMethod("findOne", async () => saved);
  try {
    await assert.rejects(() => updateAddress("address-1", "user-1", { phone: "" }), /Phone number is required/);
    await assert.rejects(() => updateAddress("address-1", "user-1", { phone: "123" }), /Please enter a valid mobile number/);
    const result = await updateAddress("address-1", "user-1", { addressLine: "Updated" });
    assert.equal(result.phone, "+919625226196");
  } finally {
    restoreFind();
  }
});

test("vendor shop updates persist validated coordinates", async () => {
  let update: Record<string, unknown> | undefined;
  const restore = setModelMethod("findByIdAndUpdate", (_id: string, value: Record<string, unknown>) => {
    update = value.$set as Record<string, unknown>;
    return { select: async () => ({ _id: "vendor-1", ...update }) };
  }, Vendor);
  try {
    await updateVendorShopLocation("vendor-1", {
      address: "1 Main Road",
      city: "Pune",
      state: "Maharashtra",
      pincode: "411001",
      latitude: 18.5204,
      longitude: 73.8567,
    });
    assert.equal(update?.latitude, 18.5204);
    assert.equal(update?.longitude, 73.8567);
  } finally {
    restore();
  }
});

