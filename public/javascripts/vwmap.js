// FreeDB
$(function() {
  $("#myinput")
    .suggest({
      "key" : "AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY",
      filter:'(all type:/people/person)',
      animate: "true"})
    .bind("fb-select", function(e, data) { 
      // Execute Query
      var query = [{'id': data.id, 'name': data.name, 
                  "/people/person/place_of_birth": [],
                  "/people/person/nationality": [],
                  "/people/person/date_of_birth": [],
                  "/people/deceased_person/date_of_death": [],
                  "/influence/influence_node/influenced_by": [], 
                  "/influence/influence_node/influenced": []}];
      var service_url = 'https://www.googleapis.com/freebase/v1/mqlread';
      $.getJSON(service_url + '?callback=?', {query:JSON.stringify(query)}, function(response) {
        $.each(response.result, function(i,result){
          $('<p>',{text:result["name"] + " - " + result["/people/person/place_of_birth"] + ", " + result["/people/person/nationality"]
           + " (" + result["/people/person/date_of_birth"] + " - " + result["/people/deceased_person/date_of_death"] + ")"}).appendTo(document.body);
        });
      });
      //End Query
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