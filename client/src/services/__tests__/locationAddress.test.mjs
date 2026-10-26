import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addressFieldsFromProvider,
  extractAddressComponents,
} from '../locationAddress.ts';

test('maps a raw Nominatim city, house number, and road to the vendor fields', () => {
  const address = extractAddressComponents({
    display_name: '17 MG Road, Pune',
    address: {
      house_number: '17',
      road: 'MG Road',
      city: 'Pune',
      state: 'Maharashtra',
      postcode: '411001',
    },
  });

  assert.equal(address.addressLine, '17, MG Road');
  assert.equal(address.city, 'Pune');
  assert.deepEqual(addressFieldsFromProvider(address), {
    address: '17, MG Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
  });
});

test('uses town and village when city is absent', () => {
  assert.equal(
    extractAddressComponents({ address: { town: 'Satara' } }).city,
    'Satara',
  );
  assert.equal(
    extractAddressComponents({ address: { village: 'Wagholi' } }).city,
    'Wagholi',
  );
});

test('prefers specific localities over county, and uses county only as a fallback', () => {
  assert.equal(
    extractAddressComponents({
      address: { city_district: 'Pune City', county: 'Pune District' },
    }).city,
    'Pune City',
  );
  assert.equal(
    extractAddressComponents({ address: { county: 'Pune District' } }).city,
    'Pune District',
  );
  assert.equal(
    extractAddressComponents({
      village: 'Outer Village',
      address: { city: 'Pune' },
    }).city,
    'Pune',
  );
});

test('builds a deduplicated street line from available parts without inventing missing details', () => {
  const address = extractAddressComponents({
    address: {
      house_number: '4',
      road: 'Station Road',
      residential: 'Station Road',
      neighbourhood: 'Central',
      suburb: 'Central',
    },
  });
  assert.equal(address.addressLine, '4, Station Road, Central');

  const partial = extractAddressComponents({
    address: { state: 'Maharashtra', postcode: '411001' },
  });
  assert.equal(partial.addressLine, '');
  assert.equal(partial.city, '');
  assert.deepEqual(addressFieldsFromProvider(partial), {
    state: 'Maharashtra',
    pincode: '411001',
  });
});

test('accepts the normalized backend response shape', () => {
  const address = extractAddressComponents({
    addressLine: 'Shop 2, Baner Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411045',
    displayName: 'Shop 2, Baner Road, Pune',
  });
  assert.equal(address.addressLine, 'Shop 2, Baner Road');
  assert.equal(address.city, 'Pune');
  assert.deepEqual(addressFieldsFromProvider(address), {
    address: 'Shop 2, Baner Road',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411045',
  });
});
