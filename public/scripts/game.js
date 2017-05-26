var map;
var userPos;
var socket = io('', {
  secure: true
});
var pokemon_cache = {};
var stop_cache = {};
var topbar = document.getElementById('topbar');
notification_types = {
  error: 'is-danger',
  success: 'is-primary'
}

var num_pokeballs = 0;

// FROM stack overflow : http://stackoverflow.com/questions/27928/calculate-distance-between-two-latitude-longitude-points-haversine-formula
function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}

function throwPokeBall(cb) {
  var elem = document.createElement('img');
  elem.style['z-index'] = 50;
  elem.style.position = 'fixed';
  elem.style.top = '0';
  elem.style['min-width'] = '100vw';
  elem.style['min-height'] = '100vh';
  elem.src = '/images/throw.gif?f=' + Math.random();
  document.body.appendChild(elem);
  setTimeout(function() {
    elem.offsetHeight;
    elem.remove();
    elem = null;
    cb();
  }, 2400);
}

function notify(msg, type) {
  var elem = document.createElement('div');
  elem.className = 'notification ' + notification_types[type];
  elem.innerHTML = '<span>' + msg + '</span>';
  topbar.appendChild(elem);
  setTimeout(function() {
    elem.remove();
  }, 5000);
}

var modal = document.getElementById('full-notify');
var modalContent = document.getElementById('full-notify-content');
var modalClose = document.getElementById('full-notify-close');

var releaseModal = document.getElementById('release-confirm');
var releaseModalContent = releaseModal.querySelector('.modal-content');
var releaseRelease = releaseModal.querySelector('#release-release');

var stopModal = document.getElementById('pokestop');

var pokeballTag = document.getElementById("pokeballs");

var pokedexBody = document.getElementById('pokedex-body');

var active_stop = "";

function setPokeballTag(){
  if(num_pokeballs < 0) num_pokeballs = 0;
  pokeballTag.innerHTML = num_pokeballs + " Pokeballs";
}

function openPokestopModal() {
  stopModal.classList.add('is-active');
}

function pokestopInitial(stop_id){
  stopModal.querySelector('.title').innerHTML = 'Pokestop!';
  stopModal.querySelector('#pokestop-use').disabled = false;
}

function pokestopRefused(msg){
  stopModal.querySelector('.title').innerHTML = msg;
  stopModal.querySelector('#pokestop-use').disabled = true;
}

stopModal.querySelector('#pokestop-cancel').addEventListener('click', function(){
  closePokestopModal();
  active_stop = "";
});

function getPokeballs(){
  var pokeballRequest = new XMLHttpRequest();
  pokeballRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      let res = JSON.parse(this.response);
      if(res.items){
        num_pokeballs = res.items;
        setPokeballTag();
      }
    }
  };
  pokeballRequest.open("GET", "/user/items", true);
  pokeballRequest.send();
}

stopModal.querySelector('#pokestop-use').addEventListener('click', function(){
  var useRequest = new XMLHttpRequest();
  useRequest.open('POST', '/stop')
  useRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      let res = JSON.parse(this.response);
      if(res.item){
        console.log("Got " + res.items_gained + " items");
        num_pokeballs = res.items;
        closePokestopModal();
        pokestopInitial();
        setPokeballTag();
      }else{
        pokestopRefused(res.msg);
      }
    }
  };
  useRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  useRequest.send('stop_id=' + active_stop);
})

function closePokestopModal() {
  stopModal.classList.remove('is-active');
}

function closeModal() {
  modal.classList.remove('is-active');
  return false;
}

function closeReleaseModal() {
  releaseModal.classList.remove('is-active');
  return false;
}

modal.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);

// releaseModal.addEventListener('click', closeReleaseModal);
releaseModal.querySelector('#release-cancel')
  .addEventListener('click', closeReleaseModal);

function confirmReleasePokemon(id, name) {
  releaseRelease.onclick = function() {
    releaseModal.classList.remove('is-active');
    releasePokemon(id);
  }
  releaseModal.querySelector('.title').innerHTML = 'Are you sure you want to release ' + name + '?';
  releaseModal.classList.add('is-active');
}

function releasePokemon(id) {
  var releaseRequest = new XMLHttpRequest();
  releaseRequest.open('POST', '/user/release')
  releaseRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      var res = JSON.parse(this.response);
      console.log(res);
      for(let idx in poke_els){
        if(poke_els[idx].id == id){
          poke_els.splice(idx, 1);
          break;
        }
      }
      document.getElementById(id).remove();
    }
  };
  releaseRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  releaseRequest.send('id=' + id);
}

function fullNotify(msg, type, image) {
  modal.classList.add('is-active');
  type_class = notification_types[type];
  modalContent.querySelector('img').src = '/images/' + image + '.png';
  modalContent.querySelector('.media-content').className = 'media-content notification ' + type_class;
  modalContent.querySelector('strong').innerHTML = msg;
}

