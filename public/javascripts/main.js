//--------------------------------------------------------------------------
// Load Modules
d3.timeline = require('./timeline.js');
var queue = require('./queue.v1.min.js');
var topojson = require('./topojson.js');

//--------------------------------------------------------------------------
// FreeBase API settings
var fbKey = "AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY";
var fbURL = "https://www.googleapis.com/freebase/v1";
var fbCall = fbURL + "/mqlread?key=" + fbKey + "&callback=?";

// Node Colors
// origin = black, influenced = blue, influenced_by = orange, placeslived = light brown
var colors = ["#332412", "#1B567A", "#C2412D", "#332412"];

//--------------------------------------------------------------------------
// Utility Functions

function parseDate(dateString) {
	// 'dateString' must either conform to the ISO date format YYYY-MM-DD
	// or be a full year without month and day.
	// AD years may not contain letters, only digits '0'-'9'!
	// Invalid AD years: '10 AD', '1234 AD', '500 CE', '300 n.Chr.'
	// Valid AD years: '1', '99', '2013'
	// BC years must contain letters or negative numbers!
	// Valid BC years: '1 BC', '-1', '12 BCE', '10 v.Chr.', '-384'
	// A dateString of '0' will be converted to '1 BC'.
	// Because JavaScript can't define AD years between 0..99,
	// these years require a special treatment.

	var format = d3.time.format("%Y-%m-%d"),
		date,
		year;
	if (dateString === null) return null;
	date = format.parse(dateString);
	if (date !== null) return date;

	// BC yearStrings are not numbers!
	if (isNaN(dateString)) { // Handle BC year
		// Remove non-digits, convert to negative number
		year = -(dateString.replace(/[^0-9]/g, ""));
	} else { // Handle AD year
		// Convert to positive number
		year = +dateString;
	}
	if (year < 0 || year > 99) { // 'Normal' dates
		date = new Date(year, 6, 1);
	} else if (year === 0) { // Year 0 is '1 BC'
		date = new Date (-1, 6, 1);
	} else { // Create arbitrary year and then set the correct year
		// For full years, I chose to set the date to mid year (1st of July).
		date = new Date(year, 6, 1);
		date.setUTCFullYear(("0000" + year).slice(-4));
	}
	// Finally create the date
	return date;
}
function toYear(date, bcString) {
	// bcString is the prefix or postfix for BC dates.
	// If bcString starts with '-' (minus),
	// if will be placed in front of the year.
	if (date === null) return null;
	if (!(date instanceof Date)) { date = new Date(date); }
	bcString = bcString || " BC"; // With blank!
	var year = date.getUTCFullYear();
	if (year > 0) return year.toString();
	if (bcString[0] == '-') return bcString + (-year);
	return (-year) + bcString;
}

