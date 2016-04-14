var mongoose = require('mongoose')
  , db = require('../lib/database')
  , Tx = require('../models/tx')  
  , Address = require('../models/address')
  ,Block = require('../models/blocks')
  , Richlist = require('../models/richlist')  
  , Stats = require('../models/statics')  
  , settings = require('../lib/settings')
  , lib = require('../lib/explorer')
  , fs = require('fs');

var mode = 'update';
var database = 'index';

// displays usage and exits
function usage() {

  console.log('Usage: node scripts/sync.js [database] [mode]');
  console.log('');
  console.log('database: (required)');
  console.log('index [mode] Main index: coin info/stats, transactions & addresses');
  console.log('market       Market data: summaries, orderbooks, trade history & chartdata')
  console.log('');
  console.log('mode: (required for index database only)');
  console.log('update       Updates index from last sync to current block');
  console.log('check        checks index for (and adds) any missing transactions/addresses');
  console.log('reindex      Clears index then resyncs from genesis to current block');
  console.log('');
  console.log('notes:'); 
  console.log('* \'current block\' is the latest created block when script is executed.');
  console.log('* The market database only supports (& defaults to) reindex mode.');
  console.log('* If check mode finds missing data(ignoring new data since last sync),'); 
  console.log('  index_timeout in settings.json is set too low.')
  console.log('');
  process.exit(0);
}

// check options
if (process.argv[2] == 'index') {
  if (process.argv.length <3) {
    usage();
  } else {
    switch(process.argv[3])
    {
    case 'update':
      mode = 'update';
      break;
    case 'check':
      mode = 'check';
      break;
    case 'reindex':
      mode = 'reindex';
      break;
    case 'findError':
    	mode = 'findError';
    	break;
      
    default:
      usage();
    }
  }
} else if (process.argv[2] == 'market'){
  database = 'market';
} else {
  usage();
}

function create_lock(cb) {
  if ( database == 'index' ) {
    var fname = './tmp/' + database + '.pid';
    fs.appendFile(fname, process.pid, function (err) {
      if (err) {
        console.log("Error: unable to create %s", fname);
        process.exit(1);
      } else {
        return cb();
      }
    });
  } else {
    return cb();
  }
}

function remove_lock(cb) {
  if ( database == 'index' ) {
    var fname = './tmp/' + database + '.pid';
    fs.unlink(fname, function (err){
      if(err) {
        console.log("unable to remove lock: %s", fname);
        process.exit(1);
      } else {
        return cb();
      }
    });
  } else {
    return cb();
  }  
}

function is_locked(cb) {
	// test only
	return cb(false)
	// end test only
  if ( database == 'index' ) {
    var fname = './tmp/' + database + '.pid';
    fs.exists(fname, function (exists){
      if(exists) {
        return cb(true);
      } else {
        return cb(false);
      }
    });
  } else {
    return cb();
  } 
}

function exit() {
  remove_lock(function(){
    mongoose.disconnect();
    process.exit(0);
  });
}

var dbString = 'mongodb://' + settings.dbsettings.user;
dbString = dbString + ':' + settings.dbsettings.password;
dbString = dbString + '@' + settings.dbsettings.address;
dbString = dbString + ':' + settings.dbsettings.port;
dbString = dbString + '/' + settings.dbsettings.database;

is_locked(function (exists) {
  if (exists) {
    console.log("Script already running..");
    process.exit(0);
  } else {
    create_lock(function (){
      console.log("script launched with pid: " + process.pid);
      mongoose.connect(dbString, function(err) {
        if (err) {
          console.log('Unable to connect to database: %s', dbString);
          console.log('Aborting');
          exit();
        } else if (database == 'index') {
          db.check_stats(settings.coin, function(exists) {
            if (exists == false) {
              console.log('Run \'npm start\' to create database structures before running this script.');
              exit();
            } else {
              db.update_db(settings.coin, function(){
                db.get_stats(settings.coin, function(stats){
                  if (settings.heavy == true) {
                    db.update_heavy(settings.coin, stats.count, 20, function(){
                    
                    });
                  }
                  //console.log('read stat:',stats);
                  if (mode == 'reindex') {
                    Tx.remove({}, function(err) { 
                    	Block.remove({},function(){});
                      Address.remove({}, function(err2) { 
                        Richlist.update({coin: settings.coin}, {
                          received: [],
                          balance: [],
                        }, function(err3) { 
                          Stats.update({coin: settings.coin}, { 
                            last: 0,
                          }, function() {
                            console.log('index cleared (reindex)');
                          }); 
                          db.update_tx_db(settings.coin, 1, stats.count, settings.update_timeout, function(){
                            db.update_richlist('received', function(){
                              db.update_richlist('balance', function(){
                                db.get_stats(settings.coin, function(nstats){
                                  console.log('reindex complete (block: %s)', nstats.last);
                                  exit();
                                });
                              });
                            });
                          });
                        });
                      });
                    });              
                  } else if (mode == 'check') {
                    db.update_tx_db(settings.coin, 1, stats.count, settings.check_timeout, function(){
                      db.get_stats(settings.coin, function(nstats){
                        console.log('check complete (block: %s)', nstats.last);
                        exit();
                      });
                    });
                  } else if (mode == 'update') {
                	  
                	  
                    db.update_tx_db(settings.coin, stats.last, stats.count, settings.update_timeout, function(){
                      db.update_richlist('received', function(){
                        db.update_richlist('balance', function(){
                          db.get_stats(settings.coin, function(nstats){
                            console.log('update complete (block: %s)', nstats.last);
                            exit();
                          });
                        });
                      });
                    });
                  }
                  else if (mode == 'findError'){
                	  //console.log('find an error');
                	  //console.log('last block:', stats.count);          	   
                	  doUpdate(stats);
                  }
                });
              });
            }
          });
        } else {
          //update markets
          var markets = settings.markets.enabled;
          var complete = 0;
          for (var x = 0; x < markets.length; x++) {
            var market = markets[x];
            db.check_market(market, function(mkt, exists) {
              if (exists) {
                db.update_markets_db(mkt, function(err) {
                  if (!err) {
                    console.log('%s market data updated successfully.', mkt);
                    complete++;
                    if (complete == markets.length) {
                      exit();
                    }
                  } else {
                    console.log('%s: %s', mkt, err);
                    complete++;
                    if (complete == markets.length) {
                      exit();
                    }
                  }
                });
              } else {
                console.log('error: entry for %s does not exists in markets db.', mkt);
                complete++;
                if (complete == markets.length) {
                  exit();
                }
              }
            });
          }
        }
      });
    });
  }
});


