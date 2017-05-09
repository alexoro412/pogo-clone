const mongoose = require('mongoose');

const monSchema = mongoose.Schema({
  name: String,
  attack: Number,
  species: mongoose.Schema.Types.ObjectId
});

var Mon = mongoose.model('Mon', monSchema);

module.exports = Mon;
