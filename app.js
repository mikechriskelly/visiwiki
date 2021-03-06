
/**
 * Module dependencies.
 */

var express = require('express')
	, routes = require('./routes')
	, http = require('http')
	, path = require('path')
	, jshare = require('jshare')
	, enchilada = require('enchilada');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', {layout: true});
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(jshare());
app.use(app.router);
app.use(enchilada({
	src: __dirname + '/public',
	cache: false, // use true for production to disable file watching
	compress: false, // default false
	debug: true // default false (enable sourcemap output with bundle)
}));
app.use(express.static(path.join(__dirname, 'public')));
app.locals.pretty = true;

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/r/:id1/:id2', routes.id);
app.get('/p/:id1/:id2', routes.profession);
app.get('/m/:id1/:id2', routes.movement);

http.createServer(app).listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
