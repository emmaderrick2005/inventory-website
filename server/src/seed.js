import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDB, disconnectDB } from './db.js';
import Customer from './models/Customer.js';
import Vehicle from './models/Vehicle.js';
import Service from './models/Service.js';
import Part from './models/Part.js';
import Technician from './models/Technician.js';
import JobCard from './models/JobCard.js';
import User from './models/User.js';
import { setSequence } from './models/Counter.js';

/**
 * Demo data for Oyera Auto Service Bay Ltd (OAS Bay).
 * All money values are in Ugandan shillings (UGX).
 * Prices taken from the brief; items the brief did not price are marked.
 */
export const SEED = {
  services: [
    { name: 'Engine oil & filter change', price: 0, isFixed: false, description: 'Parts + labour (20,000 labour charged on the job card)' },
    { name: 'Gearbox oil & filter change', price: 0, isFixed: false, description: 'Parts + labour' },
    { name: 'Brake fluid change', price: 0, isFixed: false, description: 'Parts + labour' },
    { name: 'Brake pad change', price: 0, isFixed: false, description: 'Parts + labour' },
    { name: 'Greasing', price: 0, isFixed: false, description: 'Labour only' },
    { name: 'Minor repairs', price: 0, isFixed: false, description: 'Labour only' },
    { name: 'Wheel alignment', price: 30000, isFixed: true, description: 'Fixed charge per car' },
    { name: 'Wheel balancing', price: 20000, isFixed: true, description: 'Fixed charge per car' },
  ],

  parts: [
    { name: 'Engine Oil 5W-30 (Semi Synthetic)', category: 'engine-oil', price: 79000, stock: 13, unit: 'bottle', reorderLevel: 5 },
    { name: 'Engine Oil 5W-40 (Synthetic)', category: 'engine-oil', price: 120000, stock: 10, unit: 'bottle', reorderLevel: 5 },
    { name: 'Engine Oil 10W-40 (Fully Synthetic)', category: 'engine-oil', price: 200000, stock: 6, unit: 'bottle', reorderLevel: 4 },
    { name: 'Gearbox Oil 80W-90', category: 'gearbox-oil', price: 95000, stock: 8, unit: 'bottle', reorderLevel: 4 },
    { name: 'Oil Filter (Small)', category: 'filter', price: 15000, stock: 24, unit: 'piece', reorderLevel: 5 },
    { name: 'Oil Filter (Heavy)', category: 'filter', price: 20000, stock: 3, unit: 'piece', reorderLevel: 5 },
    { name: 'Air Filter', category: 'filter', price: 25000, stock: 12, unit: 'piece', reorderLevel: 5 },
    { name: 'Brake Fluid DOT3', category: 'brake-fluid', price: 13000, stock: 20, unit: 'bottle', reorderLevel: 5 },
    { name: 'Brake Fluid DOT4', category: 'brake-fluid', price: 20000, stock: 14, unit: 'bottle', reorderLevel: 5 },
    { name: 'Brake Pads (Front Set)', category: 'brake-pads', price: 65000, stock: 8, unit: 'set', reorderLevel: 3 },
    { name: 'Brake Pads (Rear Set)', category: 'brake-pads', price: 75000, stock: 2, unit: 'set', reorderLevel: 3 },
  ],

  technicians: [
    { name: 'Moses Okello', phone: '0772 445 566', role: 'senior', skills: ['Diagnostics', 'Engine', 'Wheel alignment'] },
    { name: 'Sarah Nakato', phone: '0701 332 110', role: 'technician', skills: ['Brakes', 'Gearbox', 'Oil services'] },
    { name: 'John Ssempereza', phone: '0752 889 001', role: 'technician', skills: ['Wheel balancing', 'Suspension', 'Electrical'] },
    { name: 'Peter Wanyama', phone: '0774 220 993', role: 'technician', skills: ['Greasing', 'Minor repairs'] },
  ],

  customers: [
    { name: 'James Mugisha', phone: '0772 123 456', email: 'jmugisha@example.ug', address: 'Nakawa, Kampala' },
    { name: 'Aisha Nankya', phone: '0701 987 654', email: 'anankya@example.ug', address: 'Wakiso' },
    { name: 'Freight Masters Ltd', phone: '0774 000 111', email: 'fleet@freightmasters.ug', address: 'Nansana, Wakiso' },
    { name: 'Brian Okot', phone: '0752 456 789', email: '', address: 'Ntinda, Kampala' },
  ],

  /** Demo logins (change in production): admin manages users & catalogue. */
  users: [
    { name: 'Bay Manager', email: 'admin@oasbay.ug', password: 'admin123', role: 'admin' },
    { name: 'Moses Okello', email: 'senior@oasbay.ug', password: 'senior123', role: 'senior' },
    { name: 'Reception Desk', email: 'reception@oasbay.ug', password: 'reception123', role: 'reception' },
  ],
};

