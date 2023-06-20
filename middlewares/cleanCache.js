const { clearHash } = require('../services/cache');

module.exports = async (req, res, next) => {
  await next(); // wait for the route handler to finish executing
  clearHash(req.user.id); // clear the cache for the user that just made a request
}