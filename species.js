const mongoose = require('mongoose');

const speciesSchema = mongoose.Schema({
  name: String,
  rarity: Number,
  difficulty: Number,
  lifetime: Number
});

var Species = mongoose.model('Species', speciesSchema);

module.exports = Species;
