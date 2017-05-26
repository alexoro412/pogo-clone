var redis = require('redis'),
  client = redis.createClient();
var timestamp = require('unix-timestamp');
var EventEmitter = require('events');
var redisEmitter = new EventEmitter();
var shortid = require('shortid');

client.on("error", function(err) {
  console.log("Redis error: ", err);
});

// Unix Time Stamps are used for keeping track of expiration
function unixTimeStamp() {
  return Math.floor(timestamp.now());
}

function spawnPokemon(nameAndId, lat, lng, expiration) {
  let time = unixTimeStamp();
  client.multi()
    .geoadd('Pokemon', lng, lat, nameAndId)
    .zadd('pokeExpire', time + expiration, nameAndId)
    .exec(function(err, replies){
      redisEmitter.emit('spawn poke', nameAndId, lat, lng);
    });
}

function despawnExpiredPokemon() {
  let time = unixTimeStamp();
  client.zrangebyscore('pokeExpire', 0, time, function(err, res) {
    if (res.length > 0) {
      res.forEach(function(element){
          redisEmitter.emit('despawn pokemon', element);
      });
      client.multi()
        .zremrangebyscore('pokeExpire', 0, time)
        .zrem('Pokemon', res).exec(function(err, replies) {

        });
    }
  });
}

function despawnPokemon(nameAndId, cb) {
  client.multi()
		.zrem('pokeExpire', nameAndId)
		.zrem('Pokemon', nameAndId)
		.exec(function(err, res){
      //TODO find users within range and notify them?
      redisEmitter.emit('despawn pokemon', nameAndId);
      cb(res[0] == 1);
    });
}

function pokemonWithinRadius(lat, lng, radius, cb) {
  client.georadius('Pokemon', lng, lat, radius, 'm', 'WITHCOORD', function(err, replies) {
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

function moveUser(user_id, lat, lng){
  // Adding and moving a user are the same thing
  client.geoadd('Pokemon', lng, lat, 'user:' + user_id);
}

function inRange(user_id, redis_poke_id, cb){
  client.geodist('Pokemon', 'user:' + user_id, redis_poke_id, 'm', function(err, res){
    let radius = parseFloat(res);
    if(radius < 200){
      return cb(true, radius);
    }else{
      return cb(false, radius);
    }
  });
}

function createStop(lat, lng){
  client.geoadd('Pokemon', lng, lat, 'stop:' + shortid.generate());
}

function useStop(stop_id, user_id, cb){
  let total_id = stop_id + user_id;
  client.exists(total_id, function(err, val){
    if(val == 1){
      // Timed out
      return cb('Come back later');
    }else{
      client.geodist('Pokemon', 'user:' + user_id, stop_id, function(err, dist){
        if(dist < 200){
          client.set(total_id, 1, 'EX', 30, function(err){
            return cb(true);
          });
        }else{
          return cb('Too far away');
        }
      });
    }
  })
}

module.exports = {
  spawnPokemon: spawnPokemon,
  useStop: useStop,
  despawnExpiredPokemon: despawnExpiredPokemon,
  pokemonWithinRadius: pokemonWithinRadius,
  unixTimeStamp: unixTimeStamp,
	despawnPokemon: despawnPokemon,
  allPokemon: allPokemon,
  redisEmitter: redisEmitter,
  moveUser: moveUser,
  inRange: inRange,
  createStop: createStop
}
