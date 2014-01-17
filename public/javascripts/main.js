//--------------------------------------------------------------------------
// Load Modules
var queue = require('./queue.v1.min.js');
var topojson = require('./topojson.js');

//--------------------------------------------------------------------------
// FreeBase API settings
var fbKey = 'AIzaSyDkle0NnqmA1_SRl0tfj4MOEQbTigNZkdY';
var fbURL = 'https://www.googleapis.com/freebase/v1';
var fbCall = fbURL + '/mqlread?key=' + fbKey + '&callback=?';

// Wiki API Settings and AJAX
var wikiCall = 'http://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exchars=630&exintro&explaintext&titles=';

function setHeader(xhr) {
	xhr.setRequestHeader('user_agent', 'VisiWiki (http://visiwiki.herokuapp.com; mikechriskelly@gmail.com)');
}
function getWikiText(name) {
	$.ajax({
		url: wikiCall + name,
		type: 'GET',
		dataType: 'jsonp',
		success: function(qr) {
			$.each(qr.query.pages, function(key, val) {
				$('#namebox').append('<p>' + val.extract.replace(/ *\([^)]*\) */g, " ") + ' <a href="http://en.wikipedia.org/wiki?curid=' + val.pageid + '"><i class="fa fa-external-link"></i></a></p>');
				$('#namebox').append('<p class="legend"><i class="fa fa-circle fa-2x color-origin"></i> ' + name 
					+ '<br><i class="fa fa-circle fa-2x color-influences"></i> Influences'
					+ '<br><i class="fa fa-circle fa-2x color-influencedby"></i> Was influenced by</p>');
				return false;
			}); 
		},
		error: function() { console.log('Wikipedia AJAX failed'); },
	});
}
//--------------------------------------------------------------------------
// Node Colors
// origin = black, influenced = blue, influenced_by = orange
var colors = ['#332412', '#1B567A', '#C2412D', '#332412'];

//--------------------------------------------------------------------------
// Time Functions

function parseDate(dateString) {
	// Accept ISO date format YYYY-MM-DD or try to parse date from string
	// BC years must contain letters or negative numbers!
	// Valid BC years: '1 BC', '-1', '12 BCE', '10 v.Chr.', '-384'
	// A dateString of '0' will be converted to '1 BC'.
	// Because JavaScript can't define AD years between 0..99,
	// these years require a special treatment.

	var format = d3.time.format('%Y-%m-%d'),
		date,
		year;

	if (dateString === null || dateString === undefined) return null;
	date = format.parse(dateString);
	if (date instanceof Date && isFinite(date)) return date;

	if (dateString.match(/(BC|bc|Bc|^-[0-9]{3,4})/) !== null) { // Handle BC year
		// Remove non-digits, convert to negative number
		year = -(dateString.match(/[0-9]{3,4}/, ''));
	} else { // Handle AD year
		// Convert to positive number
		year = +(dateString.match(/[0-9]{3,4}/, ''));
	}
	if (year < 0 || year > 99) { // 'Normal' dates
		date = new Date(year, 6, 1);
	} else if (year === 0) { // Year 0 is '1 BC'
		date = new Date (-1, 6, 1);
	} else { // Create arbitrary year and then set the correct year
		// For full years, I chose to set the date to mid year (1st of July).
		date = new Date(year, 6, 1);
		date.setUTCFullYear(('0000' + year).slice(-4));
	}
	return date;
}
function toYear(date, bcString) {
	// bcString is the prefix or postfix for BC dates.
	// If bcString starts with '-' (minus), it will be placed in front of the year.
	if (date === null) return null;
	if (!(date instanceof Date)) { date = new Date(date); }
	bcString = bcString || ' BC'; // With blank!
	var year = date.getUTCFullYear();
	if (year > 0) return year.toString();
	if (bcString[0] == '-') return bcString + (-year);
	return (-year) + bcString;
}


