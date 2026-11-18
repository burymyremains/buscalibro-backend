import 'dotenv/config';
import mongoose from 'mongoose';
import User from './models/User.js';

const { MONGO_URI, ADMIN_EMAIL = 'admin@buscalibroo.com', ADMIN_PASSWORD = 'Admin1234' } = process.env;
if (!MONGO_URI) {
  console.error('Falta MONGO_URI en .env');
  process.exit(1);
}

await mongoose.connect(MONGO_URI);

// Crear Admin si no existe
const email = ADMIN_EMAIL.toLowerCase();
if (!(await User.findOne({ email }))) {
  await User.create({ name: 'Administrador BuscaLibroo', email, password: ADMIN_PASSWORD, role: 'admin' });
}

// Colecciones directas para catálogo enriquecido y autores
const db = mongoose.connection.db;
await db.collection('store_authors').deleteMany({});
await db.collection('store_books').deleteMany({});

await db.collection('store_authors').insertMany([
  {
    id: 'auth-1',
    name: 'Gabriel García Márquez',
    avatarKey: 'authors/marquez.jpg',
    followersCount: 1840,
    popular: true,
    bio: 'Escritor y periodista colombiano, Premio Nobel de Literatura 1982 y referente mundial del realismo mágico.',
    upcomingReleases: [
      { id: 'up-1', title: 'En agosto nos vemos (Edición Aniversario)', expectedDate: 'Diciembre 2026', genre: 'Novela' },
    ],
  },
  {
    id: 'auth-2',
    name: 'Juan Rulfo',
    avatarKey: 'authors/rulfo.jpg',
    followersCount: 1320,
    popular: true,
    bio: 'Escritor, guionista y fotógrafo mexicano cuya obra retrata con maestría poética el México rural.',
    upcomingReleases: [
      { id: 'up-2', title: 'El Llano en llamas (Edición Ilustrada)', expectedDate: 'Febrero 2027', genre: 'Cuento' },
    ],
  },
  {
    id: 'auth-3',
    name: 'Carlos Ruiz Zafón',
    avatarKey: 'authors/zafon.jpg',
    followersCount: 1650,
    popular: true,
    bio: 'Autor español creador de la tetralogía "El Cementerio de los Libros Olvidados", traducida a más de 40 idiomas.',
    upcomingReleases: [],
  },
  {
    id: 'auth-4',
    name: 'Antoine de Saint-Exupéry',
    avatarKey: 'authors/saint-exupery.jpg',
    followersCount: 2100,
    popular: true,
    bio: 'Aviador y escritor francés, autor de una de las obras más leídas y traducidas de la historia.',
    upcomingReleases: [],
  },
  {
    id: 'auth-5',
    name: 'George Orwell',
    avatarKey: 'authors/orwell.jpg',
    followersCount: 1590,
    popular: false,
    bio: 'Novelista, ensayista y periodista británico célebre por sus distopías críticas sobre el poder y la sociedad.',
    upcomingReleases: [],
  },
]);

await db.collection('store_books').insertMany([
  {
    id: 'book-1',
    title: 'Cien años de soledad',
    authorId: 'auth-1',
    authorName: 'Gabriel García Márquez',
    genre: 'Realismo Mágico',
    price: 389,
    discountPercent: 20,
    badge: 'Oferta',
    coverKey: 'covers/cien-anos.jpg',
    coverTint: '#F3D1DC',
    stock: 15,
    recommended: true,
    bestseller: true,
    isNewRelease: false,
    description: 'La historia de siete generaciones de la familia Buendía en el mítico pueblo de Macondo.',
  },
  {
    id: 'book-2',
    title: 'La sombra del viento',
    authorId: 'auth-3',
    authorName: 'Carlos Ruiz Zafón',
    genre: 'Misterio',
    price: 420,
    discountPercent: 15,
    badge: 'Promoción',
    coverKey: 'covers/sombra-viento.jpg',
    coverTint: '#FADADD',
    stock: 10,
    recommended: true,
    bestseller: true,
    isNewRelease: false,
    description: 'En la Barcelona de 1945, el joven Daniel Sempere rescata un libro maldito que cambiará su destino.',
  },
  {
    id: 'book-3',
    title: 'El principito (Edición Tapa Dura)',
    authorId: 'auth-4',
    authorName: 'Antoine de Saint-Exupéry',
    genre: 'Clásicos',
    price: 260,
    discountPercent: 0,
    badge: 'Nuevo',
    coverKey: 'covers/principito.jpg',
    coverTint: '#E8DFF5',
    stock: 20,
    recommended: true,
    bestseller: true,
    isNewRelease: true,
    description: 'Un piloto varado en el desierto del Sahara conoce a un pequeño príncipe proveniente de otro asteroide.',
  },
  {
    id: 'book-4',
    title: 'Pedro Páramo',
    authorId: 'auth-2',
    authorName: 'Juan Rulfo',
    genre: 'Realismo Mágico',
    price: 245,
    discountPercent: 10,
    badge: 'Oferta',
    coverKey: 'covers/pedro-paramo.jpg',
    coverTint: '#FCE1E4',
    stock: 14,
    recommended: false,
    bestseller: true,
    isNewRelease: false,
    description: 'Juan Preciado llega al pueblo fantasma de Comala en busca de su padre, Pedro Páramo.',
  },
  {
    id: 'book-5',
    title: '1984',
    authorId: 'auth-5',
    authorName: 'George Orwell',
    genre: 'Ciencia Ficción',
    price: 310,
    discountPercent: 25,
    badge: 'Oferta',
    coverKey: 'covers/1984.jpg',
    coverTint: '#FFD6E0',
    stock: 11,
    recommended: true,
    bestseller: false,
    isNewRelease: false,
    description: 'En una sociedad vigilada por el Gran Hermano, Winston Smith lucha por conservar su libertad de pensamiento.',
  },
  {
    id: 'book-6',
    title: 'El amor en los tiempos del cólera',
    authorId: 'auth-1',
    authorName: 'Gabriel García Márquez',
    genre: 'Romance',
    price: 395,
    discountPercent: 0,
    badge: 'Nuevo',
    coverKey: 'covers/rayuela.jpg',
    coverTint: '#FDE2E4',
    stock: 9,
    recommended: false,
    bestseller: false,
    isNewRelease: true,
    description: 'Una historia de amor perseverante que atraviesa más de medio siglo en el Caribe.',
  },
]);

console.log('Catálogo real y autores cargados en MongoDB.');
await mongoose.disconnect();