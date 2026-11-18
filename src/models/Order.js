import mongoose from 'mongoose';

// Un "movimiento" del usuario: préstamo o compra.
// Guardamos título y autor como copia, para que el historial no se rompa si el admin borra el libro.
const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    bookTitle: { type: String, required: true },
    bookAuthor: { type: String, required: true },
    type: { type: String, enum: ['loan', 'purchase'], required: true },
    status: { type: String, enum: ['active', 'returned', 'completed'], required: true },
    price: { type: Number, default: 0 }, // precio pagado (solo compras)
    dueDate: { type: Date }, // fecha límite de devolución (solo préstamos)
    returnedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Order', orderSchema);
