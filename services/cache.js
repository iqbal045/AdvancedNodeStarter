const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);

// Promisify client.get to return a promise
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec; // reference to the original exec function

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  return this;
}

mongoose.Query.prototype.exec = async function () {

  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  const key = JSON.stringify(Object.assign({}, this.getQuery(), {
    collection: this.mongooseCollection.name
  }));

  // see if we have a value for 'key' in redis 
  const cacheValue = await client.hget(this.hashKey, key);

  // if we do, return that
  if (cacheValue) {
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc) 
      ? doc.map(d => new this.model(d))
      : new this.model(doc);
  }

  // otherwise, issue the query and store the result in redis
  const result = await exec.apply(this, arguments);

  client.hset(key, JSON.stringify(this.hashKey, key, result), 'EX', 10);

  return result;
}

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
}