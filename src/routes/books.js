import { Router } from 'express';
import mongoose from 'mongoose';
import Book from '../models/Book.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth); // leer: cualquier sesión. Escribir: solo admin (abajo)

// Solo se aceptan estos campos (evita que el cliente escriba otros)
const FIELDS = ['title', 'author', 'isbn', 'category', 'stock', 'price'];
const pick = (body = {}) =>
  Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// READ: lista. Filtros: ?q=texto  &field=all|title|author  &category=<id del género>
router.get('/', async (req, res) => {
  const { q, field = 'all', category } = req.query;
  const filter = {};

  if (category) {
    if (!mongoose.isValidObjectId(category)) return res.status(400).json({ message: 'Género inválido' });
    filter.category = category;
  }
  if (q) {
    const rx = new RegExp(escapeRegex(String(q)), 'i');
    if (field === 'title') filter.title = rx;
    else if (field === 'author') filter.author = rx;
    else filter.$or = [{ title: rx }, { author: rx }, { isbn: rx }];
  }

  res.json(await Book.find(filter).populate('category', 'name').sort({ title: 1 }));
});

router.get('/:id', async (req, res) => {
  const book = await Book.findById(req.params.id).populate('category', 'name');
  if (!book) return res.status(404).json({ message: 'Libro no encontrado' });
  res.json(book);
});

async function assertCategory(id) {
  if (!mongoose.isValidObjectId(id) || !(await Category.exists({ _id: id }))) {
    const err = new Error('Elige un género válido');
    err.status = 400;
    throw err;
  }
}

router.post('/', requireAdmin, async (req, res) => {
  const data = pick(req.body);
  await assertCategory(data.category);
  const book = await Book.create(data);
  res.status(201).json(await book.populate('category', 'name'));
});

router.put('/:id', requireAdmin, async (req, res) => {
  const data = pick(req.body);
  if (data.category !== undefined) await assertCategory(data.category);
  const book = await Book.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true }).populate(
    'category',
    'name'
  );
  if (!book) return res.status(404).json({ message: 'Libro no encontrado' });
  res.json(book);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  if (await Order.exists({ book: req.params.id, type: 'loan', status: 'active' })) {
    return res.status(409).json({ message: 'No se puede eliminar: tiene préstamos activos' });
  }
  const book = await Book.findByIdAndDelete(req.params.id);
  if (!book) return res.status(404).json({ message: 'Libro no encontrado' });
  res.json({ message: 'Libro eliminado', id: book.id });
});

export default router;