//--------------------------------------------------------------------------
// Map Setup
var map = {};
map.w  = 800;
map.h = 800;
map.projection = d3.geo.mercator().translate([map.w / 2, map.h / 1.5]);
map.path = d3.geo.path().projection(map.projection);
map.zoom = d3.behavior.zoom()
	.scaleExtent([1,10])
	.on('zoom', redrawMap);

var mapSVG = d3.select('#map').append('svg')
	.attr('width', '100%')
	.attr('height', $(window).height())
	.attr('viewBox', '0 0 ' + map.w + ' ' + map.h )
	.attr('preserveAspectRatio', 'xMidYMid meet')
	.attr('pointer-events', 'all')
	.attr("overflow", "hidden")
	.call(map.zoom)
	.append('g');

// Tip box for country names
var maphovertip = d3.select('#map').append('span')
		.attr('class', 'maphovertip')
		.style('opacity', 0);

// Tip box for people names 
var infotip = d3.select('body').append('span') 
		.attr('class', 'infotip')       
		.style('position', 'absolute')
		.style('z-index', '12')
		.style('opacity', 0);

function redrawMap() {
	mapSVG.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
	infotip.style('opacity', 0);
}

//--------------------------------------------------------------------------
// Timeline Setup - Full Timeline
var nearFuture = new Date().getUTCFullYear()+50;
var timeline = {};
timeline.start = new Date(-1400, 1, 1);
timeline.end = new Date(nearFuture, 1, 1);
timeline.w = $(document).width();
timeline.h = 35;

var timelineSVG = d3.select('#fulltime').append('svg')
	.attr('width', timeline.w)
	.attr('height', timeline.h)
	.attr('preserveAspectRatio', 'none')
	.attr('pointer-events', 'all');

timeline.x= d3.scale.linear()
	.domain([timeline.start, timeline.end])
	.range([10, timeline.w-10]);

timeline.axis = d3.svg.axis()
	.scale(timeline.x)
	.orient('bottom')
	.tickValues([new Date(-1000,1,1), new Date(-500,1,1), new Date(-1,1,1), new Date(500,1,1), new Date(1000,1,1), new Date(1500,1,1), new Date(2000,1,1)])
	.tickSize(2,0,2)
	.tickSubdivide(1)
	.tickFormat(function (d) { return toYear(d); });
timeline.xAxis = timelineSVG.append('g')
	.attr('class', 'axis')
	.attr('transform', 'translate(0, 18)');

timeline.xAxis.call(timeline.axis);

//--------------------------------------------------------------------------
// Timeline Setup - Zoom and Pan Timeline
var zoomtime = {};
zoomtime.w = timeline.w * 0.8;
zoomtime.itemh = 20;
zoomtime.numrows = 32;
zoomtime.h = (zoomtime.itemh + 5) * (zoomtime.numrows + 5);

zoomtime.x = d3.time.scale()
	.range([0, zoomtime.w]);

zoomtime.y = d3.scale.linear()
	.range([zoomtime.h, 0]);

zoomtime.xAxis = d3.svg.axis()
	.scale(zoomtime.x)
	.orient('top')
	.tickSize(-zoomtime.h, 0)
	.tickPadding(6);

var zoomtimeSVG = d3.select('#zoomtime').append('svg')
	.attr('width', zoomtime.w)
	.attr('height', zoomtime.h);

zoomtime.events = zoomtimeSVG.append('g')
	.attr('class', 'events');

zoomtime.eventlabels = zoomtimeSVG.append('g')
	.attr('class', 'eventlabels');

zoomtime.zoom = d3.behavior.zoom()
	.scaleExtent([1,30])
	.on('zoom', redrawZoomtime);

zoomtimeSVG
	.append('clipPath')
	.attr('id', 'clip')
	.append('rect')
		.attr('x', zoomtime.x(0))
		.attr('y', zoomtime.y(1))
		.attr('width', zoomtime.x(1) - zoomtime.x(0))
		.attr('height', zoomtime.y(0) - zoomtime.y(1));