$(document).ready(function() {
	//--------------------------------------------------------------------------
	// Map Setup
	var mapW  = 800,
		mapH = 480;
	var projection = d3.geo.mercator().translate([mapW / 2, mapH / 1.5]);
	var path = d3.geo.path().projection(projection);
	var zoom = d3.behavior.zoom()
		.scaleExtent([1,10])
		.on("zoom", redraw);

	var mapSVG = d3.select("#map").append("svg")
		.attr("width", "100%")
		.attr("height", "60%")
		.attr("viewBox", "0 0 " + mapW + " " + mapH )
		.attr("preserveAspectRatio", "xMidYMid meet")
		.attr("pointer-events", "all")
		.call(zoom)
		.append("g");

	function redraw() {
		mapSVG.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
	}

	// Timeline Setup - full timeline
	var nearFuture = new Date().getUTCFullYear()+50;
	var timeline = {};
	timeline.start = new Date(-1400, 1, 1);
	timeline.end = new Date(nearFuture, 1, 1);
	timeline.w = $(document).width();
	timeline.h = 50;

	var timelineSVG = d3.select("#fulltime").append("svg")
		.attr("width", timeline.w)
		.attr("height", timeline.h)
		.attr("preserveAspectRatio", "none")
		.attr("pointer-events", "all");
	var xScale = d3.scale.linear()
		.domain([timeline.start, timeline.end])
		.range([10, timeline.w-10]);
	var axis = d3.svg.axis()
		.scale(xScale)
		.orient("bottom")
		.tickValues([new Date(-1000,1,1), new Date(-500,1,1), new Date(-1,1,1), new Date(500,1,1), new Date(1000,1,1), new Date(1500,1,1), new Date(2000,1,1)])
		.tickSize(6,3,6)
		.tickSubdivide(1)
		.tickFormat(function (d) { return toYear(d); });
	var xAxis = timelineSVG.append("g")
		.attr("class", "axis")
		.attr("transform", "translate(0, 28)");

	xAxis.call(axis);

	// Timeline Setup - zoomed timeline
	var zoomtime = d3.timeline()
		.width(timeline.w*6)
		.height(200)
		.margin({left:0, right:0, top:0, bottom:0})
		.click(function (d, i, datum) {
			//alert(datum.label);
		});

	var zoomtimeSVG = d3.select("#zoomtime").append("svg").attr("width", timeline.w);

	// Tip box for country names
	var maphovertip = d3.select("#map").append("span")
			.attr("class", "maphovertip")
			.style("opacity", 0);

	// Tip box for people names 
	var infotip = d3.select("body").append("span") 
			.attr("class", "infotip")       
			.style("position", "absolute")
			.style("z-index", "12")
			.style("opacity", 0);

	function updateNamebox(content) {
		$('#namebox').empty();
		if(typeof content !== undefined) $('#namebox').append(content);		
	}
	function updateNameboxPerson(person) {
		$('#namebox').empty();
		var w = 75;
		var imgURL = fbURL + "/image" + person.id +  "?maxwidth=" + w + "&key=" + fbKey;
		var personInfo = "<div class='media'><img class='media-object pull-left' src='" + imgURL + "'><div class='media-body'><h3 class='media-heading'>" + person.name + "</h3>";

		var i;
		// List professions labels (max 3)
		for (i = 0; i < person.profession.length && i < 3; i++) {
			personInfo += "<span class='label label-success'>" + person.profession[i] + "</span>";
		}
		// List school or movement or period labels (max 3)
		for (i = 0; i < person.movements.length && i < 3; i++) {
			if(i === 0) personInfo += "<br>";
			personInfo += "<span class='label label-warning'>" + person.movements[i] + "</span>";
		}
		personInfo += "<br><span class='label label-info'>" + person.lived[0] + " - " + person.lived[1] + "</span></div></div>";
		// if(typeof person.description === "string") {
		// 	personInfo += "<p>" + person.description.substring(0,270) + "</p>";
		// }
		$('#namebox').append(personInfo);

		// Display Influences, Peers, Written Works, Art Works, and Inventions if found
		$('#namebox').append("<ul class='nav nav-pills nav-stacked' id='nameboxnav'></ul>");
		if(person.countInfluenced > 0) 
			$('#nameboxnav').append("<li class='active'><a href='#'>Places Lived<span class='badge pull-right'>" + person.countPlacesLived + "</span></a></li>");
		if(person.countInfluenced > 0) 
			$('#nameboxnav').append("<li><a href='#'>Influences<span class='badge pull-right'>" + person.countInfluenced + "</span></a></li>");
		if(person.countPeers > 0) 
				$('#nameboxnav').append("<li><a href='#'>Peers<span class='badge pull-right'>" + person.countPeers + "</span></a></li>");
		if(person.countWritWorks > 0)
				$('#nameboxnav').append("<li><a href='#'>Written Works<span class='badge pull-right'>" + person.countWritWorks + "</span></a></li>");
		if(person.countArtWorks > 0) 
				$('#nameboxnav').append("<li><a href='#'>Art Works<span class='badge pull-right'>" + person.countArtWorks + "</span></a></li>");
		if(person.countInventions > 0) 
				$('#nameboxnav').append("<li><a href='#'>Inventions<span class='badge pull-right'>" + person.countInventions + "</span></a></li>");
	}
	function clearAllNodes() {
		// Clear existing results from map and timelinea
		mapSVG.selectAll("circle").remove();
		timelineSVG.selectAll(".degree-0").remove();
		timelineSVG.selectAll(".degree-1").remove();
		timelineSVG.selectAll(".degree-2").remove();
		zoomtimeSVG.selectAll("g").remove();
	}

	//--------------------------------------------------------------------------
	// Parse query results into new object
	// Degree 0 = origin node; 1 = influenced node; 2 = influenced_by node 
	function newPeople(queryResult, degree) {
		var people = [];
		for (var i = 0; i < queryResult.length; i++) {
			people[i] = {};
			people[i].id = queryResult[i]["id"] || null;
			people[i].name = queryResult[i]["name"] || null;
			people[i].label = queryResult[i]["name"] || null;
			people[i].degree = degree || 0;
			people[i].profession = queryResult[i]["/people/person/profession"] || [];
			people[i].nationality = queryResult[i]["/people/person/nationality"] || null;
			people[i].city = queryResult[i]["/people/person/place_of_birth"]["name"] || null;
			people[i].start = parseDate(queryResult[i]["/people/person/date_of_birth"] || null);
			people[i].end = parseDate(queryResult[i]["/people/deceased_person/date_of_death"] || null);
			people[i].description = queryResult[i]["/common/topic/description"] || null;

			people[i].countInfluenced = parseInt(queryResult[i]["c:/influence/influence_node/influenced"] || 0);
			people[i].countInfluencedBy = parseInt(queryResult[i]["c:/influence/influence_node/influenced_by"] || 0);
			people[i].countPeers = parseInt(queryResult[i]["c:/influence/influence_node/peers"] || 0);
			people[i].countWritWorks = parseInt(queryResult[i]["c:/book/author/works_written"] || 0);
			people[i].countArtWorks = parseInt(queryResult[i]["c:/visual_art/visual_artist/artworks"] || 0);
			people[i].countInventions = parseInt(queryResult[i]["c:/law/inventor/inventions"] || 0);
			people[i].countPlacesLived = queryResult[i]["/people/person/places_lived"].length || 1;

			var movementA = queryResult[i]["/visual_art/visual_artist/associated_periods_or_movements"] || [];
			var movementB = queryResult[i]["/book/author/school_or_movement"] || [];
			people[i].movements = movementA.concat(movementB);

			people[i].instant = false;

			// Estimate lifespan if DOB or DOD unknown.
			var today = new Date(),
				yearMillis = 31622400000;
			people[i].lived = [];
			
			if(people[i].start === null) { 
				people[i].lived[0] = "Unknown"; 
				if(people[i].end !== null) { people[i].start = new Date(people[i].end-(yearMillis*70)); }
			} else {
				people[i].lived[0] = toYear(people[i].start);
			}
			if(people[i].end === null) {
				if(people[i].start !== null) { 
					if(today-people[i].start < yearMillis*100) {
						people[i].lived[1] = "Present";
						people[i].end = today;
					} else {
						people[i].lived[1] = "Unknown";
						people[i].end = new Date(people[i].start+(yearMillis*70)); 
					}
				}
			} else {
				people[i].lived[1] = toYear(people[i].end);
			}

			// Save standard geocoordinates
			people[i].coordinates = [queryResult[i]["/people/person/place_of_birth"]["/location/location/geolocation"]["longitude"],
															queryResult[i]["/people/person/place_of_birth"]["/location/location/geolocation"]["latitude"]] || [0,0];

			// Translate geocoordinates into map coordinates
			people[i].x = projection(people[i].coordinates)[0];
			people[i].y = projection(people[i].coordinates)[1];

			// Create empty influence lists as default
			people[i].infld = [];
			people[i].infld_by = [];

			people[i].color = colors[degree];
		}
		return people;
	}
	function newPlaces(queryResult) {
		var places = [];
		for (var i = 0; i < queryResult.length; i++) {
			places[i] = {};
			places[i].name = queryResult[i]["location"]["name"] || "Unknown";
			places[i].city = places[i].name;
			places[i].degree = 3;
			places[i].color = colors[3];

			// Save standard geocoordinates
			places[i].coordinates = [queryResult[i]["location"]["/location/location/geolocation"]["longitude"],
																		queryResult[i]["location"]["/location/location/geolocation"]["latitude"]] || [0,0];

			// Translate geocoordinates into map coordinates
			places[i].x = projection(places[i].coordinates)[0];
			places[i].y = projection(places[i].coordinates)[1];
		}
		return places;
	}
	function getProfession(id) {
		updateNamebox("<h3>Loading...</h3>");
		var query = {
			"id": "/m/02h6fbs",
			"name": null,
			"/common/topic/description": null,
			"/people/profession/people_with_this_profession": [{
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
				"/people/deceased_person/date_of_death": null,
				"limit": 100
			}]
		};
		// Async Query Request
		$.getJSON(fbCall, {query:JSON.stringify(query)}, function(q) {
			if(q.result === null) {
				updateNamebox("<h3>Sorry, not enough data to map people in this profession.</h3>");
			} else {
				clearAllNodes();
				var people = newPeople((q.result["/people/profession/people_with_this_profession"] || []), 1);

				// Add namebox with basic info  
				var imgWidth = 64;
				var imgURL = fbURL + "/image" + q.result.id +  "?maxwidth=" + imgWidth + "&key=" + fbKey;
				var personInfo = "<div class='media'><img class='media-object pull-left' src='" + imgURL + "'><div class='media-body'><h3 class='media-heading'>" + q.result.name + "</h3></div></div><p>" +   q.result["/common/topic/description"] + "</p>";
				updateNamebox(personInfo);
				plotOnMap(people);
				plotOnTimeline(people);
			}
		});
	}
	function getPerson(id) {
		updateNamebox("<h3>Loading...</h3>");
		var query = {
			"id": id,
			"name": null,
			"/common/topic/description": null,
			"/people/person/place_of_birth": {
				"name": null,
				"/location/location/geolocation": {
					"latitude": null,
					"longitude": null
				}
			},
			"/people/person/places_lived": [{
				"location": {
					"name": null,
					"/location/location/geolocation": {
						"latitude": null,
						"longitude": null
					}
				},
				"optional": true
			}],
			"/people/person/profession": [],
			"/people/person/date_of_birth": null,
			"/people/deceased_person/date_of_death": null,
			"c:/influence/influence_node/influenced_by": [{
				"return": "count",
				"optional": true
			}],
			"c:/influence/influence_node/influenced": [{
				"return": "count",
				"optional": true
			}],
			"c:/influence/influence_node/peers": [{
				"return": "count",
				"optional": true
			}],
			"c:/book/author/works_written": [{
				"optional": true,
				"return": "count"
			}],
			"c:/visual_art/visual_artist/artworks": [{
				"optional": true,
				"return": "count"
			}],
			"c:/law/inventor/inventions": [{
				"optional": true,
				"return": "count"
			}],
			"/visual_art/visual_artist/associated_periods_or_movements": [],
			"/book/author/school_or_movement": []
		};
		// Async Query Request
		$.getJSON(fbCall, {query:JSON.stringify(query)}, function(q) {
			if(q.result === null) {
				updateNamebox("<h3>Sorry, not enough data about this person.</h3>");
			} else {
				clearAllNodes();
				var person = newPeople([q.result], 0)[0];
				var places = newPlaces([q.result][0]["/people/person/places_lived"]);
				updateNameboxPerson(person);
				if(places.length > 0) {
					plotOnMap([person].concat(places));
				} else {
					plotOnMap([person]);
				}
				plotOnTimeline([person]);
			}
		});
	}
	function getInfluences(id) {
		updateNamebox("<h3>Loading...</h3>");
		var query = {
			"id": id,
			"name": null,
			"/common/topic/description": null,
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
			}]
		};
		// Async Query Request
		$.getJSON(fbCall, {query:JSON.stringify(query)}, function(q) {
			if(q.result === null) {
				updateNamebox("<h3>Sorry, not enough data to map influences for this person.</h3>");
			} else {
				clearAllNodes();
				var origin = newPeople([q.result], 0);
				var influenced = newPeople((q.result["/influence/influence_node/influenced"] || []), 1);
				var influencedBy = newPeople((q.result["/influence/influence_node/influenced_by"] || []), 2);
				var people = origin.concat(influenced).concat(influencedBy);

				updateNameboxPerson(people[0]);
				plotOnMap(people);
				plotOnTimeline(people);
			}
		});
	}
	function plotOnTimeline(people) {
		// Full Timeline
		timelineSVG
			.selectAll("circle")
			.data(people)
			.enter()
			.append("rect")
			.attr("class", function(d) { return "degree-" + d.degree; })
			.attr("title", function(d) { return d.name; })
			.attr("x", function(d) { return xScale(d.start); })
			.attr("y", 12)
			.attr("width", function(d) { return xScale(d.end) - xScale(d.start); })
			.attr("height", 10)
			.attr("fill", function(d) { return d.color; })
			.attr("opacity", 0.6);

		// Zoom Timeline		
		var timelineData = [];
		for(i = 0; i < people.length; i++) {
			timelineData.push({label: people[i].name, times: [{"start": people[i].start, "end": people[i].end}]});
		}
		zoomtimeSVG.datum(timelineData).call(zoomtime);
	}
	function plotOnMap(people) {
		// Draw nodes on map
		mapSVG
			.selectAll("circle")
			.data(people)
			.enter()
			.append("circle")
			.attr("class", function(d) { return "degree-" + d.degree; })
			.attr("cx", function(d) { return d.x; })
			.attr("cy", function(d) { return d.y; })
			.attr("title", function(d) { return d.name; })
			.attr("fill", function(d) { return d.color; })
			.attr("opacity", function(d) { if(d.degree === 0) { return 1; } else { return 0.9; } })
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
				if(d.city !== null) {
					maphovertip
						.html(d.city)
						.style("opacity", 0.6);
				}  
				d3.select(this)
					.attr("opacity", 1);
			})
			.on("mousemove", function() { 
				infotip
					.style("width", "175px")
					.style("top", (d3.event.pageY-10)+"px")
					.style("left",(d3.event.pageX+28)+"px"); })
			.on("mouseout",  function(d) {
				infotip
					.style("opacity", 0)
					.text("")
					.style("width", "1px");
				d3.select(this)
					.attr("opacity", function(d) { if(d.degree === 0) { return 1; } else { return 0.9; } });
				maphovertip
					.style("opacity", 0); 
			})
			.on("click", function(d) { if(d.degree !== 3) getInfluences(d.id); })
			.attr("r", function(d) { if(d.degree === 0) { return 2.5; } else { return 0.9; } });

		// Zoom to origin node
		if(people[0].degree === 0) {
			var zoomScale = 5;
			var trans = [(-people[0].x * zoomScale + mapW/2),(-people[0].y * zoomScale + mapH/2)];
			mapSVG
				.transition()
				.duration(450)
				.attr("transform", "translate(" + trans[0] + "," + trans[1] + ")scale(" + zoomScale + ")");
			zoom.scale(zoomScale);
			zoom.translate([trans[0], trans[1]]);
		}
	}

	//--------------------------------------------------------------------------
	// Main execution when everything is loaded
	function ready(error, world, names) {

		var countries = topojson.object(world, world.objects.countries).geometries;
		var n = countries.length;

		countries.forEach(function(d) {
			var tryit = names.filter(function(n) { return d.id == n.id; })[0];
			if (typeof tryit === "undefined"){
				d.name = "Undefined";
				//console.log(d);
			} else {
				d.name = tryit.name; 
			}
		});

		var country = mapSVG.selectAll(".country").data(countries);

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

			// If received ID from URL then start query
			if(typeof jshare !== "undefined" && jshare.id.length === 2) {
				getPerson("/" + jshare.id.join("/"));
			}
			if(typeof jshare !== "undefined" && jshare.id.length === 2) {
				getPerson("/" + jshare.id.join("/"));
			}
			//getProfession();
	}

	// Load map paths and country names
	queue()
		.defer(d3.json, "/data/world.json")
		.defer(d3.tsv, "/data/world-country-names.tsv")
		.await(ready);

	// FreeBase Search Box 
	$(function() {
		$("#fbinput")
			.suggest({
				"key": fbKey,
				filter: "(all type:/people/person)",
				animate: "false"})
			// Search Result Selected - Trigger Query
			.bind("fb-select", function(e, data) {
				clearAllNodes();
				getPerson(data.id);
			});
	});
});