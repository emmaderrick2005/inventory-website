import { Router } from 'express';
import JobCard from '../models/JobCard.js';
import Technician from '../models/Technician.js';
import { ah, HttpError } from '../utils.js';

const router = Router();

/** 'YYYY-MM' -> Date range [start, end) */
function monthRange(month) {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new HttpError(400, 'month must be formatted YYYY-MM');
  }
  const [year, m] = month.split('-').map(Number);
  return { start: new Date(year, m - 1, 1), end: new Date(year, m, 1) };
}

async function summaryFor(start, end) {
  const [rows] = await JobCard.aggregate([
    { $match: { dateIn: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: null,
        jobs: { $sum: 1 },
        billed: { $sum: '$totals.grand' },
        paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totals.grand', 0] } },
        paidJobs: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
        parts: { $sum: '$totals.parts' },
        services: { $sum: '$totals.services' },
        labour: { $sum: '$totals.labour' },
        completed: {
          $sum: { $cond: [{ $in: ['$status', ['completed', 'released']] }, 1, 0] },
        },
      },
    },
  ]);
  return (
    rows || { jobs: 0, billed: 0, paid: 0, paidJobs: 0, parts: 0, services: 0, labour: 0, completed: 0 }
  );
}

/** GET /api/reports?month=YYYY-MM — monthly report for the bay. */
router.get(
  '/',
  ah(async (req, res) => {
    const now = new Date();
    const month =
      req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { start, end } = monthRange(month);

    const prevStart = new Date(start);
    prevStart.setMonth(prevStart.getMonth() - 1);
    const prevEnd = new Date(start);

    const [summary, previous, daily, partsSold, servicesSold, techRows] = await Promise.all([
      summaryFor(start, end),
      summaryFor(prevStart, prevEnd),
      JobCard.aggregate([
        { $match: { dateIn: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateIn' } },
            billed: { $sum: '$totals.grand' },
            paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$totals.grand', 0] } },
            jobs: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // parts sold, best sellers first
      JobCard.aggregate([
        { $match: { dateIn: { $gte: start, $lt: end }, 'parts.0': { $exists: true } } },
        { $unwind: '$parts' },
        {
          $group: {
            _id: '$parts.name',
            qty: { $sum: '$parts.quantity' },
            revenue: { $sum: { $multiply: ['$parts.price', '$parts.quantity'] } },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: 10 },
      ]),
      // services sold
      JobCard.aggregate([
        { $match: { dateIn: { $gte: start, $lt: end }, 'services.0': { $exists: true } } },
        { $unwind: '$services' },
        {
          $group: {
            _id: '$services.name',
            count: { $sum: 1 },
            revenue: { $sum: '$services.price' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      // jobs handled per technician
      JobCard.aggregate([
        { $match: { dateIn: { $gte: start, $lt: end }, technicians: { $ne: [] } } },
        { $unwind: '$technicians' },
        { $group: { _id: '$technicians', jobs: { $sum: 1 } } },
        { $sort: { jobs: -1 } },
      ]),
    ]);

    const techDocs = techRows.length
      ? await Technician.find({ _id: { $in: techRows.map((r) => r._id) } })
      : [];
    const names = Object.fromEntries(techDocs.map((t) => [String(t._id), t.name]));
    const byTechnician = techRows.map((row) => ({
      name: names[String(row._id)] || 'Unknown',
      jobs: row.jobs,
    }));

    const deltaPct = previous.paid > 0 ? ((summary.paid - previous.paid) / previous.paid) * 100 : null;

    res.json({
      month,
      summary,
      previous: { paid: previous.paid, jobs: previous.jobs },
      deltaPct,
      daily: daily.map((d) => ({ date: d._id, billed: d.billed, paid: d.paid, jobs: d.jobs })),
      partsSold: partsSold.map((p) => ({ name: p._id, qty: p.qty, revenue: p.revenue })),
      servicesSold: servicesSold.map((s) => ({ name: s._id, count: s.count, revenue: s.revenue })),
      byTechnician,
    });
  })
);

export default router;
