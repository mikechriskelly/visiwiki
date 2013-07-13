// ****************** Setup FreeDB Search Box ******************************* //
// FreeDB Service URL
var service_url = "https://www.googleapis.com/freebase/v1/mqlread?callback=?";

// FreeDB Search Box 
$(function() {
  $("#myinput")
    .suggest({
      "key": "AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY",
      filter:'(all type:/people/person)',
      animate: "false"})

    // Search Result Selected - Trigger Query
    .bind("fb-select", function(e, data) { 
      // Query and parse one person's info; On completion calls plotOnMap
      getPersonInfo(data.id, 0);
    });
});

// Set depth of graph search and node colors
var recur_limit = 2;
var colors = ['#f04c14', '#f5770d', '#faa807', '#ffdd00'];

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
    .attr("id", "timeline")
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

// Load map paths and country names
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

  var country = svg.selectAll(".country").data(countries);

  country
   .enter()
    .insert("path")
    .attr("class", "country")    
    .attr("title", function(d,i) { return d.name; })
    .attr("d", path);

  // Display and Hide country name tooltip
  country
    .on("mousemove", function(d,i) {
      maphovertip
        .html(d.name)
        .style("opacity", 0.6);  
    })
    .on("mouseout",  function(d,i) {
      maphovertip
        .style("opacity", 0);  
    });
}


// ****************** Query FreeDB  ******************************* //

function getPersonInfo(id, ndegree) {
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
    //console.dir(response.result[0]);

    // Store data in object
    var person = {};
    person.id = id;
    person.name = response.result[0]["name"][0];

    // Filter DOB and DOD to YYYY format
    person.dob = response.result[0]["/people/person/date_of_birth"][0];
    if(typeof person.dob == "undefined") { 
      person.dob = null;
    } else {
      person.dob = parseInt(person.dob.match(/[\-]?\d{4}/)[0], 10);
    }
    person.dod = response.result[0]["/people/deceased_person/date_of_death"][0];
    if(typeof person.dod == "undefined") { 
      if (person.dob > 1910) {
        var thisyear = new Date().getFullYear();
        person.dod = thisyear + 1;
      }  else if (person.dob != null) {
        person.dod = person.dob + 70;
      } else {
        person.dod = null;
      }
    } else {
      person.dod = parseInt(person.dod.match(/[\-]?\d{4}/)[0], 10);
    }

    person.city_id = response.result[0]["/people/person/place_of_birth"][0]["id"];
    person.city_name = response.result[0]["/people/person/place_of_birth"][0]["name"];
    person.profession = response.result[0]["/people/person/profession"].join(", "); 
    person.infld = response.result[0]["/influence/influence_node/influenced_by"];
    person.infby = response.result[0]["/influence/influence_node/influenced_by"];

    // Set color according to distance from origin node
    person.color = colors[ndegree];

    // Add namebox with basic info
    $("<p style='color:" + person.color + "'>",
      {text:person.name + " (" + person.dob + " to " + person.dod + "): " + person.profession})
      .appendTo(".nameboxes");

    // Sends info to put on map
    plotOnMap(person);

    // Recursive call for more nodes
    if(ndegree < recur_limit) {
      for (var i = 0; i < person.infld.length; i++) {
        getPersonInfo(person.infld[i]["id"], ndegree+1);
        //console.log(person.infld[i]["id"]);
      }
    }
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
    try {
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
        .attr("fill", person.color)
        .on("mouseover", function(d,i) {
            maphovertip
              .html(person.name)
              .style("opacity", 0.6);  
          d3.select(this)
            // Add node hover effects
            .classed("hoverpoint", true)
            .transition()
            .attr("r", 6)
        })
        .on("mouseout",  function(d,i) {
            maphovertip
              .html(person.name)
              .style("opacity", 0);  
          d3.select(this)
            // Remove node hover effects
            .classed("hoverpoint", false)
            .transition()
            .attr("r", 4)
        })
        .on("click",  function(d,i) {
          d3.select("#activepoint")
            // Remove old activepoint
            .attr("id", "")
            .transition()
            .attr("r", 4) 
          d3.select(this)
            // Add new activepoint
            .classed("activepoint", false)
            .attr("id", "activepoint")
            .transition()
            .attr("r", 6)
        });

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
          .attr("opacity", 0.8)
    } catch(err) {
      console.log("Location unknown");
    }
  });
}