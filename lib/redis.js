/*jslint node: true */
/* Copyright (c) 2013 Marius Ursache */

"use strict";

var _  = require('underscore');
var redis = require('redis');
var fash = require('fash');

module.exports = function(options, register) {
  var seneca = this;

  options = seneca.util.deepextend({
    expires: 3600,
    host: "127.0.0.1",
    port: 6379
  }, options);

  var cmds = {};
  var name = 'redis';
  var role = 'cache';

  var redisClient;

  var chash;
  if (options.servers) {
    var pnodes = [];
    for (var i=0; i < options.servers.length; i++) {
      pnodes.push('' + i);
    }

    chash = fash.create({
        algorithm: 'sha-256', // Can be any algorithm supported by openssl.
        pnodes: pnodes, // The set of physical nodes to insert into the ring.
        vnodes: 1000, // The virtual nodes to place onto the ring. Once set, this can't be changed for the lifetime of the ring.
        backend: fash.BACKEND.IN_MEMORY
    }, function(err, chash) {
        seneca.log.info('chash created');
    });
  }

  function resolveRedisClient(key) {
    if (options.servers) {
      var pnode = chash.getNode('' + key).pnode;
      return redisClient[Number(pnode)];
    }
    else {
      return redisClient;
    }
  }

  function setter(kind) {
    return function(args, cb) {
      var key = args.key;
      var val = args.val;
      var expires = args.expires || options.expires;
      resolveRedisClient(key)[kind](key, val, function(err, out){
        resolveRedisClient(key).expire(key, expires, function(err, outExp){
          return cb(err, out);
        });
      })
    }
  }

  cmds.set = setter('set');
  cmds.add = setter('set');
  cmds.replace = setter('set');

  function bykey(kind) {
    return function(args, cb) {
      var key = args.key;
      resolveRedisClient(key)[kind](key, function(err, out){
        return cb(err, out);
      })
    }
  }

  cmds.get = bykey('get');
  cmds.delete = bykey('del');

  function incrdecr(kind) {
    return function(args,cb) {
      var key = args.key;
      var val = args.val;
      resolveRedisClient(key)[kind](key, val, function(err, out){
        return cb(err, out);
      });
    }
  }

  cmds.incr = incrdecr('incrby');
  cmds.decr = incrdecr('decrby');
  cmds.append = incrdecr('append');

  function noargs(kind) {
    return function(args, cb) {
      var key = args.key;
      resolveRedisClient(key)[kind](cb);
    }
  }

  cmds.flush = noargs('flushdb');
  cmds.flushall = noargs('flushall');
  cmds.flushdb = noargs('flushdb');
  cmds.close = noargs('quit');

  // cache role

  // add shard if defined
  var q = {role:role};
  if (options.shard) {
    q = seneca.util.deepextend({
      shard: options.shard
    }, q);
  }

  seneca.add(seneca.util.deepextend({cmd:'set'}, q), cmds.set);
  seneca.add(seneca.util.deepextend({cmd:'get'}, q), cmds.get);
  seneca.add(seneca.util.deepextend({cmd:'add'}, q), cmds.add);
  seneca.add(seneca.util.deepextend({cmd:'delete'}, q), cmds.delete);
  seneca.add(seneca.util.deepextend({cmd:'incr'}, q), cmds.incr);
  seneca.add(seneca.util.deepextend({cmd:'decr'}, q), cmds.decr);

  seneca.add({role:'seneca',cmd:'close'}, cmds.close);

  // Redis cache commands (partial and simple implementation)
  seneca.add({plugin:name,cmd:'set'}, cmds.set);
  seneca.add({plugin:name,cmd:'get'}, cmds.get);
  seneca.add({plugin:name,cmd:'add'}, cmds.add);
  seneca.add({plugin:name,cmd:'delete'}, cmds.delete);
  seneca.add({plugin:name,cmd:'incr'}, cmds.incr);
  seneca.add({plugin:name,cmd:'decr'}, cmds.decr);
  seneca.add({plugin:name,cmd:'replace'}, cmds.replace);
  seneca.add({plugin:name,cmd:'append'}, cmds.append);
  seneca.add({plugin:name,cmd:'flush'}, cmds.flush);
  seneca.add({plugin:name,cmd:'close'}, cmds.close);

  seneca.add({plugin:name,cmd:'native'}, function(args, done){
    return done(null, redisClient);
  });

  function initRedisClient(servers, serverIndex, done) {
    if (!redisClient) {
      redisClient = [];
    }

    seneca.log.info(name, 'create client', servers[serverIndex]);
    redisClient[serverIndex] = redis.createClient(servers[serverIndex].port, servers[serverIndex].host, servers[serverIndex]);
    redisClient[serverIndex].on("error", function (err) {
      seneca.log.error(name + " error event - " + err);
    });

    function initNextRedistClient() {
      serverIndex += 1;
      if (serverIndex < servers.length) {
        initRedisClient(servers, serverIndex, done);
      }
      else {
        return done();
      }
    }

    if ('db' in servers[serverIndex]) {
      redisClient[serverIndex].select(servers[serverIndex].db, function(err){
        seneca.log.info(name, 'select db ' + servers[serverIndex].db, servers[serverIndex]);
        initNextRedistClient();
      });
    }
    else {
      initNextRedistClient();
    }
  }

  seneca.add({init:name}, function(args, done){
    // Workaround Seneca calling init twice (?)
    if(redisClient == null) {

      if (options.servers) {
        initRedisClient(options.servers, 0, done);
      }
      else {
        seneca.log.info(name, 'create redis client', options);
        redisClient = redis.createClient(options.port, options.host, options);
        if(options.db){
          redisClient.select(options.db, function(err){
            seneca.log.info(name, 'select db', options);
          });
        }
        redisClient.on("error", function (err) {
          seneca.log.error(name + " error event - " + redisClient.host + ":" + redisClient.port + " - " + err);
        });
        return done();
      }
    }
    else {
      return done();
    }

  });

  register(null, {
    name:name
  });
};