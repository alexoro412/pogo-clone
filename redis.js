var redis = require('redis'),
  client = redis.createClient();
var timestamp = require('unix-timestamp');

client.on("error", function(err) {
  console.log("Redis error: ", err);
});

function unixTimeStamp() {
  return Math.floor(timestamp.now());
}

function spawnPokemon(nameAndId, lat, lng, expiration) {
  let time = unixTimeStamp();
  client.multi()
    .geoadd('Pokemon', lng, lat, nameAndId)
    .zadd('pokeExpire', time + expiration, nameAndId)
    .exec(redis.print);
}

function despawnExpiredPokemon() {
  let time = unixTimeStamp();
  client.zrangebyscore('pokeExpire', 0, time, function(err, res) {
    if (res.length > 0) {
      client.multi()
        .zremrangebyscore('pokeExpire', 0, time)
        .zrem('Pokemon', res).exec(function(err, replies) {
          console.log(replies);
        });
    }
  });
}

function pokemonExists(nameAndId, cb){
  // TODO
  // maybe use GEOPOS to check if it exists?
  // or query the sorted set?
}

function despawnPokemon(nameAndId) {
  client.multi()
		.zrem('pokeExpire', nameAndId)
		.zrem('Pokemon', nameAndId)
		.exec(redis.print);
}

function pokemonWithinRadius(lat, lng, radius, cb) {
  client.georadius('Pokemon', lng, lat, radius, 'km', 'WITHCOORD', function(err, replies) {
	  let pokemon = [];
    replies.forEach(function(reply, i) {
      let p = {};
      p.name = reply[0];
      p.lat = reply[1][1];
      p.lng = reply[1][0];
      pokemon.push(p);
    });
    cb(pokemon);
  });
}

function allPokemon(cb){
  // Searches the entire world, basically...
  client.georadius('Pokemon', 0, 0, 22000, 'km', 'WITHCOORD', function(err, replies){
    if(err) throw err;
    let pokemon = [];
    replies.forEach(function(reply, i) {
      let p = {};
      p.name = reply[0];
      p.lat = reply[1][1];
      p.lng = reply[1][0];
      pokemon.push(p);
    });
    cb(pokemon);
  })
};



// pokemonWithinRadius(10, 10, 3, console.log);

module.exports = {
  spawnPokemon: spawnPokemon,
  despawnExpiredPokemon: despawnExpiredPokemon,
  pokemonWithinRadius: pokemonWithinRadius,
  unixTimeStamp: unixTimeStamp,
	despawnPokemon: despawnPokemon,
  allPokemon: allPokemon
}
