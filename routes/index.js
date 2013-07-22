
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Visiwiki' });
};

exports.result = function(req, res) {
	res.render('index', { title: 'Result' });
};

