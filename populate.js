var Species = require('./species');
var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/pogo1');
Species.remove({}, function(err){
  var bulbasaur = new Species();
  bulbasaur.name = "Bulbasaur";
  bulbasaur.rarity = "0.1";
  bulbasaur.difficulty = "0.1";
  bulbasaur.lifetime = "4000";
  bulbasaur.save();

  var squirtle = new Species();
  squirtle.name = "Squirtle";
  squirtle.rarity = "0.1";
  squirtle.difficulty = "0.1";
  squirtle.lifetime = "4000";
  squirtle.save();

  var charmander = new Species();
  charmander.name = "Charmander";
  charmander.rarity = "0.1";
  charmander.difficulty = "0.1";
  charmander.lifetime = "4000";
  charmander.save();
});