zoomtimeSVG
	.append('g')
		.attr('class', 'x axis')
		.attr('transform', 'translate(0,' + zoomtime.itemh + ')');

zoomtimeSVG
	.append('rect')
		.attr('class', 'pane')
		.attr('width', zoomtime.w)
		.attr('height', zoomtime.h)
		.call(zoomtime.zoom);

function redrawZoomtime() {
	zoomtimeSVG.select('g.x.axis').call(zoomtime.xAxis);
	zoomtime.events.selectAll('rect')
		.attr('x', function(d, i) { return zoomtime.x(d.start); })
		.attr('width', function(d) { return zoomtime.x(d.end) - zoomtime.x(d.start); });
	zoomtime.eventlabels.selectAll('text')
		.attr('x', function(d, i) { return zoomtime.x(d.start) + 4; })
		.attr('opacity', function() { return (zoomtime.zoom.scale() > 5) ? 1 : 0; });
}

//--------------------------------------------------------------------------

function updateNamebox(content) {
	$('#namebox').empty();
	if(typeof content !== undefined) $('#namebox').append(content);		
}
function updateNameboxPerson(person) {
	$('#namebox').empty();
	var w = 75;
	var imgURL = fbURL + '/image' + person.id +  '?maxwidth=' + w + '&key=' + fbKey;
	var personInfo = '<div class="media"><img class="media-object pull-left" src="' + imgURL + '"><div class="media-body"><h3 class="media-heading">' + person.name + '</h3>';

	var i, id;
	// List professions labels (max 3)
	for (i = 0; i < person.profession.length && i < 3; i++) {
		id = person.profession[i].toLowerCase().replace(/ /g,'_');
		personInfo += '<a href="#" id="profession" class="namenavlink" data-id="/en/' + id + '"><span class="label label-success">' + person.profession[i] + '</span></a>';
	}
	// List school or movement or period labels (max 3)
	for (i = 0; i < person.movements.length && i < 3; i++) {
		if(i === 0) personInfo += '<br>';
		id = person.movements[i].toLowerCase().replace(/ /g,'_');
		personInfo += '<a href="#" id="movements" class="namenavlink" data-id="/en/' + id + '"><span class="label label-warning">' + person.movements[i] + '</span></a>';
	}
	personInfo += '<br><span class="label label-info">' + person.lived[0] + ' - ' + person.lived[1] + '</span></div></div>';
	if(typeof person.description === 'string') {
		personInfo += '<p>' + person.description.substring(0,260) + '...</p>';
	}
	$('#namebox').append(personInfo);

}
function toggleLoading(link, isLoading) {
	$('#' + link + ' span').toggle(!isLoading); // Count Badge
	$('#' + link + ' img').toggle(isLoading); // Loading animation
}
function clearAllNodes() {
	// Clear existing results from map and timelinea
	mapSVG.selectAll('circle').remove();
	timelineSVG.selectAll('rect.events').remove();
	zoomtime.events.selectAll('rect.events').remove();
	zoomtime.eventlabels.selectAll('text.eventlabels').remove();
}

