import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No autenticado' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

export const requireRole = (role, message) => (req, res, next) => {
  if (req.user?.role !== role) return res.status(403).json({ message });
  next();
};

export const requireAdmin = requireRole('admin', 'Solo administradores');
export const requireUser = requireRole('user', 'Solo usuarios lectores');
