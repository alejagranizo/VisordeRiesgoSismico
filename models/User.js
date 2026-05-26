const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  usuario:       { type: String, unique: true, required: true },
  password:      { type: String, required: true },
  email:         { type: String, unique: true, required: true },
  name:          { type: String },
  lastName:      { type: String },
  institution:   { type: String },
  status:        { type: String, enum: ['pending','active','rejected'], default: 'pending' },
  emailVerified: { type: Boolean, default: false },
  emailToken:    { type: String },
  approvalToken: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);