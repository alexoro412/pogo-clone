var map;
var userPos;
var pokemon_cache = {};
var socket = io('https://localhost:3000', {secure:true});
socket.on('del poke', function(data){
  despawnPokemon(data.id.split(':')[1]);
});
function initMap(){
  console.log('here');
  getLocation(function(pos){
    console.log('also here')
    console.log(pos);
    userPos = {lat: pos.coords.latitude, lng: pos.coords.longitude};
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

    var userMarker = new google.maps.Marker({
      position: userPos,
      map: map,
      icon: {
        url: '/images/player.png',
        scaledSize: new google.maps.Size(80, 80)
      },
      title: 'User'
    });

    var pokeRequest = new XMLHttpRequest();
    pokeRequest.onreadystatechange = function(){
      if(this.readyState == 4 && this.status == 200){
        let pokemons = JSON.parse(this.response);
        if(pokemons.err && pokemons.err == 'malformed'){
          console.log('error');
        }else{
          for(let pokemon of pokemons){
            let split_title = pokemon.name.split(':');
            let species = split_title[0];
            let redis_poke_id = split_title[1];
            pokemon_cache[redis_poke_id] = new google.maps.Marker({
              position: {lat: parseFloat(pokemon.lat), lng: parseFloat(pokemon.lng)},
              map: map,
              icon: {
                url: '/images/'+ species +'.png',
                scaledSize: new google.maps.Size(80,80)
              },
              title: species
            });
            ;
            pokemon_cache[redis_poke_id].addListener('click', function(evt){
              var battleRequest = new XMLHttpRequest();
              battleRequest.open('POST', '/poke/battle')
              battleRequest.onreadystatechange = function(){
                if(this.readyState == 4 && this.status == 200){
                  var res = JSON.parse(this.response);
                  console.log(res);
                }
              };
              battleRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
              battleRequest.send('redis_poke_id=' + pokemon.name + "&poke_species=" + species);
            });
          }
        }
      }
    }
    pokeRequest.open("GET", "/geo/pokemon?lat=" + userPos.lat + "&lng=" + userPos.lng, true);
    pokeRequest.send();

    // userMarker.addListener('click', function(evt){
    //   alert('you pressed the user!');
    // })
    map.addListener('center_changed', function(evt){
      /*map.panTo(userMarker.position);*/
    });
    console.log("finally");
  });
}

function despawnPokemon(redis_poke_id){
  pokemon_cache[redis_poke_id].setMap(null);
  pokemon_cache[redis_poke_id] = null;
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
function deniedPermission(err){
  console.log("this part");
  console.log(err);
}