async function userDocs() {
  return Promise.all(
    SEED.users.map(async (u) => ({
      name: u.name,
      email: u.email,
      role: u.role,
      passwordHash: await bcrypt.hash(u.password, 10),
      active: true,
    }))
  );
}

const HOUR = 3600 * 1000;

/**
 * Job cards demo: same day activity so the dashboard has something to show.
 * - OAS-0001 oil & filter service (parts + 20,000 labour)
 * - OAS-0002 alignment 30,000 + balancing 20,000 (no bay labour)
 * - OAS-0003 brake fluid + pads, still in the bay
 * - OAS-0004 greasing + minor repairs, just received
 */
function buildJobCards({ customers, vehicles, services, parts, technicians }) {
  const byName = (list, name) => list.find((d) => d.name === name);
  const veh = (reg) => vehicles.find((v) => v.registrationNumber === reg);
  const svc = (name) => byName(services, name);
  const part = (name) => byName(parts, name);
  const tech = (name) => byName(technicians, name);
  const senior = technicians.find((t) => t.role === 'senior');

  const todayAt = (h, m) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };
  const yesterdayAt = (h, m) => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(h, m, 0, 0);
    return d;
  };

  return [
    {
      jobNumber: 'OAS-0001',
      receiptNumber: 'RC-0001',
      customer: customers.find((c) => c.name === 'James Mugisha')._id,
      vehicle: veh('UAC 456K')._id,
      dateIn: todayAt(9, 20),
      dateOut: todayAt(11, 0),
      status: 'released',
      paymentStatus: 'paid',
      assessedBy: senior._id,
      technicians: [tech('Sarah Nakato')._id],
      services: [{ serviceId: svc('Engine oil & filter change')._id, name: svc('Engine oil & filter change').name, price: 0 }],
      parts: [
        { partId: part('Engine Oil 5W-30 (Semi Synthetic)')._id, name: part('Engine Oil 5W-30 (Semi Synthetic)').name, price: 79000, quantity: 2 },
        { partId: part('Oil Filter (Small)')._id, name: part('Oil Filter (Small)').name, price: 15000, quantity: 1 },
      ],
      labourCharge: 20000,
      notes: 'Customer advised on filter replacement interval.',
    },
    {
      jobNumber: 'OAS-0002',
      receiptNumber: 'RC-0002',
      customer: customers.find((c) => c.name === 'Aisha Nankya')._id,
      vehicle: veh('UAF 789L')._id,
      dateIn: todayAt(11, 5),
      status: 'completed',
      paymentStatus: 'paid',
      assessedBy: senior._id,
      technicians: [tech('John Ssempereza')._id],
      services: [
        { serviceId: svc('Wheel alignment')._id, name: 'Wheel alignment', price: 30000 },
        { serviceId: svc('Wheel balancing')._id, name: 'Wheel balancing', price: 20000 },
      ],
      parts: [],
      labourCharge: 0,
      notes: 'Front tyres worn unevenly; customer informed.',
    },
    {
      jobNumber: 'OAS-0003',
      customer: customers.find((c) => c.name === 'Freight Masters Ltd')._id,
      vehicle: veh('UBK 321M')._id,
      dateIn: yesterdayAt(15, 30),
      status: 'in-service',
      paymentStatus: 'unpaid',
      assessedBy: senior._id,
      technicians: [tech('Sarah Nakato')._id, tech('John Ssempereza')._id],
      services: [
        { serviceId: svc('Brake fluid change')._id, name: svc('Brake fluid change').name, price: 0 },
        { serviceId: svc('Brake pad change')._id, name: svc('Brake pad change').name, price: 0 },
      ],
      parts: [
        { partId: part('Brake Fluid DOT4')._id, name: part('Brake Fluid DOT4').name, price: 20000, quantity: 1 },
        { partId: part('Brake Pads (Front Set)')._id, name: part('Brake Pads (Front Set)').name, price: 65000, quantity: 1 },
      ],
      labourCharge: 20000,
      notes: 'Fleet vehicle; invoice to be sent to company account.',
    },
    {
      jobNumber: 'OAS-0004',
      customer: customers.find((c) => c.name === 'Brian Okot')._id,
      vehicle: veh('UBH 987P')._id,
      dateIn: todayAt(8, 15),
      status: 'received',
      paymentStatus: 'unpaid',
      assessedBy: senior._id,
      technicians: [tech('Peter Wanyama')._id],
      services: [
        { serviceId: svc('Greasing')._id, name: svc('Greasing').name, price: 0 },
        { serviceId: svc('Minor repairs')._id, name: svc('Minor repairs').name, price: 0 },
      ],
      parts: [],
      labourCharge: 20000,
      notes: 'Squeaking steering noise reported by owner.',
    },
  ];
}

