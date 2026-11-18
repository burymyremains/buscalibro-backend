import { Router } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });

// La sesión dura 180 días: el usuario no tiene que volver a entrar mientras no cierre sesión
const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '180d' });

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Registro público: SIEMPRE crea usuarios lectores. Los administradores solo se crean con "npm run seed".
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nombre, email y contraseña son obligatorios' });
  }
  if (!EMAIL_RX.test(String(email))) return res.status(400).json({ message: 'Email no válido' });
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const user = await User.create({
    name: String(name),
    email: String(email),
    password: String(password),
    role: 'user',
  });
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

// "role" es lo que el usuario eligió en la pantalla de inicio (administrador o usuario)
router.post('/login', async (req, res) => {
  const { email, password, role } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
  }

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+password');
  // Mismo mensaje si el usuario no existe o la contraseña falla (no revelar cuál)
  if (!user || !(await user.comparePassword(String(password)))) {
    return res.status(401).json({ message: 'Email o contraseña incorrectos' });
  }

  if (role === 'admin' && user.role !== 'admin') {
    return res.status(403).json({ message: 'Esta cuenta no tiene permisos de administrador' });
  }
  if (role === 'user' && user.role === 'admin') {
    return res.status(403).json({ message: 'Esta cuenta es de administrador. Vuelve atrás y elige "Administrador"' });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

// La app lo usa al abrirse para comprobar que el token guardado siga siendo válido
router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: 'Usuario no encontrado' });
  res.json({ user: publicUser(user) });
});

export default router;
