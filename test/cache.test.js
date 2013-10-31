/* Copyright (c) 2013 Marius Ursache */
"use strict";

// run redis-server for this to work!
// mocha test/cache.test.js

var seneca = require('seneca')();

var options = {host:"192.168.5.128"};
seneca.use('..', options)

var assert = require('assert')


describe('memcached', function(){

  var cache = seneca.pin({role:'cache',cmd:'*'})

  it('set1', function(cb) {
    cache.set({key:'a1',val:'b1'},function(err,out){
      assert.ok(null === err)
      assert.equal(out, "OK")
      cb()
    })
  })


  it('get1', function(cb) {
    cache.get({key:'a1'},function(err,out){
      assert.ok(null==err)
      assert.equal('b1',out)
      cb()
    })
  })


  it('set2', function(cb) {
    cache.set({key:'c1',val:0},function(err,out){
      assert.ok(null === err);
      assert.ok(out)
      cb()
    })
  })

  it('incr1', function(cb) {
    cache.incr({key:'c1',val:1},function(err,out){
      assert.ok(null === err);
      assert.ok(out);
      cb()
    })
  })

  it('get2', function(cb) {
    cache.get({key:'c1'},function(err,out){
      assert.ok(null === err)
      assert.equal(1,out)
      cb()
    })
  })

  it('incr2', function(cb) {
    cache.incr({key:'c1',val:1},function(err,out){
      assert.ok(null === err)
      assert.ok(out)
      cb()
    })
  })

  it('get3', function(cb) {
    cache.get({key:'c1'},function(err,out){
      assert.ok(null === err)
      assert.equal(2,out)
      cb()
    })
  })

})
