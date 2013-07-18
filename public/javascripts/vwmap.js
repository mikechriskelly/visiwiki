// ****************** Render SVG Map & Timeline ******************************* //
// Map Setup
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

function redraw() {
    svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

// Timeline Setup
var svg_timeline = d3.select("#map").append("svg")
    .attr("id", "timeline");
var xScale = d3.scale.linear()
             .domain([-1000, 2013])
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
var infotip = d3.select("body").append("div") 
    .attr("class", "tooltip")         
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

  var country = svg.selectAll(".country").data(countries);

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
var service_url = "https://www.googleapis.com/freebase/v1/mqlread?key=" + api_key + "&callback=?";

// FreeDB Search Box 
$(function() {
  $("#myinput")
    .suggest({
      "key": api_key,
      filter: "(all type:/people/person)",
      animate: "false"})

    // Search Result Selected - Trigger Query
    .bind("fb-select", function(e, data) {
      svg.selectAll("circle").remove();
      svg_timeline.selectAll("rect").remove();
      $('#namebox').empty();

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
    person.dob = queryResult["/people/person/date_of_birth"] || "Unknown";
    person.dod = queryResult["/people/deceased_person/date_of_death"] || "Unknown";
    person.coordinates = [queryResult["/people/person/place_of_birth"]["/location/location/geolocation"]["longitude"],
                          queryResult["/people/person/place_of_birth"]["/location/location/geolocation"]["latitude"]];

    // Filter DOB and DOD to YYYY format for timeline chart
    // Estimate lifespan if DOD unknown
    person.lived = [NaN, NaN];
    person.lived[0] = parseInt(person.dob.match(/[\-]?\d{4}/), 10);
    person.lived[1] = parseInt(person.dod.match(/[\-]?\d{4}/), 10) || person.lived[0] + 80;

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
    // Original (Black) / Infld (Blue) / Infby (Orange)
    var colors = ["#3B3B3B", "#4172E6", "#CC333F"];
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
    // Parse results into an origin node 
    var person = createPersonNode(q.result, 0);

    // Add namebox with basic info
    var personinfo = "<h1>" + person.name + " (" + person.dob + " to " + person.dod + ") " + person.profession.join(", ") + "</h1><ul></ul>";
    $('#namebox').append(personinfo);
 
    console.dir(person);
    // Sends info to put on map
    plotOnMap(person);
  });
}

function plotOnMap(person) {
  // Parse coordinates  
  var x = projection(person.coordinates)[0];
  var y = projection(person.coordinates)[1];

  // Draw node
  svg.append("svg:circle")
    .attr("class","point")
    .attr("cx", x)
    .attr("cy", y)
    .attr("title", person.name)
    .attr("fill", person.color)
    .attr("opacity", 0.8)
    .on("mouseover", function(d,i) {
        maphovertip
          .html(person.name)
          .style("opacity", 0.6);  
      d3.select(this)
        // Add node hover effects
        .transition()
        .attr("fill", "#ffff00")
    })
    .on("mouseout",  function(d,i) {
        maphovertip
          .html(person.name)
          .style("opacity", 0);  
      d3.select(this)
        // Remove node hover effects
        .transition()
        .attr("fill", person.color)
    })
    .on("click",  function(d,i) {
      d3.select("#activepoint")
        // Remove old activepoint
        .attr("id", "")
        .transition()
        .attr("r", 2)
      d3.select(this)
        // Add new activepoint
        .attr("id", "activepoint")
        .transition()
        .attr("r", 5);
    })
    .attr("r", 10)
    .transition()
    .duration(500)
    .attr("r", 2);

    // Draw timeline
    svg_timeline.append("svg:rect")
      .attr("title", person.name)
      .attr("x", function(d) {
        return xScale(person.dob);
      })
      .attr("y", 0)
      .attr("width", function(d) {
        return xScale(person.dod) - xScale(person.dob);
      })
      .attr("height", 15)
      .attr("fill", person.color)
      .attr("opacity", 0.8);
}