socket.on('despawn poke', function(data) {
  try {
    despawnPokemon(data.id)
  } catch (e) {
    console.log('Despawned an absent pokemon');
  }
});
socket.on('spawn poke', function(data) {
  spawnPokemon(data.id, data.lat, data.lng);
});

function moveUser(pos){
  var moveRequest = new XMLHttpRequest();
  moveRequest.open('POST', '/geo/user')
  moveRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      var res = JSON.parse(this.response);
      console.log(res);
    }
  };
  moveRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
  moveRequest.send('lat=' + pos.lat + "&lng=" + pos.lng);
}

function initMap() {
  console.log('here');
  getLocation(function(pos) {
    console.log('also here')
    console.log(pos);
    userPos = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude
    };

    map = new google.maps.Map(document.getElementById('map'), {
      zoom: 18,
      center: userPos,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      disableDoubleClickZoom: true,
      gestureHandling: "cooperative",
      maxZoom: 20,
      minZoom: 17,
      clickableIcons: false
    });

    var catchCircle = new google.maps.Circle({
      strokeColor: '#0000FF',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#6600FF',
      fillOpacity: 0.3,
      map: map,
      center: userPos,
      radius: 200
    });

    var sightCircle = new google.maps.Circle({
      strokeColor: '#000044',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#6600FF',
      fillOpacity: 0,
      map: map,
      center: userPos,
      radius: 500
    });

    var userMarker = new google.maps.Marker({
      position: userPos,
      map: map,
      icon: {
        url: '/images/player.png',
        scaledSize: new google.maps.Size(80, 80)
      },
      title: 'User'
    });

    moveUser(userPos);

    getOwnedPokemon();

    setInterval(function() {
      loadPokemon(userPos);
      loadStops(userPos);
      getPokeballs();
    }, 5000);

    navigator.geolocation.watchPosition(function(pos) {
      console.log("moving user");
      userPos.lat = pos.coords.latitude;
      userPos.lng = pos.coords.longitude;
      moveUser(userPos);
      map.panTo(userPos);
      userMarker.setPosition(userPos);
      catchCircle.setCenter(userPos);
      sightCircle.setCenter(userPos);
    }, deniedPermission, {
      highAccuracy: true,
      maximumAge: 0
    })

    // userMarker.addListener('click', function(evt){
    //   alert('you pressed the user!');
    // })
    map.addListener('center_changed', function(evt) {
      // map.panTo(userPos);

      // sightCircle.setCenter(map.center);
      // catchCircle.setCenter(map.center);
    });
    console.log("finally");
  });
}

function loadStops(pos) {
  let stopRequest = new XMLHttpRequest();
  stopRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      let stops = JSON.parse(this.response);
      if (stops.err && stops.err == 'malformed') {
        console.log('error 233d');
      } else {
        for (let stop_key of Object.keys(stop_cache)){
          let stop = stop_cache[stop_key];
          if(getDistanceFromLatLonInKm(stop.position.lat(), stop.position.lng(), userPos.lat, userPos.lng) > 0.82){
            removeStop(stop_key);
          }
        }
        for (let stop of stops) {
          addStop(stop.name, parseFloat(stop.lat), parseFloat(stop.lng));
        }
      }
    }
  }
  stopRequest.open("GET", "/geo/stops?lat=" + pos.lat + "&lng=" + pos.lng, true);
  stopRequest.send();
}

function deleteStop(redis_stop_id) {
  stop_cache[redis_stop_id].setMap(null);
  delete stop_cache[redis_stop_id];
}


function addStop(redis_stop_id, lat, lng) {

  if (redis_stop_id in stop_cache) return false;
  stop_cache[redis_stop_id] = new google.maps.Marker({
    position: {
      lat: lat,
      lng: lng
    },
    map: map,
    icon: {
      url: '/images/stop.png',
      scaledSize: new google.maps.Size(80, 80)
    },
    title: "Pokestop"
  });
  stop_cache[redis_stop_id].addListener('click', function(evt) {
    active_stop = redis_stop_id;
    pokestopInitial();
    openPokestopModal();
    console.log("pressed " + redis_stop_id);
  });
}

function loadPokemon(pos) {
  let pokeRequest = new XMLHttpRequest();
  pokeRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      let pokemons = JSON.parse(this.response);
      if (pokemons.err && pokemons.err == 'malformed') {
        console.log('error 233d');
      } else {
        for (let pokemon_key of Object.keys(pokemon_cache)){
          let pokemon = pokemon_cache[pokemon_key];
          // If out of range, despawn
          // This is only for pokemon that have persisted since the last spawn request
          // Give a bit of leeway over the 500 m just in case the GPS is glitchy
          if(getDistanceFromLatLonInKm(pokemon.position.lat(), pokemon.position.lng(), userPos.lat, userPos.lng) > 0.52){
            despawnPokemon(pokemon_key);
          }
        }
        for (let pokemon of pokemons) {
          spawnPokemon(pokemon.name, parseFloat(pokemon.lat), parseFloat(pokemon.lng));
        }
      }
    }
  }
  pokeRequest.open("GET", "/geo/pokemon?lat=" + pos.lat + "&lng=" + pos.lng, true);
  pokeRequest.send();
}

