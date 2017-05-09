var map;
var userPos;
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
        pokemons = JSON.parse(this.response);
        if(pokemons.err && pokemons.err == 'malformed'){
          console.log('error');
        }else{
          for(let pokemon of pokemons){
            let pokeMarker = new google.maps.Marker({
              position: {lat: parseFloat(pokemon.lat), lng: pokemon.lng},
              map: map,
              icon: {
                url: '/images/'+pokemon.name+'.png',
                scaledSize: new google.maps.Size(80,80)
              },
              title: pokemon.name
            });
            pokeMarker.addListener('click', function(evt){
              pokeMarker.setMap(null);
              pokeMarker = null;
              var battleRequest = new XMLHttpRequest();
              battleRequest.open('POST', '/poke/battle')
              battleRequest.onreadystatechange = function(){
                if(this.readyState == 4 && this.status == 200){
                  var res = JSON.parse(this.response);
                  console.log(res);
                }
              };
              battleRequest.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
              battleRequest.send('poke_id=' + pokemon.id);
            });
          }
        }
      }
    }
    pokeRequest.open("GET", "/geo/pokemon?lat=" + userPos.lat + "&lng=" + userPos.lng, true);
    pokeRequest.send();

    userMarker.addListener('click', function(evt){
      alert('you pressed the user!');
    })
    map.addListener('center_changed', function(evt){
      /*map.panTo(userMarker.position);*/
    });
    console.log("finally");
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
function deniedPermission(err){
  console.log("this part");
  console.log(err);
}
