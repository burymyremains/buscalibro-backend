import { Router } from 'express';
import Category from '../models/Category.js';
import Book from '../models/Book.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const pick = (body = {}) =>
  Object.fromEntries(['name', 'description'].filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

// READ: cualquier sesión (los usuarios la necesitan para filtrar por género). Incluye cuántos libros tiene cada una.
router.get('/', async (_req, res) => {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Book.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
  ]);
  const byId = new Map(counts.map((c) => [String(c._id), c.count]));
  res.json(categories.map((c) => ({ ...c, bookCount: byId.get(String(c._id)) || 0 })));
});

// CREATE / UPDATE / DELETE: solo administrador
router.post('/', requireAdmin, async (req, res) => {
  res.status(201).json(await Category.create(pick(req.body)));
});

router.put('/:id', requireAdmin, async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, pick(req.body), {
    new: true,
    runValidators: true,
  });
  if (!category) return res.status(404).json({ message: 'Género no encontrado' });
  res.json(category);
});

router.delete('/:id', requireAdmin, async (req, res) => {
  if (await Book.exists({ category: req.params.id })) {
    return res.status(409).json({ message: 'No se puede eliminar: hay libros con este género. Cámbialos primero.' });
  }
  const category = await Category.findByIdAndDelete(req.params.id);
  if (!category) return res.status(404).json({ message: 'Género no encontrado' });
  res.json({ message: 'Género eliminado', id: category.id });
});

export default router;
