var express = require('express');
var passport = require('passport');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();
var router = express.Router();
var dotenv = require('dotenv');
var mongoose = require('mongoose');
var Mon = require('./mon');
var User = require('./user');
var Species = require('./species');
var redis = require('./redis');
const EventEmitter = require('events');
const socketEmitter = new EventEmitter();

dotenv.load();

mongoose.connect('mongodb://localhost/pogo1');

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

  })

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

router.get('/', ensureLoggedIn, ensureHasTeam, function(req, res) {
  return res.json(req.user);
});

// Show all kinds of mons
router.get('/catalog', function(req, res) {
  Species.find({}, 'name -_id', function(err, mons) {
    return res.json(mons);
  });
});

router.get('/geo/pokemon', ensureLoggedIn, ensureHasTeam, function(req, res) {
  var lat = parseFloat(req.query.lat);
  var lng = parseFloat(req.query.lng);
  if (typeof lat != 'number' || typeof lng != 'number') {
    return res.json({
      err: 'malformed'
    });
  }
  redis.pokemonWithinRadius(lat, lng, 3, function(pokemon) {
    return res.json(pokemon);
  });
});

router.post('/poke/battle', ensureLoggedIn, ensureHasTeam, function(req, res) {
  var redis_poke_id = req.body.redis_poke_id;
  var poke_species = req.body.poke_species;
  var user_id = req.user.id;
  // TODO check if `pokemonExists`
  redis.despawnPokemon(redis_poke_id);
  socketEmitter.emit('del poke', redis_poke_id);
  var pokemon = new Mon();
  pokemon.name = poke_species;
  pokemon.attack = 4;
  pokemon.save(function() {
    User.findOne({
      auth_zero_id: user_id
    }, function(err, user) {
      console.log(user);
      if (err) throw err;
      user.mons.push(pokemon._id);
      user.save();
      // TODO emit websocket reset
      return res.json({
        msg: 'success'
      });
    });
  });
});

router.get('/team_select', ensureLoggedIn, function(req, res) {
  return res.render('team_select')
});

router.get('/game', ensureLoggedIn, ensureHasTeam, function(req, res) {
  return res.render('user', {
    user: req.user
  });
});

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
        user.save();
        return res.redirect('/game');
      }
    });
  }
});

module.exports = {
  router: router,
  socketEmitter: socketEmitter
};
