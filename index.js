var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var session = require('express-session');
var passport = require('passport');
var Auth0Strategy = require('passport-auth0');
var dotenv = require('dotenv');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn();
var flash = require('express-flash-messages')
var https = require('https');
var fs = require('fs');
var ioServer = require('socket.io');

var httpsOptions = {
  key: fs.readFileSync('server.key'),
  cert: fs.readFileSync('server.crt'),
  requestCert: false,
  rejectUnauthorized: false
}

dotenv.load();

var strategy = new Auth0Strategy({
  domain: process.env.AUTH0_DOMAIN,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  callbackURL: 'https://localhost:3000/callback'
}, function(accessToken, refreshToken, extraParams, profile, done) {
  // accessToken is the token to call Auth0 API (not needed in the most cases)
  // extraParams.id_token has the JSON Web Token
  // profile has all the information from the user
  return done(null, profile);
});

passport.use(strategy);

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

var app = express();
var routerObject = require('./routes');
var router = routerObject.router;
var socketEmitter = routerObject.socketEmitter;
var redisEmitter = routerObject.redisEmitter;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(flash())
app.use(session({
  secret: 'shhhhhhh',
  resave: true,
  saveUninitialized: true
}))

app.use(passport.initialize())
app.use(passport.session())
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', router);

var server = https.createServer(httpsOptions, app);

var io = new ioServer(server);
io.on('connection', function(socket){

});

redisEmitter.on('despawn pokemon', function(redis_poke_id){
  io.emit('despawn poke', {id: redis_poke_id});
});

redisEmitter.on('spawn poke', function(redis_poke_id, lat, lng){
  // io.emit('spawn poke', {id: redis_poke_id, lat: lat, lng: lng})
});

server.listen(3000, function(err){
  console.log(err);
  console.log("server listening on :3000");
})

// app.listen(3000);
