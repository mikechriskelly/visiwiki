function getValues(obj, key) {
    var objects = [];
    for (var i in obj) {
        if (!obj.hasOwnProperty(i)) continue;
        if (typeof obj[i] == 'object') {
            objects = objects.concat(getValues(obj[i], key));
        } else if (i == key) {
            objects.push(obj[i]);
        }
    }
    return objects;
}
// FreeDB
$(function() {
  $("#myinput")
    .suggest({
      "key": "AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY",
      filter:'(all type:/people/person)',
      animate: "false"})
    .bind("fb-select", function(e, data) { 

      // Initialize record for node
      var node_person = { 
        "name" : data.name,
        "city" : "",
        "country" : "",
        "lived" : ["?","?"],
        "geo" : [0,0],
        "infby" : [],
        "infed" : [] };
      
      // Queries
      var query_person = [{
        "id": data.id,
        "type": "/people/person",
        "place_of_birth": [{
          "name": null,
          "type": "/location/location",
          "geolocation": {
            "latitude": null,
            "longitude": null
          }
        }],
        "nationality": [],
        "date_of_birth": []
      }];
      var query_death = [{
        "id": data.id,
        "type": "/people/deceased_person",
        "date_of_death": []
      }];
      var query_influence = [{
        "id": data.id,
        "type": "/influence/influence_node",
        "influenced_by": [],
        "influenced": []
      }];

      var service_url = "https://www.googleapis.com/freebase/v1/mqlread?callback=?";
      $.getJSON(service_url, {query:JSON.stringify(query_person)}, function(response) {
        console.dir(response.result[0]);
        node_person.city = response.result[0].place_of_birth[0].name;
        node_person.country = response.result[0].nationality[0];
        // Check if geo coordinates available, else use country
        node_person.geo = [response.result[0].place_of_birth[0].geolocation.latitude, response.result[0].place_of_birth[0].geolocation.longitude];
        node_person.lived[0] = response.result[0].date_of_birth[0].match(/[-]?\d{4}/);
        console.log(node_person);
        // Convert DOB to YYYY format

        $.getJSON(service_url, {query:JSON.stringify(query_death)}, function(response) {
          // Determine if person is alive or dead
          node_person.lived[1] = response.result[0].date_of_death[0].match(/[-]?\d{4}/);
          $.getJSON(service_url, {query:JSON.stringify(query_influence)}, function(response) {
            node_person.infby = response.result[0].influenced_by;
            node_person.infed = response.result[0].influenced;

            // Print Results
            $('<p>',{text:node_person.name + " - " + 
              node_person.city + ", " + 
              node_person.country + " (" + 
              node_person.lived + ") [" +
              node_person.geo[0] + ", " + node_person.geo[1] + "]"
            }).appendTo(document.body);
          });      
        });

      }); // End getJSON Process
  });
});

// SVG Map
var width  = 900,
    height = 450;

var projection = d3.geo.mercator()
                .translate([450,280])
                .scale(140);

var path = d3.geo.path().projection(projection);

var svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(d3.behavior.zoom()
    .scaleExtent([1,8])
    .on("zoom", redraw))
    .append("g");


function redraw() {
    svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

queue()
    .defer(d3.json, "data/world.json")
    .defer(d3.tsv, "data/world-country-names.tsv")
    .defer(d3.json, "data/cities.json")
    .await(ready);

function ready(error, world, names, points) {
  var countries = topojson.object(world, world.objects.countries).geometries,
      neighbors = topojson.neighbors(world, countries),
      i = -1,
      n = countries.length;

  countries.forEach(function(d) { 
    var tryit = names.filter(function(n) { return d.id == n.id; })[0];
    if (typeof tryit === "undefined"){
      d.name = "Undefined";
      console.log(d);
    } else {
      d.name = tryit.name; 
    }
  });

var country = svg.selectAll(".country").data(countries);
  country
   .enter()
    .insert("path")
    .attr("class", "country")    
      .attr("title", function(d,i) { return d.name; })
      .attr("d", path);

  //render the points
  points.cities.forEach(function(d) { 
      var x = projection(d.geometry.coordinates)[0];
      var y = projection(d.geometry.coordinates)[1];

      svg.append("svg:circle")
          .attr("class","point")
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", 5)
  });
}