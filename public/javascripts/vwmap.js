// ****************** Render SVG Map & Timeline ******************************* //
// Map Setup
var width  = 900,
    height = 450;

var projection = d3.geo.mercator()
                .translate([420,250])
                .scale(170);

var path = d3.geo.path().projection(projection);

var zoom = d3.behavior.zoom()
    .scaleExtent([1,8])
    .on("zoom", redraw);

var svg_map = d3.select("#map").append("svg")
    .attr("width", width)
    .attr("height", height)
    .call(zoom)
    .append("g");

function redraw() {
    svg_map.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

// Timeline Setup
var svg_timeline = d3.select("#map").append("svg")
    .attr("id", "timeline");
var thisYear = new Date().getFullYear();
var xScale = d3.scale.linear()
             .domain([-1000, thisYear])
             .range([12, width-10]);
var xAxis = d3.svg.axis().scale(xScale).ticks(15);

svg_timeline.append("g")
  .attr("class", "timeline")
  .attr("transform", "translate(0,-4)")
  .call(xAxis);

// Tip box for country names
var maphovertip = d3.select(".right").append("div")
    .attr("class", "maphovertip")
    .style("opacity", 0);

// Tip box for people names 
var infotip = d3.select("body").append("span") 
    .attr("class", "infotip")       
    .style("position", "absolute")
    .style("z-index", "10")
    .style("opacity", 0);

d3.select("#map").append("div")     
    .attr("id", "zoombox")

// Load map paths and country names
queue()
    .defer(d3.json, "data/world.json")
    .defer(d3.tsv, "data/world-country-names.tsv")
    .await(ready);

function ready(error, world, names) {
  var countries = topojson.object(world, world.objects.countries).geometries;
  var n = countries.length;

  countries.forEach(function(d) {
    var tryit = names.filter(function(n) { return d.id == n.id; })[0];
    if (typeof tryit === "undefined"){
      d.name = "Undefined";
      console.log(d);
    } else {
      d.name = tryit.name; 
    }
  });

  var country = svg_map.selectAll(".country").data(countries);

  country
   .enter()
    .insert("path")
    .attr("class", "country")    
    .attr("title", function(d,i) { return d.name; })
    .attr("d", path);

  // Display and Hide country name tooltip
  country
    .on("mousemove", function(d) {
      maphovertip
        .html(d.name)
        .style("opacity", 0.6);  
    })
    .on("mouseout",  function() {
      maphovertip
        .style("opacity", 0);  
    });
}

// ****************** Setup FreeDB Search Box ******************************* //
// FreeDB Service URL
var api_key = "AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY";
var freebase_url = "https://www.googleapis.com/freebase/v1";
var service_url = freebase_url + "/mqlread?key=" + api_key + "&callback=?";

// FreeDB Search Box 
$(function() {
  $("#myinput")
    .suggest({
      "key": api_key,
      filter: "(all type:/people/person)",
      animate: "false"})

    // Search Result Selected - Trigger Query
    .bind("fb-select", function(e, data) {
      svg_map.selectAll("circle").remove();
      svg_timeline.selectAll("rect").remove();
      $('#namebox').empty();
      $('#namebox').append("<h1>Loading...</h1>");

      // Query and parse one person's info; On completion calls plotOnMap
      getPersonInfo(data.id);
    });
});

// ****************** Parse Query & Create Nodes ******************************* //

// Parse query results into new object
// Degree 0 = origin node; 1 = influenced node; 2 = influenced_by node 
function createPersonNode(queryResult, degree) {
    var person = {};
    person.id = queryResult["id"];
    person.name = queryResult["name"];
    person.degree = degree;
    person.profession = queryResult["/people/person/profession"];
    person.nationality = queryResult["/people/person/nationality"];
    person.city = queryResult["/people/person/place_of_birth"]["name"];
    person.dob = queryResult["/people/person/date_of_birth"] || "Unknown";
    person.dod = queryResult["/people/deceased_person/date_of_death"] || "Unknown";    
    
    // Save standard geocoordinates
    person.coordinates = [queryResult["/people/person/place_of_birth"]["/location/location/geolocation"]["longitude"],
                          queryResult["/people/person/place_of_birth"]["/location/location/geolocation"]["latitude"]];

    // Translate geocoordinates into map coordinates
    person.x = projection(person.coordinates)[0];
    person.y = projection(person.coordinates)[1];

    // Filter DOB and DOD to YYYY format for timeline chart
    person.lived = [parseInt(person.dob.match(/[\-]?\d{4}/), 10),
                    parseInt(person.dod.match(/[\-]?\d{4}/), 10)];

    // Estimate lifespan if DOB or DOD unknown. Set to 0 if both unknown.
    if(isNaN(person.lived[0])) { person.lived[0] = (person.lived[1] - 80) || 0; }
    if(isNaN(person.lived[1])) { person.lived[1] = (person.lived[0] + 80) || 0; }
    if(person.lived[1] > thisYear) { person.lived[1] = thisYear; }

    // Change Unknown to Present if the person is probably still alive
    if((thisYear - person.lived[0]) < 100 && person.dod === "Unknown") { person.dod = "Present"; } 

    // Create empty influence lists as default
    person.infld = [];
    person.infld_by = [];

    // If they exist, load and process influence lists as arrays of PersonNodes
    var temp_infld = queryResult["/influence/influence_node/influenced"] || [];
    var temp_infld_by = queryResult["/influence/influence_node/influenced_by"] || [];
    for (var i = 0; i < temp_infld.length; i++) {
      person.infld[i] = createPersonNode(temp_infld[i], 1);
    }
    for (var j = 0; j < temp_infld_by.length; j++) {
      person.infld_by[j] = createPersonNode(temp_infld_by[j], 2);
    }

    // Set color according to distance from origin node
    // origin = black, influenced = blue, influenced_by = orange
    // var colors = ["#3B3B3B", "#4172E6", "#CC333F"];
    var colors = ["#332412", "#1B567A", "#C2412D"];
    person.color = colors[degree];

    return person;
}
function getPersonInfo(id) {
  var query = {
    "id": id,
    "name": null,
    "/people/person/place_of_birth": {
      "/location/location/geolocation": {
        "latitude": null,
        "longitude": null
      }
    },
    "/people/person/nationality": [],
    "/people/person/profession": [],
    "/people/person/date_of_birth": null,
    "/people/deceased_person/date_of_death": null,
    "/influence/influence_node/influenced_by": [{
      "id": null,
      "name": null,
      "/people/person/place_of_birth": {
        "name": null,
        "/location/location/geolocation": {
          "latitude": null,
          "longitude": null
        }
      },
      "/people/person/nationality": [],
      "/people/person/profession": [],
      "/people/person/date_of_birth": null,
      "/people/deceased_person/date_of_death": null
    }],
    "/influence/influence_node/influenced": [{
      "id": null,
      "name": null,
      "/people/person/place_of_birth": {
        "/location/location/geolocation": {
          "latitude": null,
          "longitude": null
        }
      },
      "/people/person/nationality": [],
      "/people/person/profession": [],
      "/people/person/date_of_birth": null,
      "/people/deceased_person/date_of_death": null
    }]
  };
  
  // Async Query Request
  $.getJSON(service_url, {query:JSON.stringify(query)}, function(q) {

    $('#namebox').empty();
    
    if(q.result == null) {
      $('#namebox').append("<h1>Sorry, not enough data to map this person.</h1>");
    } else {
      // Parse results into an origin node 
      var person = createPersonNode(q.result, 0);
      // Add namebox with basic info  
      var img_url = freebase_url + "/image" + person.id +  "?maxwidth=150&key=" + api_key;
      var personinfo = "<img class='biopic' src='" + img_url + "'><h1>" + person.name + "</h1><p>" 
        + "<br><strong>Lived:</strong> " + person.dob + " to " + person.dod 
        + "<br><strong>Country:</strong> " + person.nationality
        + "<br><strong>Profession:</strong> " + person.profession.join(", ") + "</p>";
      $('#namebox').append(personinfo);

      // Sends objects to put on map: origin, infld array, and infld_by array
      console.dir(person);
      plotOnMap(person.infld_by, 2);
      plotOnMap(person.infld, 1);
      plotOnMap([person], 0);
    }
  });
}

function plotOnMap(person, degree) {
  // Draw nodes on map
  svg_map
    .selectAll("circle degree_" + degree)
    .data(person)
    .enter()
    .append("circle")
    .attr("class", "point degree_" + degree)
    .attr("cx", function(d) { return d.x; })
    .attr("cy", function(d) { return d.y; })
    .attr("title", function(d) { return d.name; })
    .attr("fill", function(d) { return d.color; })
    .attr("opacity", 0.9)
    .on("mouseover", function(d) {
      // If name length is too long display last name only
      var resized_name = "";
      if(d.name.length > 23) {
        var split_name = d.name.split(" ");
        resized_name = split_name[split_name.length-1].substring(0,23);
      } else {
        resized_name = d.name;
      }
      infotip
        .style("opacity", 1)
        .text(resized_name);
      if(d.city != null) {
        maphovertip
          .html(d.city)
          .style("opacity", 0.6);
      }  
      d3.select(this)
        .attr("opacity", 1);
    })
    .on("mousemove", function() { 
      infotip
        .style("top", (d3.event.pageY-10)+"px")
        .style("left",(d3.event.pageX+28)+"px"); })
    .on("mouseout",  function(d) {
      infotip
        .style("opacity", 0);
      d3.select(this)
        .attr("opacity", 0.9);
      maphovertip
        .style("opacity", 0); 
    })
    .on("click",  function() {
      d3.select("#activepoint")
        // Remove old activepoint
        .attr("id", "")
        .transition()
        .attr("r", 1.25)
      d3.select(this)
        // Add new activepoint
        .attr("id", "activepoint")
        .transition()
        .attr("r", 3);
    })
    .attr("r", 10)
    .transition()
    .duration(500)
    .attr("r", function() { if(degree === 0) { return 3; } else { return 1.25; } });

  // Draw lifespans on timeline
  svg_timeline
    .selectAll("rect degree_" + degree)
    .data(person)
    .enter()
    .append("rect")
    .attr("class", "degree_" + degree)
    .attr("title", function(d) { return d.name; })
    .attr("x", function(d) { return xScale(d.lived[0]); })
    .attr("y", 0)
    .attr("width", function(d) { return xScale(d.lived[1]) - xScale(d.lived[0]); })
    .attr("height", 15)
    .attr("fill", function(d) { return d.color; })
    .attr("opacity", 0.8);
}