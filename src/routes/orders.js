import { Router } from 'express';
import mongoose from 'mongoose';
import Book from '../models/Book.js';
import Order from '../models/Order.js';
import { requireAuth, requireUser } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireUser);

const LOAN_DAYS = 14;
const MAX_ACTIVE_LOANS = 3;

const fail = (status, message) => Object.assign(new Error(message), { status });

// Pedir prestado o comprar un libro
router.post('/', async (req, res) => {
  const { bookId, type } = req.body || {};
  if (!mongoose.isValidObjectId(bookId)) throw fail(400, 'Libro inválido');
  if (!['loan', 'purchase'].includes(type)) throw fail(400, 'Tipo inválido (loan o purchase)');

  if (type === 'loan') {
    if (await Order.exists({ user: req.user.id, book: bookId, type: 'loan', status: 'active' })) {
      throw fail(409, 'Ya tienes este libro en préstamo');
    }
    const active = await Order.countDocuments({ user: req.user.id, type: 'loan', status: 'active' });
    if (active >= MAX_ACTIVE_LOANS) {
      throw fail(409, `Solo puedes tener ${MAX_ACTIVE_LOANS} préstamos activos. Devuelve uno primero.`);
    }
  }

  // Descuento atómico: solo si todavía hay existencias (evita vender de más si dos usuarios piden a la vez)
  const book = await Book.findOneAndUpdate({ _id: bookId, stock: { $gt: 0 } }, { $inc: { stock: -1 } }, { new: true });
  if (!book) {
    const exists = await Book.exists({ _id: bookId });
    throw fail(exists ? 409 : 404, exists ? 'Sin existencias por el momento' : 'Libro no encontrado');
  }

  try {
    const order = await Order.create({
      user: req.user.id,
      book: book._id,
      bookTitle: book.title,
      bookAuthor: book.author,
      type,
      status: type === 'loan' ? 'active' : 'completed',
      price: type === 'purchase' ? book.price : 0,
      dueDate: type === 'loan' ? new Date(Date.now() + LOAN_DAYS * 24 * 60 * 60 * 1000) : undefined,
    });
    res.status(201).json(order);
  } catch (err) {
    await Book.updateOne({ _id: book._id }, { $inc: { stock: 1 } }); // devolver la existencia si algo falló
    throw err;
  }
});

// Historial del usuario (préstamos y compras)
router.get('/mine', async (req, res) => {
  res.json(await Order.find({ user: req.user.id }).sort({ createdAt: -1 }));
});

// Devolver un libro prestado
router.post('/:id/return', async (req, res) => {
  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, user: req.user.id, type: 'loan', status: 'active' },
    { status: 'returned', returnedAt: new Date() },
    { new: true }
  );
  if (!order) throw fail(404, 'Préstamo activo no encontrado');
  await Book.updateOne({ _id: order.book }, { $inc: { stock: 1 } });
  res.json(order);
});

export default router;