function doUpdate(stats){
	var savedBlocksLength = 6;
	  var tmpLast = stats.last;
	  var tmpLastHash = stats.lasthash;
	  lib.get_blockhash(tmpLast, function(lastHash_BlockChain){
		  
  	  if(true){//typeof lastHash_BlockChain === 'string'){
  		  if(lastHash_BlockChain == tmpLastHash){
  			  console.log(tmpLastHash);
  			  console.log(lastHash_BlockChain);
  			  console.log('update from last to newest block');
  			  
  			  
  			  db.update_tx_db(settings.coin, stats.last+1, stats.count, settings.update_timeout, function(){
                    db.update_richlist('received', function(){
                      db.update_richlist('balance', function(){
                        db.get_stats(settings.coin, function(nstats){
                          console.log('update complete (block: %s)', nstats.last);
                          exit();
                        });
                      });
                    });
                  });  
  			  
  		  }
  		  else{ // error=> find error position and remove them from 6 last blocks, re-update from that position			
  			  
  			  //find block position which is not hacked
  			  // Variable: tmpLast: store this position
  			  lib.syncLoop(savedBlocksLength-1, function (loop) {
  				  tmpLast--;
  				  console.log('test tmplast is: ',tmpLast);
                    var i = loop.iteration();
                    lib.get_blockhash(tmpLast, function(newlastHash_BlockChain){
                  	  if(typeof newlastHash_BlockChain === 'string'){
                  		  
              			  Block.findOne({height:tmpLast}, function(err, blockResult){
              				  if(blockResult){
              					  console.log(blockResult.blockhash);
              					  console.log(newlastHash_BlockChain);
              					  if(blockResult.blockhash == newlastHash_BlockChain){ // if find a right block=>stop
              						  console.log('blockchain is hacked');
              						  console.log('hacked block is: ',tmpLast);
              						  //console.log(newlastHash_BlockChain);    
              						  loop.break(true);   		  
              					  }  
              					  else{      
              						  setTimeout(function(){  
              							  //console.log('test delay: ' ,i)
              							  loop.next();
              						  },10);                                						 
              					  }
              				  }
              				  else{
              					  console.log('error for get last block in blockchain');
              					  exit();                                					  				  
              				}                       					  
              					  
              			  });	  
                  	  }
                  	  else{
                  		  console.log('error for get block hash');
                  		  exit();
                  	  }
                    });
                   // loop.next();
          	  });
  			  
  			  // after detecting hack => do fix database
  			  setTimeout(function(){
  				
      			  lib.syncLoop(stats.last - tmpLast, function(loop){
      				  var ii = loop.iteration();
      				  console.log('test ii:',ii,' tmp lastr ',tmpLast);
      				  Block.findOne({height: tmpLast+ii+1}, function(err,errBlk){
      					  if(errBlk){
      						  //console.log('error block', errBlk);   
      						  //update transaction and address
              				  db.updateErrorInfo(errBlk, function(){
              					//remove this block
              					  
                  				  Block.remove({height: tmpLast+ii+1},function(){
                  					  //update from wrong block position
                  					stats.last = tmpLast+1;//update last block need to rerun
                    				  db.update_tx_db(settings.coin, stats.last, stats.count, settings.update_timeout, function(){
                                          db.update_richlist('received', function(){
                                            db.update_richlist('balance', function(){
                                              db.get_stats(settings.coin, function(nstats){
                                                console.log('update complete (block: %s)', nstats.last);
                                                exit();
                                              });
                                            });
                                          });
                                        });
                  				  });
                  				  //exit();
              				  });                            					
      					  }
      					  else{
      						  console.log('error block');   
      						  exit();
      					  }
      				  });   
      				  //Block.findOneAndRemove({height:tmpLast+ii+1}, function(){ 
      				  setTimeout(function(){
      					  loop.next();
      				  },10);
      				  //loop.next();       				 
      			  });
      			  
  			  },200);
  			  //setTimeout(function(){exit();},300);
  			  //exit();                    			  
  		  }                  		  
  	  }
  	  else{
  		  console.log('error: not a string');
  		  exit();
  	  }
	  });
}