//--------------------------------------------------------------------------
// Parse query results into new object
// Degree 0 = origin node; 1 = influenced node; 2 = influenced_by node; 3 = city name only
function newPeople(queryResult, degree) {
	var people = [];
	for (var i = 0; i < queryResult.length; i++) {
		people[i] = {};
		people[i].id = queryResult[i]['id'] || null;
		people[i].name = queryResult[i]['name'] || null;
		people[i].label = queryResult[i]['name'] || null;
		people[i].degree = degree || 0;
		people[i].profession = queryResult[i]['/people/person/profession'] || [];
		people[i].nationality = queryResult[i]['/people/person/nationality'] || null;
		people[i].city = queryResult[i]['/people/person/place_of_birth']['name'] || null;
		people[i].start = parseDate(queryResult[i]['/people/person/date_of_birth'] || null);
		people[i].end = parseDate(queryResult[i]['/people/deceased_person/date_of_death'] || null);
		people[i].description = queryResult[i]['/common/topic/description'] || null;

		people[i].countInfluenced = parseInt(queryResult[i]['c:/influence/influence_node/influenced'] || 0, 10);
		people[i].countInfluencedBy = parseInt(queryResult[i]['c:/influence/influence_node/influenced_by'] || 0, 10);
		people[i].countPeers = parseInt(queryResult[i]['c:/influence/influence_node/peers'] || 0, 10);
		people[i].countWritWorks = parseInt(queryResult[i]['c:/book/author/works_written'] || 0, 10);
		people[i].countArtWorks = parseInt(queryResult[i]['c:/visual_art/visual_artist/artworks'] || 0, 10);
		people[i].countInventions = parseInt(queryResult[i]['c:/law/inventor/inventions'] || 0, 10);
		people[i].countPlacesLived = (queryResult[i]['/people/person/places_lived'] || []).length || 1;

		var movementA = queryResult[i]['/visual_art/visual_artist/associated_periods_or_movements'] || [];
		var movementB = queryResult[i]['/book/author/school_or_movement'] || [];
		people[i].movements = movementA.concat(movementB);

		people[i].instant = false;

		// Estimate lifespan if DOB or DOD unknown.
		var today = new Date(),
			yearMillis = 31622400000;
		people[i].lived = [];
		
		if(people[i].start === null) { 
			people[i].lived[0] = 'Unknown'; 
			if(people[i].end !== null) { people[i].start = new Date(people[i].end-(yearMillis*70)); }
		} else {
			people[i].lived[0] = toYear(people[i].start);
		}
		if(people[i].end === null) {
			if(people[i].start !== null) { 
				if(today-people[i].start < yearMillis*100) {
					people[i].lived[1] = 'Present';
					people[i].end = today;
				} else {
					people[i].lived[1] = 'Unknown';
					people[i].end = new Date(people[i].start+(yearMillis*70)); 
				}
			}
		} else {
			people[i].lived[1] = toYear(people[i].end);
		}

		// Save standard geocoordinates
		people[i].coordinates = [queryResult[i]['/people/person/place_of_birth']['/location/location/geolocation']['longitude'],
														queryResult[i]['/people/person/place_of_birth']['/location/location/geolocation']['latitude']] || [0,0];

		// Translate geocoordinates into map coordinates
		people[i].x = map.projection(people[i].coordinates)[0];
		people[i].y = map.projection(people[i].coordinates)[1];

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
		places[i].name = queryResult[i]['location']['name'] || 'Unknown';
		places[i].city = places[i].name;
		places[i].degree = 3;
		places[i].color = colors[3];

		// Save standard geocoordinates
		places[i].coordinates = [queryResult[i]['location']['/location/location/geolocation']['longitude'],
																	queryResult[i]['location']['/location/location/geolocation']['latitude']] || [0,0];

		// Translate geocoordinates into map coordinates
		places[i].x = map.projection(places[i].coordinates)[0];
		places[i].y = map.projection(places[i].coordinates)[1];
	}
	return places;
}
function getMovement(id) {
	window.history.replaceState({}, 'VisiWiki', '/m' + id);
	updateNamebox('<h3>Loading...</h3>');
	var query = {
		'id': id,
		'name': null,
		'/common/topic/description': null,
		'/book/school_or_movement/associated_period': [{
			'start': null,
			'end': null,
			'optional': true
		}],
		'/visual_art/art_period_movement/began_approximately': null,
		'/visual_art/art_period_movement/ended_approximately': null,
		'/time/event/start_date': null,
		'/time/event/end_date': null,
		'/visual_art/art_period_movement/associated_artists': [{
			'id': null,
			'name': null,
			'/people/person/place_of_birth': {
				'name': null,
				'/location/location/geolocation': {
					'latitude': null,
					'longitude': null
				}
			},
			'/people/person/date_of_birth': null,
			'/people/deceased_person/date_of_death': null,
			'optional': true
		}],
		'/book/school_or_movement/associated_authors': [{
			'id': null,
			'name': null,
			'/people/person/place_of_birth': {
				'name': null,
				'/location/location/geolocation': {
					'latitude': null,
					'longitude': null
				}
			},
			'/people/person/date_of_birth': null,
			'/people/deceased_person/date_of_death': null,
			'optional': true
		}]
	};
	// Async Query Request
	$.getJSON(fbCall, {query:JSON.stringify(query)}, function(q) {
		if(q.result === null) {
			updateNamebox('<h3>Sorry, not enough data.</h3>');
		} else {
			clearAllNodes();
			var artists = newPeople((q.result['/visual_art/art_period_movement/associated_artists'] || []), 1);
			var authors = newPeople((q.result['/book/school_or_movement/associated_authors'] || []), 2);
			var description = q.result['/common/topic/description'] || '';
			// Add namebox with basic info  
			var imgWidth = 64;
			var imgURL = fbURL + '/image' + q.result.id +  '?maxwidth=' + imgWidth + '&key=' + fbKey;

			var start = toYear(parseDate(q.result['/time/event/start_date']) || parseDate(q.result['/visual_art/art_period_movement/began_approximately']) || parseDate(q.result['/book/school_or_movement/associated_period']['start']) || null);
			var end = toYear(parseDate(q.result['/time/event/end_date']) || parseDate(q.result['/visual_art/art_period_movement/ended_approximately']) || parseDate(q.result['/book/school_or_movement/associated_period']['end']) || null);
			
			var movementInfo = '<div class="media"><img class="media-object pull-left" src="' + imgURL + '"><div class="media-body"><h3 class="media-heading">' + q.result.name + '</h3>';
			if(start || end) {
				movementInfo += '<span class="label label-info">' + (start || 'unknown') + ' - ' + (end || 'unknown') + '</span>';
			}
			movementInfo += '</div></div><p>' + description + '</p>';

			var people = artists.concat(authors);

			// Wikipedia Bio
			getWikiText(q.result.name)

			updateNamebox(movementInfo);
			plotOnMap(people);
			plotOnTimeline(people);
		}
	});
}
function getProfession(id) {
	window.history.replaceState({}, 'VisiWiki', '/p' + id);
	updateNamebox('<h3>Loading...</h3>');
	var query = {
		'id': id,
		'name': null,
		'/common/topic/description': null,
		'/people/profession/people_with_this_profession': [{
			'id': null,
			'name': null,
			'/people/person/place_of_birth': {
				'name': null,
				'/location/location/geolocation': {
					'latitude': null,
					'longitude': null
				}
			},
			'/people/person/nationality': [],
			'/people/person/profession': [],
			'/people/person/date_of_birth': null,
			'/people/deceased_person/date_of_death': null,
			'limit': 100
		}]
	};
	// Async Query Request
	$.getJSON(fbCall, {query:JSON.stringify(query)}, function(q) {
		if(q.result === null) {
			updateNamebox('<h3>Sorry, not enough data.</h3>');
		} else {
			clearAllNodes();
			var people = newPeople((q.result['/people/profession/people_with_this_profession'] || []), 1);
			var description = q.result['/common/topic/description'] || '';
			// Add namebox with basic info  
			var imgWidth = 64;
			var imgURL = fbURL + '/image' + q.result.id +  '?maxwidth=' + imgWidth + '&key=' + fbKey;
			var personInfo = '<div class="media"><img class="media-object pull-left" src="' + imgURL + '"><div class="media-body"><h3 class="media-heading">' + q.result.name + '</h3></div></div><p>' + description + '</p>';
			updateNamebox(personInfo);
			plotOnMap(people);
			plotOnTimeline(people);
		}
	});
}
function getPerson(id, changeNamebox) {
	window.history.replaceState({}, 'VisiWiki', '/r' + id);
	var query = {
		'id': id,
		'name': null,
		'/people/person/place_of_birth': {
			'name': null,
			'/location/location/geolocation': {
				'latitude': null,
				'longitude': null
			}
		},
		'/people/person/date_of_birth': null,
		'/people/person/profession': [],
		'/people/deceased_person/date_of_death': null,
		'/influence/influence_node/influenced_by': [{
			'id': null,
			'name': null,
			'/people/person/place_of_birth': {
				'name': null,
				'/location/location/geolocation': {
					'latitude': null,
					'longitude': null
				}
			},
			'/people/person/date_of_birth': null,
			'/people/deceased_person/date_of_death': null,
			'optional': true
		}],
		'/influence/influence_node/influenced': [{
			'id': null,
			'name': null,
			'/people/person/place_of_birth': {
				'name': null,
				'/location/location/geolocation': {
					'latitude': null,
					'longitude': null
				}
			},
			'/people/person/date_of_birth': null,
			'/people/deceased_person/date_of_death': null,
			'optional': true
		}],
		'limit': 100
	};
	// Async Query Request
	$.getJSON(fbCall, {query:JSON.stringify(query)}, function(q) {
		if(q.result === null) {
			updateNamebox('<h3>Sorry, not enough data available on this topic.</h3>');
		} else {
			clearAllNodes();
			var origin = newPeople([q.result], 0)[0];
			var influenced = newPeople((q.result['/influence/influence_node/influenced'] || []), 1);
			var influencedBy = newPeople((q.result['/influence/influence_node/influenced_by'] || []), 2);
			var people = [origin].concat(influenced).concat(influencedBy);
			plotOnMap(people);
			plotOnTimeline(people);

			// Wikipedia Bio
			getWikiText(origin.name)

		}
		updateNameboxPerson(origin);
	});
}
function getPeers(id) {
	var query = {
		'id': id,
		'name': null,
		'/people/person/place_of_birth': {
			'name': null,
			'/location/location/geolocation': {
				'latitude': null,
				'longitude': null
			}
		},
		'/people/person/date_of_birth': null,
		'/people/deceased_person/date_of_death': null,
		'/influence/influence_node/peers': [{
			'id': null,
			'name': null,
			'/people/person/place_of_birth': {
				'name': null,
				'/location/location/geolocation': {
					'latitude': null,
					'longitude': null
				}
			},
			'/people/person/date_of_birth': null,
			'/people/deceased_person/date_of_death': null
		}]
	};
	// Async Query Request
	$.getJSON(fbCall, {query:JSON.stringify(query)}, function(q) {
		if(q.result !== null) {
			clearAllNodes();
			var origin = newPeople([q.result], 0);
			var peers = newPeople((q.result['/influence/influence_node/peers'] || []), 1);
			var people = origin.concat(peers);
			plotOnMap(people);
			plotOnTimeline(people);
		}
		toggleLoading('peers', false);
	});
}
function plotOnTimeline(people) {
	// Prepare variables for zoom timeline
	var zoomScale = 8;
	var centerTime = new Date(people[0].start.getUTCFullYear()-200, 1, 1);

	// Sort array by DOB
	people.sort(function(a, b){
    	return a.start - b.start;
	});

	var lastDeath = [];
	function findRowPosition(d,i) {
		for(var r = 0; r < zoomtime.numrows; r++) {
			if(lastDeath[r] === undefined) { lastDeath[r] = new Date(-3000,1,1); }
			if(d.start > lastDeath[r]) {
				lastDeath[r] = d.end;
				return zoomtime.itemh*1.2 + r * (zoomtime.itemh+2); 
			}
		}
		return 0; 
	}

	// Full Timeline
	timelineSVG
		.selectAll('circle')
		.data(people)
		.enter().append('rect')
		.attr('class', function(d) { return 'events degree-' + d.degree; })
		.attr('title', function(d) { return d.name; })
		.attr('x', function(d) { return timeline.x(d.start); })
		.attr('y', 12)
		.attr('width', function(d) { return timeline.x(d.end) - timeline.x(d.start); })
		.attr('height', 6)
		.attr('fill', function(d) { return d.color; })
		.attr('opacity', 0.4);

	// Zoom Timeline		
	var x = zoomtime.x;
	x.domain([new Date(-2000, 0, 1), new Date(2013, 0, 1)]);
	zoomtime.zoom.x(x);
	zoomtime.events
		.selectAll('rect')
		.data(people)
		.enter().append('rect')
		.attr('class', function(d) { return 'events degree-' + d.degree; })
		.attr('title', function(d) { return d.name; })
		.attr('height', function() { return (d3.select(this).attr('y') == 0) ? 0 : zoomtime.itemh; })
		.attr('fill', function(d) { return d.color; })
		.attr('y', function(d,i) { return findRowPosition(d,i); })
		.attr('opacity', function() { return (d3.select(this).attr('y') == 0) ? 0 : 0.7; })

	// Clear row sorting tracker
	lastDeath = [];

	zoomtime.eventlabels
		.selectAll('text')
		.data(people)
		.enter().append('text')
		.attr('class', function(d) { return 'eventlabels degree-' + d.degree; })
		.attr('y', function(d,i) { return findRowPosition(d, i) + zoomtime.itemh/2 + 5; })
		.attr('opacity', function() { return (d3.select(this).attr('y') == 0) ? 0 : 1; })
		.text(function (d) { return d.name; });

	// Center timeline on origin node
	var trans = [(zoomtime.x(centerTime) * -zoomScale), 0];
	zoomtime.zoom.scale(zoomScale);
	zoomtime.zoom.translate([trans[0], trans[1]]);

	redrawZoomtime();
}
function plotOnMap(people) {
	// Draw nodes on map
	mapSVG
		.selectAll('circle')
		.data(people)
		.enter()
		.append('circle')
		.attr('class', function(d) { return 'node degree-' + d.degree; })
		.attr('cx', function(d) { return d.x; })
		.attr('cy', function(d) { return d.y; })
		.attr('title', function(d) { return d.name; })
		.attr('fill', function(d) { return d.color; })
		.attr('opacity', function(d) { if(d.degree === 0) { return 1; } else { return 0.9; } })
		.on('click', function(d) {
			// If name length is too long display last name only
			var resized_name = '';
			if(d.name.length > 23) {
				var split_name = d.name.split(' ');
				resized_name = split_name[split_name.length-1].substring(0,23);
			} else {
				resized_name = d.name;
			}
			infotip
				.attr('id', d.id)
				.style('opacity', 1)
				.html(resized_name + ' <i class="fa fa-arrow-circle-right"></i>')
				.style('width', '175px')
				.style('top', (d3.event.pageY-16)+'px')
				.style('left',(d3.event.pageX+18)+'px')
				.on('click', function() { 
					d3.select(this).style('opacity', 0);
					d3.select(this).style('width', '1px');
					getPerson(d3.select(this).attr('id')); 
				});
			if(d.city !== null) {
				maphovertip
					.html(d.city)
					.style('opacity', 0.6);
			}  
			d3.select(this)
				.attr('opacity', 1);
		})
		.on('mouseout',  function(d) {
			d3.select(this)
				.attr('opacity', function(d) { if(d.degree === 0) { return 1; } else { return 0.9; } });
			maphovertip
				.style('opacity', 0); 
		})
		.attr('r', function(d) { if(d.degree === 0) { return 2.3; } else { return 0.9; } });
		
	// Zoom to origin node
	if(people[0].degree === 0) {
		var zoomScale = 5;
		var trans = [(-people[0].x * zoomScale + map.w/2),(-people[0].y * zoomScale + map.h/2)];
		mapSVG
			.transition()
			.duration(450)
			.attr('transform', 'translate(' + trans[0] + ',' + trans[1] + ')scale(' + zoomScale + ')');
		map.zoom.scale(zoomScale);
		map.zoom.translate([trans[0], trans[1]]);
	}
}

