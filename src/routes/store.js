import { Router } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';
import { sendExpoPush } from '../utils/pushService.js';

const router = Router();
const db = () => mongoose.connection.db;

// Login / Auto-registro rápido para usuarios de la app móvil
router.post('/auth/mobile-login', async (req, res) => {
  const { email, username } = req.body || {};
  if (!email) return res.status(400).json({ message: 'Email requerido' });

  const cleanEmail = String(email).toLowerCase().trim();
  const col = db().collection('mobile_users');
  let user = await col.findOne({ email: cleanEmail });

  if (!user) {
    const newUser = {
      id: `user-${Date.now()}`,
      email: cleanEmail,
      username: username || cleanEmail.split('@')[0],
      bio: '',
      avatarKey: 'avatars/default-1.png',
      registeredAt: new Date().toISOString().split('T')[0],
      favorites: [],
      followedAuthors: [],
      cart: [],
      notifications: [],
      notificationPrefs: { enabled: true, favoriteDiscounts: true, orderUpdates: true },
    };
    await col.insertOne(newUser);
    user = newUser;
  }

  const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '180d' });
  res.json({ token, profile: { ...user, isAuthenticated: true } });
});

// Catálogo público y autores
router.get('/books', async (_req, res) => {
  const books = await db().collection('store_books').find({}).toArray();
  res.json(books);
});

router.get('/authors', async (_req, res) => {
  const authors = await db().collection('store_authors').find({}).toArray();
  res.json(authors);
});

// Perfil del usuario autenticado
router.get('/me/profile', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  if (!user) return res.status(404).json({ message: 'No encontrado' });
  res.json({ ...user, isAuthenticated: true });
});

router.patch('/me/profile', requireAuth, async (req, res) => {
  const { username, email, bio, avatarKey } = req.body || {};
  const updates = {};
  if (username !== undefined) updates.username = username;
  if (email !== undefined) updates.email = email;
  if (bio !== undefined) updates.bio = bio;
  if (avatarKey !== undefined) updates.avatarKey = avatarKey;

  await db().collection('mobile_users').updateOne({ id: req.user.id }, { $set: updates });
  const updated = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json({ ...updated, isAuthenticated: true });
});

// Favoritos
router.get('/me/favorites', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.favorites || []);
});

router.post('/me/favorites/:bookId', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  const current = user?.favorites || [];
  const { bookId } = req.params;
  const updated = current.includes(bookId) ? current.filter((id) => id !== bookId) : [...current, bookId];
  await db().collection('mobile_users').updateOne({ id: req.user.id }, { $set: { favorites: updated } });
  res.json(updated);
});

// Autores seguidos
router.get('/me/following-authors', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.followedAuthors || []);
});

router.post('/me/following-authors/:authorId', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  const current = user?.followedAuthors || [];
  const { authorId } = req.params;
  const updated = current.includes(authorId) ? current.filter((id) => id !== authorId) : [...current, authorId];
  await db().collection('mobile_users').updateOne({ id: req.user.id }, { $set: { followedAuthors: updated } });
  res.json(updated);
});

// Carrito
router.get('/me/cart', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.cart || []);
});

router.put('/me/cart', requireAuth, async (req, res) => {
  const items = req.body?.items || [];
  await db().collection('mobile_users').updateOne({ id: req.user.id }, { $set: { cart: items } });
  res.json(items);
});

// Reseñas
router.get('/reviews', async (_req, res) => {
  const reviews = await db().collection('store_reviews').find({}).sort({ _id: -1 }).toArray();
  res.json(reviews);
});

router.post('/reviews', requireAuth, async (req, res) => {
  const doc = {
    id: `rev-${Date.now()}`,
    ...req.body,
    userId: req.user.id,
    createdAt: new Date().toISOString().split('T')[0],
  };
  await db().collection('store_reviews').insertOne(doc);
  const all = await db().collection('store_reviews').find({}).sort({ _id: -1 }).toArray();
  res.json(all);
});

router.put('/reviews/:id', requireAuth, async (req, res) => {
  await db().collection('store_reviews').updateOne(
    { id: req.params.id, userId: req.user.id },
    { $set: { rating: req.body.rating, comment: req.body.comment, editedAt: new Date().toISOString().split('T')[0] } }
  );
  const all = await db().collection('store_reviews').find({}).sort({ _id: -1 }).toArray();
  res.json(all);
});

