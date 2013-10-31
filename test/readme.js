var seneca = require('seneca')();

var options = {host:"192.168.5.128"};
seneca.use('..', options);

seneca.ready(function(){
  console.log("ready");
    test1(function(){
        test2(function(){
            seneca.close();
        });
    });
});

function test1(done) {
    seneca.act({role:'cache', cmd:'set', key:'k1', val:'v1'}, function(err){
        seneca.act({role:'cache', cmd:'get', key:'k1'}, function(err,val){
            console.log('value = '+val);
            return done();
        });
    });
}

function test2(done){
    var cache = seneca.pin({role:'cache',cmd:'*'});
    cache.set({key:'k2', val:'v2'}, function(err){
        cache.get({key:'k2'}, function(err,val){
            console.log('value = '+val)
            return done();
        });
    });
}
