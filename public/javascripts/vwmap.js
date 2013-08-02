	//--------------------------------------------------------------------------
	// Utility functions

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
		} else if (year == 0) { // Year 0 is '1 BC'
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
		bcString = bcString || " BC" // With blank!
		var year = date.getUTCFullYear();
		if (year > 0) return year.toString();
		if (bcString[0] == '-') return bcString + (-year);
		return (-year) + bcString;
	}



$(document).ready(function() {
	//--------------------------------------------------------------------------
	// Render SVG map
	var mapW  = $("#map").width();
	var mapH = mapW / 2.25;
	console.log("mapW: " + mapW);

	var projection = d3.geo.mercator()

	var path = d3.geo.path().projection(projection);

	var zoom = d3.behavior.zoom()
		.scaleExtent([1,10])
		.on("zoom", redraw);

	var mapSVG = d3.select("#map").append("svg")
		.attr("viewBox", "0 0 900 400" )
		.attr("preserveAspectRatio", "xMidYMid meet")
		.attr("pointer-events", "all")
		.call(zoom)
		.append("g");

	function redraw() {
		mapSVG.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
	}

	// Tip box for country names
	var maphovertip = d3.select("#map").append("span")
			.attr("class", "maphovertip")
			.style("opacity", 0);

	// Tip box for people names 
	var infotip = d3.select("body").append("span") 
			.attr("class", "infotip")       
			.style("position", "absolute")
			.style("z-index", "10")
			.style("opacity", 0);

	// Load map paths and country names
	queue()
			.defer(d3.json, "/data/world.json")
			.defer(d3.tsv, "/data/world-country-names.tsv")
			.defer(d3.csv, "/data/philosophers.csv")
			.await(ready);

	function ready(error, world, names, philosophers) {
		// Read in the data and construct the timeline
		timeline("#timeline")
				.data(philosophers)
				.band("mainBand", 0.7)
				.band("naviBand", 0.10)
				.xAxis("mainBand")
				.tooltips("mainBand")
				.xAxis("naviBand")
				.labels("mainBand")
				.labels("naviBand")
				.brush("naviBand", ["mainBand"])
				.redraw();

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
				getPersonInfo("/" + jshare.id.join("/"));
			}
			if(typeof jshare !== "undefined" && jshare.id.length === 2) {
				getPersonInfo("/" + jshare.id.join("/"));
			}
	}

	//--------------------------------------------------------------------------
	// FreeBase API settings
	var fbKey = "AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY";
	var fbURL = "https://www.googleapis.com/freebase/v1";
	var fbCall = fbURL + "/mqlread?key=" + fbKey + "&callback=?";

	// FreeBase Search Box 
	$(function() {
		$("#fbinput")
			.suggest({
				"key": fbKey,
				filter: "(all type:/people/person)",
				animate: "false"})

			// Search Result Selected - Trigger Query
			.bind("fb-select", function(e, data) {
				// Clear existing results from map -- including origin node
				mapSVG.selectAll("circle").remove();
				mapSVG.selectAll("circle").remove();
				mapSVG.selectAll("line").remove();
				// Query and parse one person's info; On completion calls plotOnMap
				getPersonInfo(data.id);
			});
	});

	//--------------------------------------------------------------------------
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
			person.dob = parseDate(queryResult["/people/person/date_of_birth"] || null);
			person.dod = parseDate(queryResult["/people/deceased_person/date_of_death"] || null);

			// Estimate lifespan if DOB or DOD unknown.
			var today = new Date(),
				yearMillis = 31622400000;
			person.lived = []
			if(person.dob === null) { 
				person.lived[0] = "Unknown"; 
				if(person.dod !== null) { person.dob = person.dod-(yearMillis*70); }
			} else {
				person.lived[0] = toYear(person.dob);
			}
			if(person.dod === null) {
				(today-person.dob < yearMillis*100)? person.lived[1] = "Present" : person.lived[1] = "Unknown";
				if(person.dob !== null) { person.dod = person.dob+(yearMillis*70); }
			} else {
				person.lived[1] = toYear(person.dod);
			}
						
			// Save standard geocoordinates
			person.coordinates = [queryResult["/people/person/place_of_birth"]["/location/location/geolocation"]["longitude"],
														queryResult["/people/person/place_of_birth"]["/location/location/geolocation"]["latitude"]];

			// Translate geocoordinates into map coordinates
			person.x = projection(person.coordinates)[0];
			person.y = projection(person.coordinates)[1];

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
	function getPersonInfo(id, drawLine) {
		$('#namebox').empty();
		$('#namebox').append("<h3>Loading...</h3>");
		//console.log(id);

		var queryInfluence = {
			"id": id,
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
		
		var queryProfession = {
			"id": "/m/02h6fbs",
			"name": null,
			"/people/profession/people_with_this_profession": [{
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
				"/people/deceased_person/date_of_death": null,
				"limit": 2
			}]
		};

		// Async Query Request
		$.getJSON(fbCall, {query:JSON.stringify(queryInfluence)}, function(q) {

			$('#namebox').empty();
			console.dir(q.result);
			
			if(q.result == null) {
				$('#namebox').append("<h3>Sorry, not enough data to map this person.</h3>");
			} else {
				if(drawLine) {
					mapSVG
						.append("line")
						.attr("stroke", "#332412")
						.attr("stroke-width", 1)
						.attr("x1", function() { return mapSVG.select("circle.degree-0").attr("cx"); })
						.attr("y1", function() { return mapSVG.select("circle.degree-0").attr("cy"); })
						.attr("x2", drawLine[0])
						.attr("y2", drawLine[1]);
					mapSVG
						.selectAll(".degree-0")
						.attr("class", "degree-10")
				}
				// Clear existing results from map, except old origin node (degree-10)
				mapSVG.selectAll(".degree-0").remove();
				mapSVG.selectAll(".degree-1").remove();
				mapSVG.selectAll(".degree-2").remove();

				// Parse results into an origin node 
				var person = createPersonNode(q.result, 0);
				console.dir(person);
				// Add namebox with basic info  
				var img_width = 64;
				var img_url = fbURL + "/image" + person.id +  "?maxwidth=" + img_width + "&key=" + fbKey;
				var personinfo = "<div class='media'><img class='media-object pull-left' src='" + img_url + "'><div class='media-body'><h3 class='media-heading'>"
				+ person.name + "</h3><label class='label label-info'>" + person.lived[0] + " to " + person.lived[1] + "</label></div></div>" 
				+ "<table class='table table-condensed' id='namebox-prof'></table>";

				$('#namebox').append(personinfo);

				for (var i in person.profession) {
					 $('#namebox-prof').append('<tr><td>' + person.profession[i] + '</td></tr>');
				}        

				// Sends objects to put on map: origin, infld array, and infld_by array
				plotOnMap([person], 0);
				plotOnMap(person.infld_by, 2);
				plotOnMap(person.infld, 1);

				var zoomScale = 5;
				var trans = [(-person.x * zoomScale + mapW/2),(-person.y * zoomScale + mapH/2)];
				mapSVG
					.transition()
					.duration(450)
					.attr("transform", "translate(" + trans[0] + "," + trans[1] + ")scale(" + zoomScale + ")");
				zoom.scale(zoomScale);
				zoom.translate([trans[0], trans[1]]);
			}
		});
	}

	function plotOnMap(person, degree) {
		// Draw nodes on map
		mapSVG
			.selectAll(".degree-" + degree)
			.data(person)
			.enter()
			.append("circle")
			.attr("class", "degree-" + degree)
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
					.style("width", "175px")
					.style("top", (d3.event.pageY-10)+"px")
					.style("left",(d3.event.pageX+28)+"px"); })
			.on("mouseout",  function(d) {
				infotip
					.style("opacity", 0)
					.text("")
					.style("width", "1px")
				d3.select(this)
					.attr("opacity", function(d) { if(d.degree === 0) { return 1; } else { return 0.9; } });
				maphovertip
					.style("opacity", 0); 
			})
			.on("click", function(d) { getPersonInfo(d.id, [d.x, d.y]); })
			.attr("r", function() { if(degree === 0) { return 2.5; } else { return 0.9; } });
	}
})