//--------------------------------------------------------------------------
// Draw map once topoJSON is loaded
function ready(error, world, names) {

	var countries = topojson.object(world, world.objects.countries).geometries;
	var n = countries.length;

	countries.forEach(function(d) {
		var tryit = names.filter(function(n) { return d.id == n.id; })[0];
		if (typeof tryit === 'undefined'){
			d.name = 'Undefined';
		} else {
			d.name = tryit.name; 
		}
	});

	var country = mapSVG.selectAll('.country').data(countries);

	country
		.enter()
		.insert('path')
		.attr('class', 'country')    
		.attr('title', function(d,i) { return d.name; })
		.attr('d', map.path);

	// Display and Hide country name tooltip
	country
		.on('mousemove', function(d) {
			maphovertip
				.html(d.name)
				.style('opacity', 0.6);  
		})
		.on('mouseout',  function() {
			maphovertip
				.style('opacity', 0);  
		});

		// If received ID from URL then start query
		if(typeof jshare !== 'undefined') {
			if(jshare.id)
				getPerson('/' + jshare.id.join('/'));
			if(jshare.profession)
				getProfession('/' + jshare.profession.join('/'));
			if(jshare.movement)
				getMovement('/' + jshare.movement.join('/'));
		}
}

// Load map paths and country names
queue()
	.defer(d3.json, '/data/world.json')
	.defer(d3.tsv, '/data/world-country-names.tsv')
	.await(ready);

