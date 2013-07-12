// FreeDB Service URL
var service_url = "https://www.googleapis.com/freebase/v1/mqlread?callback=?";

// FreeDB Search Box 
$(function() {
  $("#myinput")
    .suggest({
      "key": "AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY",
      filter:'(all type:/people/person)',
      animate: "false"})

    // Search Result Selected
    .bind("fb-select", function(e, data) { 
      // Query and parse one person's info; On completion calls plotOnMap
      getPersonInfo(data.id);
    });
});

// Render SVG Map
var width  = 900,
    height = 450;

var projection = d3.geo.mercator()
                .translate([450,280])
                .scale(140);

var path = d3.geo.path().projection(projection);

var zoom = d3.behavior.zoom()
    .scaleExtent([1,8])
    .on("zoom", redraw);

var svg = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(zoom)
    .append("g");

// Timeline Setup
var svg_timeline = d3.select("#map").append("svg")
    .attr("id", "timeline")
var xScale = d3.scale.linear()
             .domain([-1000, 2013])
             .range([12, width-10]);

var xAxis = d3.svg.axis().scale(xScale).ticks(15);
 
svg_timeline.append("g")
  .attr("class", "timeline")
  .attr("transform", "translate(0,-4)")
  .call(xAxis);

function redraw() {
    svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

queue()
    .defer(d3.json, "data/world.json")
    .defer(d3.tsv, "data/world-country-names.tsv")
    .await(ready);

function ready(error, world, names) {
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

var maphovertip = d3.select(".right").append("div").attr("class", "maphovertip hidden");
var country = svg.selectAll(".country").data(countries);

  country
   .enter()
    .insert("path")
    .attr("class", "country")    
    .attr("title", function(d,i) { return d.name; })
    .attr("d", path);

  // Display country name tooltip
  country
    .on("mousemove", function(d,i) {
      console.log(zoom.scale());
      maphovertip
        .classed("hidden", false)
        .html(d.name)
    })
    .on("mouseout",  function(d,i) {
      maphovertip
        .classed("hidden", true)
        .attr("style", "left: 0px; top 0px")
    });
}
function getPersonInfo(id) {
  var query = [{
    "id": id,
    "name": [],
    "/people/person/place_of_birth": [{}],
    "/people/person/nationality": [],
    "/people/person/profession": [],
    "/people/person/date_of_birth": [],
    "/people/deceased_person/date_of_death": [],
    "/influence/influence_node/influenced_by": [{}],
    "/influence/influence_node/influenced": [{}]
  }];
  
  // Async Query Request
  $.getJSON(service_url, {query:JSON.stringify(query)}, function(response) {
    console.dir(response.result[0]);

    // Store data in object
    var person = {};
    person.id = id;
    person.name = response.result[0]["name"][0];

    // Filter DOB and DOD to YYYY format
    person.dob = parseInt(response.result[0]["/people/person/date_of_birth"][0].match(/[-]?\d{4}/)[0]);
    person.dod = parseInt(response.result[0]["/people/deceased_person/date_of_death"][0].match(/[-]?\d{4}/)[0]);

    person.city_id = response.result[0]["/people/person/place_of_birth"][0]["id"];
    person.city_name = response.result[0]["/people/person/place_of_birth"][0]["name"];
    person.profession = response.result[0]["/people/person/profession"].join(", "); 
    person.infld = response.result[0]["/influence/influence_node/influenced_by"];
    person.infby = response.result[0]["/influence/influence_node/influenced_by"];
  
    $("<p>",{text:person.name + " (" + person.dob + " to " + person.dod + "): " + person.profession}).appendTo(".nameboxes");

    // Callback function sends info to put on map
    plotOnMap(person);
  });
}


function plotOnMap(person) {
  var geo_query = [{
    "id": person.city_id,
    "/location/location/geolocation": [{
      "latitude": [],
      "longitude": []
    }]
  }];
  $.getJSON(service_url, {query:JSON.stringify(geo_query)}, function(response) {
    // Parse coordinates
    var coordinates = [response.result[0]["/location/location/geolocation"][0]["longitude"][0],
                      response.result[0]["/location/location/geolocation"][0]["latitude"][0]];
    var x = projection(coordinates)[0];
    var y = projection(coordinates)[1];

    // Draw node
    svg.append("svg:circle")
      .attr("class","point")
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", 4)
      .attr("title", person.name)
      .on("mouseover", function(d,i) {
        d3.select("maphovertip")
          .classed("hidden", false)
          .html(person.name)
        d3.select(this)
          .classed("hoverpoint", true)
      })
      .on("mouseout",  function(d,i) {
        d3.select("maphovertip")
          .classed("hidden", true)
        d3.select(this)
          .classed("hoverpoint", false)
      })
      .on("click",  function(d,i) {
        d3.select("#activepoint")
          .attr("id", "")
          .attr("r", 4) 
        d3.select(this)
          .classed("activepoint", false)
          .attr("r", 6)
          .attr("id", "activepoint")
      });
    // Draw timeline
    svg_timeline.selectAll("rect")
      .data([1])
      .enter()
      .append("rect")
      .attr("x", function(d) {
        return xScale(person.dob);
      })
      .attr("y", 0)
      .attr("width", function(d) {
        return xScale(person.dod) - xScale(person.dob);
      })
      .attr("height", 15)
      .attr("fill", "red")
      .attr("opacity", 0.7)
  });
}