/** Wipes every collection and loads the demo data. */
export async function seed({ clear = true } = {}) {
  if (clear) {
    await Promise.all([
      Customer.deleteMany({}),
      Vehicle.deleteMany({}),
      Service.deleteMany({}),
      Part.deleteMany({}),
      Technician.deleteMany({}),
      JobCard.deleteMany({}),
      User.deleteMany({}),
      mongoose.connection.db?.collection('counters').deleteMany({}),
    ]);
  }

  const [usersDocs, customersDocs] = await Promise.all([
    User.insertMany(await userDocs()),
    Customer.insertMany(SEED.customers),
  ]);
  const [servicesDocs, partsDocs, techsDocs] = await Promise.all([
    Service.insertMany(SEED.services),
    Part.insertMany(SEED.parts),
    Technician.insertMany(SEED.technicians),
  ]);

  const owner = (name) => customersDocs.find((c) => c.name === name)._id;
  const vehiclesDocs = await Vehicle.insertMany([
    { registrationNumber: 'UAC 456K', make: 'Toyota', model: 'Prado', type: 'small', owner: owner('James Mugisha') },
    { registrationNumber: 'UAF 789L', make: 'Nissan', model: 'X-Trail', type: 'small', owner: owner('Aisha Nankya') },
    { registrationNumber: 'UBK 321M', make: 'Mitsubishi', model: 'Canter', type: 'commercial', owner: owner('Freight Masters Ltd') },
    { registrationNumber: 'UBR 654J', make: 'Isuzu', model: 'FRR Truck', type: 'heavy', owner: owner('Freight Masters Ltd') },
    { registrationNumber: 'UBH 987P', make: 'Honda', model: 'Fit', type: 'small', owner: owner('Brian Okot') },
  ]);

  const jobCards = buildJobCards({
    customers: customersDocs,
    vehicles: vehiclesDocs,
    services: servicesDocs,
    parts: partsDocs,
    technicians: techsDocs,
  });

  // Model.create runs the pre-save hook that computes totals (insertMany would skip it).
  for (const jobData of jobCards) {
    await JobCard.create(jobData);
  }
  await setSequence('jobcard', jobCards.length);
  await setSequence('receipt', jobCards.filter((j) => j.receiptNumber).length);

  return { customers: customersDocs.length, vehicles: vehiclesDocs.length, services: servicesDocs.length, parts: partsDocs.length, technicians: techsDocs.length, jobCards: jobCards.length, users: usersDocs.length };
}

/** Loads demo data only when the database is empty (first run). */
export async function seedIfEmpty() {
  const count = await Customer.countDocuments();
  if (count > 0) {
    // databases created before accounts existed still need user logins
    if ((await User.countDocuments()) === 0) {
      await User.insertMany(await userDocs());
      console.log('[seed] added user accounts (admin/senior/reception)');
    }
    return false;
  }
  const result = await seed({ clear: false });
  console.log('[seed] loaded demo records:', result);
  return true;
}

/* Allow `npm run seed` to force a re-seed. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await connectDB();
    const result = await seed();
    console.log('[seed] database reseeded:', result);
  } catch (err) {
    console.error('[seed] failed:', err);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}
