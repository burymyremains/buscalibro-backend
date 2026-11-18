import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'El título es obligatorio'], trim: true },
    author: { type: String, required: [true, 'El autor es obligatorio'], trim: true },
    isbn: { type: String, required: [true, 'El ISBN es obligatorio'], unique: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: [true, 'El género es obligatorio'] },
    stock: { type: Number, required: true, min: [0, 'El stock no puede ser negativo'], default: 1 },
    price: { type: Number, required: true, min: [0, 'El precio no puede ser negativo'], default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Book', bookSchema);
