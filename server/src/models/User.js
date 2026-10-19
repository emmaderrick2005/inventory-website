import mongoose from 'mongoose';

export const USER_ROLES = ['admin', 'senior', 'reception'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: 'reception' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** Never expose the password hash to clients. */
userSchema.methods.toSafe = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    active: this.active,
    createdAt: this.createdAt,
  };
};

export default mongoose.model('User', userSchema);
