
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Visiwiki' });
};

exports.id = function(req, res) {
	res.jshare.id = [req.params.id1, req.params.id2];
	res.render('index', { title: 'VisiWiki' });
};

exports.profession = function(req, res) {
	res.jshare.profession = [req.params.id1, req.params.id2];
	res.render('index', { title: 'VisiWiki' });
};