router.delete('/reviews/:id', requireAuth, async (req, res) => {
  await db().collection('store_reviews').deleteOne({ id: req.params.id, userId: req.user.id });
  const all = await db().collection('store_reviews').find({}).sort({ _id: -1 }).toArray();
  res.json(all);
});

// Compras y rastreo
router.get('/me/orders', requireAuth, async (req, res) => {
  const orders = await db().collection('store_orders').find({ userId: req.user.id }).sort({ _id: -1 }).toArray();
  res.json(orders);
});

router.post('/me/orders', requireAuth, async (req, res) => {
  const now = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const order = {
    id: `ORD-${Math.floor(100000 + Math.random() * 900000)}`,
    userId: req.user.id,
    createdAt: now,
    status: 'Pendiente',
    statusHistory: [{ status: 'Pendiente', timestamp: now }],
    ...req.body,
  };
  await db().collection('store_orders').insertOne(order);
  await db().collection('mobile_users').updateOne({ id: req.user.id }, { $set: { cart: [] } });
  res.json(order);
});

router.patch('/me/orders/:id/status', requireAuth, async (req, res) => {
  const flow = ['Pendiente', 'Procesando', 'Enviado', 'Entregado'];
  const order = await db().collection('store_orders').findOne({ id: req.params.id, userId: req.user.id });
  if (!order) return res.status(404).json({ message: 'Pedido no encontrado' });

  const idx = flow.indexOf(order.status);
  let changedOrder = null;
  if (idx !== -1 && idx < flow.length - 1) {
    const nextStatus = flow[idx + 1];
    const timestamp = new Date().toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    await db().collection('store_orders').updateOne(
      { id: order.id },
      { $set: { status: nextStatus }, $push: { statusHistory: { status: nextStatus, timestamp } } }
    );
    changedOrder = await db().collection('store_orders').findOne({ id: order.id });
  }
  const orders = await db().collection('store_orders').find({ userId: req.user.id }).sort({ _id: -1 }).toArray();
  res.json({ orders, changedOrder });
});

// Notificaciones y preferencias
router.get('/me/notifications', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.notifications || []);
});

router.post('/me/notifications', requireAuth, async (req, res) => {
  const item = { id: `notif-${Date.now()}`, read: false, createdAt: 'Ahora mismo', ...req.body };
  await db().collection('mobile_users').updateOne(
    { id: req.user.id },
    { $push: { notifications: { $each: [item], $position: 0 } } }
  );
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.notifications || []);
});

router.patch('/me/notifications/:id/read', requireAuth, async (req, res) => {
  await db().collection('mobile_users').updateOne(
    { id: req.user.id, 'notifications.id': req.params.id },
    { $set: { 'notifications.$.read': true } }
  );
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.notifications || []);
});

router.patch('/me/notifications/read-all', requireAuth, async (req, res) => {
  await db().collection('mobile_users').updateOne(
    { id: req.user.id },
    { $set: { 'notifications.$[].read': true } }
  );
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.notifications || []);
});

router.get('/me/notification-prefs', requireAuth, async (req, res) => {
  const user = await db().collection('mobile_users').findOne({ id: req.user.id });
  res.json(user?.notificationPrefs || { enabled: true });
});

router.put('/me/notification-prefs', requireAuth, async (req, res) => {
  await db().collection('mobile_users').updateOne(
    { id: req.user.id },
    { $set: { notificationPrefs: req.body } }
  );
  res.json(req.body);
});