//--------------------------------------------------------------------------
// Event Handler for FreeBase Search Box 
$(function() {
	$('#fbinput')
		.suggest({
			'key': fbKey,
			filter: '(any type:/people/person type:/people/profession type:/visual_art/art_period_movement type:/book/school_or_movement)',
			animate: 'false'})
		// Search Result Selected - Trigger Query
		.bind('fb-select', function(e, data) {
			clearAllNodes();
			updateNamebox('<h3>Loading...</h3>');
			switch (data.notable.id) {
				case '/people/profession':
					getProfession(data.id);
					break;
				case '/visual_art/art_period_movement': // Fallthrough case
				case '/book/school_or_movement':
					getMovement(data.id);
					break;
				default:
					getPerson(data.id);
					break;
			}
		});
});

//--------------------------------------------------------------------------
// Event Handler for navbar and namebox links
$('body').scrollspy({ target: '.navbar', offset: 2 });

$(document).on('click', 'a.namenavlink', function(e) {
	e.preventDefault();
	var linkid = $(this).attr('id');
	var queryid = $(this).attr('data-id');
	$('#nameboxnav').children().removeClass('active');
	$('#' + linkid).parent('li').addClass('active');   
	switch (linkid) {
		case 'placeslived':
			toggleLoading('placeslived', true);
			getPerson(queryid, false);
			break;
		case 'influences':
			toggleLoading('influences', true);
			getInfluences(queryid);
			break;
		case 'peers':
			toggleLoading('peers', true);
			getPeers(queryid);  
			break;
		case 'writworks':
			// getWritWorks(queryid);
			$('#' + linkid).parent('li').removeClass('active');  
			break;
		case 'artworks':
			// getArtWorks(queryid);
			$('#' + linkid).parent('li').removeClass('active');  
			break;
		case 'inventions':
			// getInventions(queryid);
			$('#' + linkid).parent('li').removeClass('active');  
			break;
		case 'profession':
			getProfession(queryid);
			break;
		case 'movements':
			getMovement(queryid);
			break;
		default:
			break;
	}
});