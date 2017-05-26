const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  username: String,
  auth_zero_id: String,
  mons: [{type: mongoose.Schema.Types.ObjectId, ref: 'Mon'}],
  team: String,
  items: {type: Number, default: 0}
});

var User = mongoose.model('User', userSchema);

module.exports = User;
