var express = require('express');
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();
var router = express.Router();
var dotenv = require('dotenv');
var mongoose = require('mongoose');
var Mon = require('./mon');
var User = require('./user');
var redis = require('./redis');
const EventEmitter = require('events');
const socketEmitter = new EventEmitter();
var shortid = require('shortid');

// TODO
// Confirm before throwing pokeball
// Add more example pokestops
// Change timeouts and balancing a bit?

dotenv.load();

mongoose.connect('mongodb://localhost/pogo1');


// BEGIN Auth0 Boilerplate
var env = {
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
  AUTH0_CALLBACK_URL: 'https://localhost:3000/callback'
};

router.get('/login', function(req, res) {
  return res.render('login', {
    env: env
  });
})

router.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
})

router.get('/callback', passport.authenticate('auth0', {
    failureRedirect: '/login-error'
  }),
  function(req, res) {
    User.findOne({
      'auth_zero_id': req.user.id
    }, function(err, doc) {
      if (doc === null) {
        var user = new User();
        user.auth_zero_id = req.user.id;
        user.username = req.user.displayName;
        user.mons = [];
        user.team = "none";
        user.save();
        return res.redirect('/team_select');
      } else {
        return res.redirect('/game');
      }
    });
  });
// END Auth0 Boilerplate


const teams = ['red', 'blue', 'yellow']
function ensureHasTeam(req, res, next) {
  if (teams.includes(req.user.team)) {
    return next();
  } else {
    User.findOne({
      auth_zero_id: req.user.id
    }, function(err, user) {
      if (err) throw err;
      if (teams.includes(user.team)) {
        req.user.team = user.team;
        return next();
      } else {
        req.flash('error', 'You need to select a team');
        // TODO add flash messages to team_select
        return res.redirect('/team_select');
      }
    })
  }
}

// Landing page
router.get('/', ensureLoggedIn, ensureHasTeam, function(req, res) {
  return res.redirect('/game');
});

// Main page
router.get('/game', ensureLoggedIn, ensureHasTeam, function(req, res) {
  return res.render('game', {
    user: req.user
  });
});

router.get('/user/items', ensureLoggedIn, ensureHasTeam, function(req, res){
  User.findOne({auth_zero_id: req.user.id}, function(err, user){
    return res.json({items: user.items});
  });
});

// Get a list of a users pokemons
router.get('/user/pokemon', ensureLoggedIn, ensureHasTeam, function(req, res){
  User.findOne({auth_zero_id: req.user.id})
    .populate('mons')
    .exec(function(err, user){
      res.json(user.mons);
    })
});

// Release a pokemon
router.post('/user/release', ensureLoggedIn, ensureHasTeam, function(req, res){
  var id_string = req.body.id;
  var id = mongoose.Types.ObjectId(id_string);
  if(id == undefined || id == null){
    return res.json({msg: "No id provided", type: "error"})
  }
  User.findOne({auth_zero_id: req.user.id}, function(err, user){
    let idx = user.mons.indexOf(id);
    if(idx > -1){
      user.mons.splice(idx, 1);
      Mon.remove({_id: id}, function(err2, mon){
        // SILENT
      });
      user.save();
      return res.json({msg: 'Released!', type: 'success'})
    }else{
      return res.json({msg: 'That pokemon was not present.', type: 'error'})
    }
  });
});

// Get pokemon within a radius
router.get('/geo/pokemon', ensureLoggedIn, ensureHasTeam, function(req, res) {
  var lat = parseFloat(req.query.lat);
  var lng = parseFloat(req.query.lng);
  if (typeof lat != 'number' || typeof lng != 'number') {
    return res.json({
      err: 'malformed'
    });
  }
  // 500 m radius
  redis.pokemonWithinRadius(lat, lng, 500, function(pokemons) {
    var confirmed = pokemons.filter(function(pokemon) {
      // Verify that it is a pokemon, and not a user
      let type = pokemon.name.split(':')[0]
      return type != 'user' && type != 'stop';
    });
    return res.json(confirmed);
  });
});

// Get pokestops within a radius
router.get('/geo/stops', ensureLoggedIn, ensureHasTeam, function(req, res){
  var lat = parseFloat(req.query.lat);
  var lng = parseFloat(req.query.lng);
  if (typeof lat != 'number' || typeof lng != 'number') {
    return res.json({
      err: 'malformed'
    });
  }
  redis.pokemonWithinRadius(lat, lng, 800, function(stops){
    var confirmed = stops.filter(function(stop) {
      // Verify that it is a stop
      return stop.name.split(':')[0] === 'stop';
    });
    return res.json(confirmed);
  })
});

router.post('/stop', ensureLoggedIn, ensureHasTeam, function(req, res){
  var stop_id = req.body.stop_id;
  redis.useStop(stop_id, req.user.id, function(got_item){
    if(got_item === true){
      User.findOne({auth_zero_id: req.user.id}, function(err, user){
        if(err) throw err;
        let items = Math.floor(Math.random() * 6) + 1;
        user.items += items;
        user.save();
        return res.json({item: true, items_gained: items, items: user.items});
      });
    }else{
      return res.json({item: false, msg: got_item});
    }
  });
});

// Move a user to a new position
router.post('/geo/user', ensureLoggedIn, ensureHasTeam, function(req, res) {
  var lat = req.body.lat;
  var lng = req.body.lng;
  var user_id = req.user.id;
  redis.moveUser(user_id, lat, lng);
  return res.json({
    msg: 'fix this'
  });
});

