import { Router } from 'express';
import JobCard from '../models/JobCard.js';
import Customer from '../models/Customer.js';
import Vehicle from '../models/Vehicle.js';
import Technician from '../models/Technician.js';
import Part from '../models/Part.js';
import Service from '../models/Service.js';
import { ah } from '../utils.js';

const router = Router();

const sumField = (rows, field = 'total') => rows.reduce((s, r) => s + (r[field] || 0), 0);

router.get(
  '/',
  ah(async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const sevenDaysAgo = new Date(startOfDay);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      todayJobs,
      carsInBay,
      completedToday,
      revenueTodayAgg,
      revenueMonthAgg,
      revenueByDay,
      statusBreakdown,
      customers,
      vehicles,
      technicians,
      services,
      lowStock,
      recentJobs,
    ] = await Promise.all([
      JobCard.countDocuments({ dateIn: { $gte: startOfDay } }),
      JobCard.countDocuments({ status: { $in: ['received', 'in-service'] } }),
      JobCard.countDocuments({ dateIn: { $gte: startOfDay }, status: { $in: ['completed', 'released'] } }),
      JobCard.aggregate([
        { $match: { dateIn: { $gte: startOfDay }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totals.grand' } } },
      ]),
      JobCard.aggregate([
        { $match: { dateIn: { $gte: startOfMonth }, paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$totals.grand' } } },
      ]),
      JobCard.aggregate([
        { $match: { dateIn: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateIn' } },
            total: { $sum: '$totals.grand' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      JobCard.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Customer.countDocuments(),
      Vehicle.countDocuments(),
      Technician.countDocuments(),
      Service.countDocuments(),
      Part.find({ $expr: { $lte: ['$stock', '$reorderLevel'] } })
        .sort({ stock: 1 })
        .limit(8),
      JobCard.find()
        .populate('customer', 'name phone')
        .populate('vehicle', 'registrationNumber make model')
        .sort({ createdAt: -1 })
        .limit(6),
    ]);

    res.json({
      todayJobs,
      carsInBay,
      completedToday,
      revenueToday: sumField(revenueTodayAgg),
      revenueMonth: sumField(revenueMonthAgg),
      revenueByDay: revenueByDay.map((d) => ({ date: d._id, total: d.total, count: d.count })),
      statusBreakdown: statusBreakdown.map((s) => ({ status: s._id, count: s.count })),
      counts: { customers, vehicles, technicians, services },
      lowStock,
      recentJobs,
    });
  })
);

export default router;
