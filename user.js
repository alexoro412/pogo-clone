const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  username: String,
  auth_zero_id: String,
  mons: [mongoose.Schema.Types.ObjectId],
  team: String
});

var User = mongoose.model('User', userSchema);

module.exports = User;