function extractUserFromToken(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

function buildUserFilter(decoded) {
  const filters = [];
  if (decoded?.email) filters.push({ email: decoded.email });
  if (decoded?.id) filters.push({ id: decoded.id });
  if (decoded?.userId) filters.push({ id: decoded.userId });
  const rawId = decoded?.userId || decoded?.id || decoded?._id;
  if (rawId && mongoose.Types.ObjectId.isValid(rawId)) {
    filters.push({ _id: new mongoose.Types.ObjectId(rawId) });
  }
  return filters.length ? { $or: filters } : null;
}

// 1. Guardar token Push del celular del usuario
router.patch('/me/push-token', async (req, res) => {
  try {
    const decoded = extractUserFromToken(req);
    const filter = buildUserFilter(decoded);
    const { pushToken } = req.body;
    if (!filter || !pushToken) return res.status(400).json({ message: 'Datos incompletos' });

    await mongoose.connection
      .collection('mobile_users')
      .updateOne(filter, { $set: { expoPushToken: pushToken } });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. Consultar datos automáticos por código de barras ISBN (Google Books + OpenLibrary)
router.get('/isbn/:code', async (req, res) => {
  const isbn = String(req.params.code || '').replace(/[^0-9Xx]/g, '');
  if (!isbn) return res.status(400).json({ message: 'ISBN inválido' });

  try {
    const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const gbData = await gbRes.json();
    const info = gbData?.items?.[0]?.volumeInfo;

    if (info) {
      return res.json({
        found: true,
        title: info.title || '',
        authorName: info.authors?.[0] || 'Autor desconocido',
        genre: info.categories?.[0] || 'General',
        description: info.description || `Edición ISBN ${isbn}.`,
        coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') || '',
        pageCount: info.pageCount || 200,
      });
    }

    const olRes = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const olData = await olRes.json();
    const book = olData[`ISBN:${isbn}`];

    if (book) {
      return res.json({
        found: true,
        title: book.title || '',
        authorName: book.authors?.[0]?.name || 'Autor desconocido',
        genre: book.subjects?.[0]?.name || 'General',
        description: book.notes || `Obra registrada con ISBN ${isbn}.`,
        coverUrl: book.cover?.large || book.cover?.medium || '',
        pageCount: book.number_of_pages || 200,
      });
    }

    res.json({ found: false });
  } catch (err) {
    res.status(500).json({ message: 'Error consultando ISBN' });
  }
});

// 3. Publicar un libro nuevo en el catálogo + enviar Push a todos los usuarios
router.post('/books', async (req, res) => {
  try {
    const {
      title,
      authorName,
      genre,
      price,
      discountPercent = 0,
      description,
      coverKey,
      stock = 10,
    } = req.body;

    if (!title || !authorName || !price) {
      return res.status(400).json({ message: 'Título, autor y precio son obligatorios' });
    }

    const newBook = {
      id: `book-${Date.now()}`,
      title: title.trim(),
      authorId: 'auth-community',
      authorName: authorName.trim(),
      genre: (genre || 'Literatura').trim(),
      price: Number(price),
      discountPercent: Number(discountPercent || 0),
      badge: Number(discountPercent) > 0 ? 'Oferta' : 'Nuevo',
      coverKey: coverKey || 'covers/cien-anos.jpg',
      coverTint: '#FADADD',
      stock: Number(stock),
      recommended: true,
      bestseller: false,
      isNewRelease: true,
      description: (description || 'Publicado en el catálogo de BuscaLibroo.').trim(),
      createdAt: new Date(),
    };

    await mongoose.connection.collection('store_books').insertOne(newBook);

    // Notificación Push masiva a usuarios con token registrado
    const users = await mongoose.connection
      .collection('mobile_users')
      .find({ expoPushToken: { $exists: true, $ne: '' } })
      .toArray();

    const tokens = users.map((u) => u.expoPushToken);
    await sendExpoPush(tokens, {
      title: '📚 ¡Nuevo lanzamiento en BuscaLibroo!',
      body: `"${newBook.title}" de ${newBook.authorName} ya está disponible.`,
      data: { bookId: newBook.id },
    });

    res.status(201).json(newBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Actualizar progreso de lectura en un pedido entregado
router.patch('/me/orders/:orderId/progress', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { bookId, currentPage, totalPages } = req.body;

    const query = mongoose.Types.ObjectId.isValid(orderId)
      ? { $or: [{ id: orderId }, { _id: new mongoose.Types.ObjectId(orderId) }] }
      : { id: orderId };

    await mongoose.connection.collection('store_orders').updateOne(query, {
      $set: {
        [`readingProgress.${bookId}`]: {
          currentPage: Number(currentPage || 0),
          totalPages: Math.max(1, Number(totalPages || 100)),
          updatedAt: new Date().toISOString(),
        },
      },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;