import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import categoryRoutes from './routes/categories.js';
import orderRoutes from './routes/orders.js';
import storeRoutes from './routes/store.js';

const { PORT = 3000, MONGO_URI, JWT_SECRET } = process.env;
if (!MONGO_URI || !JWT_SECRET) {
  console.error('Faltan MONGO_URI o JWT_SECRET (archivo .env o variables de entorno)');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/store', storeRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});
const DUPLICATES = { isbn: 'Ya existe un libro con ese ISBN', email: 'Ya existe una cuenta con ese email', name: 'Ya existe un género con ese nombre' };

// Manejo central de errores: convierte errores de Mongoose en respuestas claras
app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join('. ');
    return res.status(400).json({ message });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'Dato inválido' });
  if (err.code === 11000) {
    // MongoDB manda keyPattern/keyValue; si no vienen, se deduce del texto del error ("index: isbn_1 ...")
    const msg = String(err.message);
    const key =
      Object.keys(err.keyPattern || err.keyValue || {})[0] ||
      (msg.match(/index: (\w+?)_\d/) || [])[1] ||
      ({ books: 'isbn', users: 'email', categories: 'name' })[(msg.match(/collection: [\w-]+\.(\w+)/) || [])[1]];
    return res.status(409).json({ message: DUPLICATES[key] || 'Ya existe un registro con esos datos' });
  }
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON inválido' });
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

try {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB conectado');
  // 0.0.0.0 para aceptar conexiones externas (Render, celular en la misma red, etc.)
  app.listen(PORT, '0.0.0.0', () => console.log(`API lista en el puerto ${PORT}`));
} catch (err) {
  console.error('No se pudo conectar a MongoDB. Revisa MONGO_URI (y en Atlas: usuario, contraseña y Network Access).');
  console.error(err.message);
  process.exit(1);
}