var poke_els = [];

function sortPokemonByAttack(){
  poke_els.sort(function(a,b){
    return parseInt(b.querySelector('.poke-attack').innerHTML) - parseInt(a.querySelector('.poke-attack').innerHTML);
  });
  rebuildPokedex();
}
function sortPokemonByName(){
  poke_els.sort(function(a,b){
    let aName = a.querySelector('.poke-name').innerHTML;
    let bName = b.querySelector('.poke-name').innerHTML;

    if(aName < bName) return -1;
    if(aName > bName) return 1;
    return 0;
  });
  rebuildPokedex();
}


function rebuildPokedex() {
  for (let pokemon of poke_els) {
    pokedexBody.appendChild(pokemon);
  }
}

document.getElementById('attackHeader')
  .addEventListener('click', sortPokemonByAttack);

document.getElementById('nameHeader')
  .addEventListener('click', sortPokemonByName);
function getOwnedPokemon(pos) {
  let pokeRequest = new XMLHttpRequest();
  pokeRequest.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      let pokemons = JSON.parse(this.response);
      if (pokemons.err && pokemons.err == 'malformed') {
        console.log('error 233f');
      } else {

        for (let pokemon of pokemons) {
          existing = document.getElementById(pokemon._id);
          if (existing) continue;

          let e = document.createElement('tr');
          e.id = pokemon._id;
          let icon = document.createElement('td');
          let icon_actual = document.createElement('img');
          icon_actual.src = '/images/' + pokemon.name + '.png';
          icon.appendChild(icon_actual);
          e.appendChild(icon);
          let name = document.createElement('td');
          name.innerHTML = pokemon.name;
          name.className = 'poke-name';
          e.appendChild(name);
          let attack = document.createElement('td');
          attack.innerHTML = pokemon.attack;
          attack.className = 'poke-attack';
          e.appendChild(attack);

          let freeData = document.createElement('td');
          let freeBtn = document.createElement('button');
          freeBtn.className = 'button is-danger';
          freeBtn.innerHTML = 'Release';
          freeBtn.addEventListener('click', function() {
            confirmReleasePokemon(pokemon._id, pokemon.name);
          })
          freeData.appendChild(freeBtn)
          e.appendChild(freeData);

          pokedexBody.appendChild(e);
          poke_els.push(e);
        }
        // pokedex.style.display = 'block';
      }
    }
  }
  pokeRequest.open('GET', '/user/pokemon');
  pokeRequest.send();
}

showPokedexFab = document.getElementById('show-pokedex');

function showOwnedPokemon() {
  pokedex.style.display = 'block';
  showPokedexFab.style.display = 'none';
}
showPokedexFab.addEventListener('click', showOwnedPokemon);

function hideOwnedPokemon() {
  pokedex.style.display = 'none';
  showPokedexFab.style.display = 'block';
}
document.getElementById('hide-pokedex').addEventListener('click', hideOwnedPokemon);

function despawnPokemon(redis_poke_id) {
  pokemon_cache[redis_poke_id].setMap(null);
  delete pokemon_cache[redis_poke_id];
}

function spawnPokemon(redis_poke_id, lat, lng) {

  if (redis_poke_id in pokemon_cache) return false;
  let species = redis_poke_id.split(':')[0];
  pokemon_cache[redis_poke_id] = new google.maps.Marker({
    position: {
      lat: lat,
      lng: lng
    },
    map: map,
    icon: {
      url: '/images/' + species + '.png',
      scaledSize: new google.maps.Size(80, 80)
    },
    title: species
  });
  pokemon_cache[redis_poke_id].addListener('click', function(evt) {

    var battleRequest = new XMLHttpRequest();
    battleRequest.open('POST', '/poke/battle')
    battleRequest.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
        var res = JSON.parse(this.response);
        getOwnedPokemon();
        num_pokeballs -= 1;
        setPokeballTag();
        throwPokeBall(function() {
          fullNotify(res.msg, res.type, species);
        });

      }
    };
    battleRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    battleRequest.send('redis_poke_id=' + redis_poke_id + "&poke_species=" + species);

  });
}

function getLocation(cb) {
  if (navigator.geolocation) {
    console.log('here 2');
    navigator.geolocation.getCurrentPosition(cb, deniedPermission);
  } else {
    console.log("GeoLoc not working");
  }
}

function gotPosition(position) {
  console.log("Latitude: " + position.coords.latitude +
    "\nLongitude: " + position.coords.longitude);
}

function deniedPermission(err) {
  fullNotify('We need permission to access your location so you can play the game', 'error', 'map');
  console.log("this part");
  console.log(err);
}