// Catch a pokemon
router.post('/poke/battle', ensureLoggedIn, ensureHasTeam, function(req, res) {
  var redis_poke_id = req.body.redis_poke_id;
  var poke_species = req.body.poke_species;
  var user_id = req.user.id;
  redis.inRange(user_id, redis_poke_id, function(in_range, radius) {
    if (in_range) {
      User.findOne({auth_zero_id: user_id}, function(err, user){
        if(err) throw err;
        if(user.items >= 1){
          user.items -= 1;
          redis.despawnPokemon(redis_poke_id, function(despawned){
            if(despawned){
              var caught = Math.random();
              if(caught < species_stats[poke_species].chance){
                var pokemon = new Mon();
                pokemon.name = poke_species;
                pokemon.attack = Math.floor(Math.random() * species_stats[poke_species].max_attack) + 1;
                pokemon.save(function(){
                  user.mons.push(pokemon._id);
                  user.save();
                  return res.json({
                    msg: 'You caught a ' + poke_species + "!",
                    type: "success"
                  })
                });
              }else{
                user.save(function(){
                  return res.json({
                    msg: 'It ran away',
                    type: 'error'
                  })
                })
              }

            }else{
              return res.json({
                msg: 'It ran away',
                type: 'error'
              })
            }
          })

        }else{
          return res.json({
            msg: "You are out of pokeballs",
            type: "error"
          })
        }
      });
    } else {
      User.findOne({
        auth_zero_id: user_id
      }, function(err, user) {
        if (err) throw err;
        user.items -= 1;
        if(user.items <= 0) user.items = 0;
        user.save();
        if (typeof radius == 'number' && radius != null) {
          return res.json({
            msg: 'That pokemon is out of range.',
            dist: radius,
            uanit: 'm',
            type: 'error'
          });
        } else {
          return res.json({
            msg: 'It ran away!',
            type: 'error'
          })
        }
      });
    }
  })

});

// Select a team : page
router.get('/team_select', ensureLoggedIn, function(req, res) {
  return res.render('team_select')
});

// Select a team : action
router.post('/team_select', ensureLoggedIn, function(req, res) {
  var team = req.body.team;
  if (!teams.includes(req.body.team)) {
    req.flash('error', 'Invalid team selected');
    return res.redirect('/team_select');
  } else {
    var userId = req.user.id;
    User.findOne({
      auth_zero_id: userId
    }, function(err, user) {
      if (teams.includes(user.team)) {
        req.flash('error', 'You are already on ' + user.team + ' team');
        return res.redirect('/game');
      } else {
        user.team = team;
        user.save(function(){
          return res.redirect('/game');
        });
      }
    });
  }
});


species_stats = {
  Bulbasaur: {
    base_life: 600,
    life_variance: 60,
    chance: 0.8,
    max_attack: 7
  },
  Charmander: {
    base_life: 220,
    life_variance: 80,
    chance: 0.2,
    max_attack: 14
  },
  Squirtle: {
    base_life: 340,
    life_variance: 20,
    chance: 0.4,
    max_attack: 8
  },
  Clem: {
    base_life: 120,
    life_variance: 40,
    chance: 0.1,
    max_attack: 20
  },
  Nick: {
    base_life: 120,
    life_variance: 100,
    chance: 0.2,
    max_attack: 16
  },
  Matt: {
    base_life: 1800,
    life_variance: 200,
    chance: 0.9,
    max_attack: 5
  },
  Daniel: {
    base_life: 1400,
    life_variance: 300,
    chance: 0.05,
    max_attack: 17
  },
  Sam: {
    base_life: 30,
    life_variance: 10,
    chance: 0.95,
    max_attack: 1
  },
  Max: {
    base_life: 600,
    life_variance: 100,
    chance: 0.4,
    max_attack: 10
  },
  Ryan: {
    base_life: 20,
    life_variance: 5,
    chance: 0.01,
    max_attack: 40
  },
  Hunter: {
    base_life: 20,
    life_variance: 5,
    chance: 0.3,
    max_attack: 9
  },
  Ben: {
    base_life: 5000,
    life_variance: 2000,
    chance: 0.95,
    max_attack: 0
  },
  Mckay: {
    base_life: 40,
    life_variance: 10,
    chance: 0.02,
    max_attack: 15
  },
  Vaughn: {
    base_life: 500,
    life_variance: 100,
    chance: 0.18,
    max_attack: 23
  },
  Carson: {
    base_life: 100,
    life_variance: 60,
    chance: 0.3,
    max_attack: 34
  },
  Miles: {
    base_life: 4000,
    life_variance: 2000,
    chance: 0.7,
    max_attack: 13
  }
}

// Yup, the correct plural of `species`
speciess = Object.keys(species_stats);
// speciess = ['Bulbasaur', 'Charmander', 'Squirtle', 'Clem', 'Nick', 'Matt', 'Daniel', 'Max', 'Sam', 'Ryan'];
// Stats for species for spawning

// Spawns pokemon within a certain rectangle around Kent Denver Campus
// Every 10 seconds a pokemon spawns
setInterval(function() {
  let specie = speciess[Math.floor(Math.random() * speciess.length)];
  let lifetime = species_stats[specie].base_life + (Math.random() - 0.5) * 2 * species_stats[specie].life_variance;
  redis.spawnPokemon(
    specie + ':' + shortid.generate(),
    39.622192 + (Math.random() * (39.639260 - 39.622192)),
    -104.950316 + Math.random() * (-104.927117 - -104.950316),
    lifetime);
}, 1500);

// Regularly check the pokemon stored in redis, and despawn them
setInterval(function() {
  redis.despawnExpiredPokemon();
}, 1000);

module.exports = {
  router: router,
  socketEmitter: socketEmitter,
  redisEmitter: redis.redisEmitter,
  redis: redis
};
