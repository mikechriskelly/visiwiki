
/*
 * GET users listing.
 */

exports.list = function(req, res){
  res.send("respond with a resource");
};
exports.display = function(req, res){
  res.send("respond with an ID " + req.params.id);
};