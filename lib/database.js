var mongoose = require('mongoose')
  , Stats = require('../models/statics')
  , Markets = require('../models/markets')
  , Address = require('../models/address')
  ,Block = require('../models/blocks')
  , Tx = require('../models/tx')
  , UAddress = require('../models/uaddress')
  , UTx = require('../models/utx')
  , Richlist = require('../models/richlist')
  , Heavy = require('../models/heavy')
  , lib = require('./explorer')
  , settings = require('./settings')
  , poloniex = require('./markets/poloniex')
  , bittrex = require('./markets/bittrex')
  , bleutrade = require('./markets/bleutrade')
  , cryptsy = require('./markets/cryptsy')
  , yobit = require('./markets/yobit')
  , empoex = require('./markets/empoex')
  , fs = require('fs')
  , util = require('util');

function find_address(hash, cb) {
  Address.findOne({a_id: hash}, function(err, address) {
    if(address) {
      return cb(address);
    } else {
      return cb();
    }
  });
}
function find_uaddress(hash, cb) {
	  UAddress.findOne({a_id: hash}, function(err, address) {
	    if(address) {
	      return cb(address);
	    } else {
	      return cb();
	    }
	  });
	}
function find_richlist(coin, cb) {
  Richlist.findOne({coin: coin}, function(err, richlist) {
    if(richlist) {
      return cb(richlist);
    } else {
      return cb();
    }
  });
}

function update_address_error(hash, txid, amount, type, n, prev_txid, cb) {
  // Check if address exists
  find_address(hash, function(address) {
    if (address) {
    	//console.log('update_address_error function - address ',address);
      // if coinbase (new coins PoW), update sent only and return cb.
      if ( hash == 'coinbase' ) {
        Address.update({a_id:hash}, {
          //sent: address.sent + amount,
        	sent: address.sent - amount,
		      balance: 0,
        }, function() {
          return cb();
        });
      } else {
    	
        // ensure tx doesnt already exist in address.txs
        lib.is_unique(address.txs, txid, function(unique, index) {
          var tx_array = address.txs;
          var received = address.received;
          var sent = address.sent;
          var spentable = false;
          if (type == 'vin') {
            //sent = s
        	  ent + amount;
            sent = sent - amount;
            spentable = false;
          } else {
            //received = received + amount;
            received = received - amount;
          }  
          lib.syncLoop(tx_array.length, function(loop){
        	  var ii = loop.iteration();
        	  //console.log('test array : ', tx_array[ii]);
        	  tx_array[ii].spentable = false;
        	  loop.next();
          })
          //if (unique == true) {
          if (unique == false) {
            //tx_array.push({addresses: txid, type: type, n:n, spentable:spentable});
            //tx_array.push({addresses: txid, type: type, n:n, spentable:true});
//	            if ( tx_array.length > settings.txcount ) {
//	              tx_array.shift();
//	            }
            Address.update({a_id:hash}, {
              txs: tx_array,
              received: received,
              sent: sent,
              balance: received - sent
              //spentable:false
            }, function() {
              return cb();
            });
          } else {
        	 /*
            if (type == tx_array[index].type) { 
              return cb(); //duplicate
            } else { 
            	
            	
              Address.update({a_id:hash}, {
                txs: tx_array,
                received: received,
                sent: sent,
                balance: received - sent
              }, function() {
                return cb();
              });
            } */
          }
        });
      }
    } 
  });
}

function update_address(hash, txid, amount, type, n, prev_txid, cb) {
  // Check if address exists
  find_address(hash, function(address) {
    if (address) {
      // if coinbase (new coins PoW), update sent only and return cb.
      if ( hash == 'coinbase' ) {
        Address.update({a_id:hash}, {
          sent: address.sent + amount,
		      balance: 0,
        }, function() {
          return cb();
        });
      } else {
    	// Find txid of address
    	  var prev_index = -1;
    	  for(var k = 0; k < address.txs.length; k++) {
    		  if (address.txs[k].addresses == prev_txid) {
    			  prev_index = k;
    			  break;
    		  }
    	  }
        // ensure tx doesnt already exist in address.txs
        lib.is_unique(address.txs, txid, function(unique, index) {
          var tx_array = address.txs;
          var received = address.received;
          var sent = address.sent;
          var spentable = true;
          if (type == 'vin') {
            sent = sent + amount;
            spentable = false;
          } else {
            received = received + amount;
          }
          
          if(hash == '1HdJ7fyMpP1nrdPkFgw5WfW6H1JnxxPdzJ'){
        	  console.log('txid: ' + txid)
        	  console.log('prev txid: ' + prev_txid)
        	  console.log('n: ' + n)
        	  console.log('prev_index: ' + prev_index)
    		  console.log('exist: %s = %s', unique, spentable);        	  
    		  
    	  }
          
          if(prev_index >=0) {
      		tx_array[prev_index].spentable = false;
          }
          
          if (unique == true) {
            tx_array.push({addresses: txid, type: type, n:n, spentable:spentable}); 
//            if ( tx_array.length > settings.txcount ) {
//              tx_array.shift();
//            }
            Address.update({a_id:hash}, {
              txs: tx_array,
              received: received,
              sent: sent,
              balance: received - sent
            }, function() {
              return cb();
            });
          } else {
        	 
            if (type == tx_array[index].type) { 
              return cb(); //duplicate
            } else { 
            	
            	
              Address.update({a_id:hash}, {
                txs: tx_array,
                received: received,
                sent: sent,
                balance: received - sent
              }, function() {
                return cb();
              });
            } 
          }
        });
      }
    } else {
      //new address
      if (type == 'vin') {
        var newAddress = new Address({
          a_id: hash,
          txs: [ {addresses: txid, type: 'vin', n:n} ],
          sent: amount,
          balance: amount,
        });
      } else {
        var newAddress = new Address({
          a_id: hash,
          txs: [ {addresses: txid, type: 'vout', n:n, spentable: true} ],
          received: amount,
          balance: amount,
        });
      }
      
      newAddress.save(function(err) {
        if (err) {
          return cb(err);
        } else {
          //console.log('address saved: %s', hash);
          //console.log(newAddress);
          return cb();
        }
      });
    }
  });
}

function find_tx(txid, cb) {
  Tx.findOne({txid: txid}, function(err, tx) {
    if(tx) {
      return cb(tx);
    } else {
      return cb(null);
    }
  });
}


function update_uaddress(hash, txid, amount, type, cb) {
	  // Check if address exists
	  find_uaddress(hash, function(address) {
	    if (address) {
	      // if coinbase (new coins PoW), update sent only and return cb.
	      if ( hash == 'coinbase' ) {
	        UAddress.update({a_id:hash}, {
	          sent: address.sent + amount,
			      balance: 0,
	        }, function() {
	          return cb();
	        });
	      } else {
	        // ensure tx doesn't already exist in address.txs
	        lib.is_unique(address.txs, txid, function(unique, index) {
	          var tx_array = address.txs;
	          var received = address.received;
	          var sent = address.sent;
	          if (type == 'vin') {
	            sent = sent + amount;
	          } else {
	            received = received + amount;
	          }
	          if (unique == true) {  
	            tx_array.push({addresses: txid, type: type}); 
	            if ( tx_array.length > settings.txcount ) {
	              tx_array.shift();
	            }
	            UAddress.update({a_id:hash}, {
	              txs: tx_array,
	              received: received,
	              sent: sent,
	              balance: received - sent
	            }, function() {
	              return cb();
	            });
	          } else {
	            if (type == tx_array[index].type) { 
	              return cb(); //duplicate
	            } else { 
	              UAddress.update({a_id:hash}, {
	                txs: tx_array,
	                received: received,
	                sent: sent,
	                balance: received - sent
	              }, function() {
	                return cb();
	              });
	            } 
	          }
	        });
	      }
	    } else {
	      //new address
	      if (type == 'vin') {
	        var newAddress = new UAddress({
	          a_id: hash,
	          txs: [ {addresses: txid, type: 'vin'} ],
	          sent: amount,
	          balance: amount,
	        });
	      } else {
	        var newAddress = new UAddress({
	          a_id: hash,
	          txs: [ {addresses: txid, type: 'vout'} ],
	          received: amount,
	          balance: amount,
	        });
	      }
	      
	      newAddress.save(function(err) {
	        if (err) {
	          return cb(err);
	        } else {
	          //console.log('address saved: %s', hash);
	          //console.log(newAddress);
	          return cb();
	        }
	      });
	    }
	  });
	}

function find_utx(txid, cb) {
	  UTx.findOne({txid: txid}, function(err, tx) {
	    if(tx) {
	      return cb(tx);
	    } else {
	      return cb(null);
	    }
	  });
	}

function save_tx(txid, cb) { 
  //var s_timer = new Date().getTime(); 
  lib.get_rawtransaction(txid, function(tx){
    if (tx != 'There was an error. Check your console.') {
      lib.get_block(tx.blockhash, function(block){
        if (block) {
          lib.prepare_vin(tx, function(vin) {
            lib.prepare_vout(tx.vout, txid, vin, function(vout, nvin) {
              lib.syncLoop(vin.length, function (loop) {
                var i = loop.iteration();
              
                update_address(nvin[i].addresses, txid, nvin[i].amount, 'vin', nvin[i].n, nvin[i].prev_txid, function(){
            		loop.next();
                });  
              }, function(){  
                lib.syncLoop(vout.length, function (subloop) {
                  var t = subloop.iteration();
                  
                  if (vout[t].addresses) {
                    update_address(vout[t].addresses, txid, vout[t].amount, 'vout', vout[t].n, "", function(){
                      subloop.next();
                    });  
                  } else {
                    subloop.next();
                  }
                }, function(){
                  lib.calculate_total(vout, function(total){
                    var newTx = new Tx({
                      txid: tx.txid,
                      vin: nvin,
                      vout: vout,
                      total: total.toFixed(8),
                      timestamp: tx.time,
                      blockhash: tx.blockhash,
                      blockindex: block.height,
                    });
                    newTx.save(function(err) {
                      if (err) {
                        return cb(err);
                      } else {
//                        console.log('save tx: ' + newTx);
                        return cb();
                      }
                    });
                  });
                });
              });
            });
          });  
        } else {
          return cb('block not found: ' + tx);
        }
      });
    } else {
      return cb('tx not found: ' + txid);
    }
  });
}

function get_market_data(market, cb) {
  switch(market) {
    case 'bittrex':
      bittrex.get_data(settings.markets.coin, settings.markets.exchange, function(err, obj){
        return cb(err, obj);
      });
      break;
    case 'bleutrade':
      bleutrade.get_data(settings.markets.coin, settings.markets.exchange, function(err, obj){
        return cb(err, obj);
      });
      break;
    case 'poloniex':
      poloniex.get_data(settings.markets.coin, settings.markets.exchange, function(err, obj){
        return cb(err, obj);
      });
      break;
    case 'cryptsy':
      cryptsy.get_data(settings.markets.coin, settings.markets.exchange, settings.markets.cryptsy_id, function(err, obj){
        return cb(err, obj);
      });
      break;
    case 'yobit':
      yobit.get_data(settings.markets.coin.toLowerCase(), settings.markets.exchange.toLowerCase(), function(err, obj){
        return cb(err, obj);
      });
      break;
    case 'empoex':
      empoex.get_data(settings.markets.coin, settings.markets.exchange, function(err, obj){
        return cb(err, obj);
      });
      break;
    default:
      return cb(null);
  }
}

module.exports = {
  // initialize DB
  connect: function(database, cb) {
    mongoose.connect(database, function(err) {
      if (err) {
        console.log('Unable to connect to database: %s', database);
        console.log('Aborting');
        process.exit(1);

      }
      //console.log('Successfully connected to MongoDB');
      return cb();
    });
  },

  check_stats: function(coin, cb) {
    Stats.findOne({coin: coin}, function(err, stats) {
      if(stats) {
        return cb(true);
      } else {
        return cb(false);
      }
    });
  },

  get_stats: function(coin, cb) {
    Stats.findOne({coin: coin}, function(err, stats) {
      if(stats) {
        return cb(stats);
      } else {
        return cb(null);
      }
    });
  },

  create_stats: function(coin, cb) {
    var newStats = new Stats({
      coin: coin,
    });

    newStats.save(function(err) {
      if (err) {
        console.log(err);
        return cb();
      } else {
        console.log("initial stats entry created for %s", coin);
        //console.log(newStats);
        return cb();
      }
    });
  },

  get_address: function(hash, cb) {
    find_address(hash, function(address){
      return cb(address);
    });
  },

  get_richlist: function(coin, cb) {
    find_richlist(coin, function(richlist){
      return cb(richlist);
    });
  },
  //property: 'received' or 'balance'
  update_richlist: function(list, cb){
    if(list == 'received') {
      Address.find({}).sort({received: 'desc'}).limit(100).exec(function(err, addresses){
        Richlist.update({coin: settings.coin}, {
          received: addresses,
        }, function() {
          return cb();
        });
      });
    } else { //balance
      Address.find({}).sort({balance: 'desc'}).limit(100).exec(function(err, addresses){
        Richlist.update({coin: settings.coin}, {
          balance: addresses,
        }, function() {
          return cb();
        });
      });
    }
  },

  get_tx: function(txid, cb) {
    find_tx(txid, function(tx){
      return cb(tx);
    });
  },

  get_txs: function(block, cb) {
    var txs = [];
    lib.syncLoop(block.tx.length, function (loop) {
      var i = loop.iteration();
      find_tx(block.tx[i], function(tx){
        if (tx) {
          txs.push(tx);
          loop.next();
        } else {
          loop.next();
        }
      })
    }, function(){
      return cb(txs);
    });
  },

  create_tx: function(txid, cb) {
    save_tx(txid, function(err){
      if (err) {
        return cb(err);
      } else {
        //console.log('tx stored: %s', txid);
        return cb();
      }
    });
  },
  
  create_txs: function(block, cb) {
    lib.syncLoop(block.tx.length, function (loop) {
      var i = loop.iteration();
      save_tx(block.tx[i], function(err){
        if (err) {
          loop.next();
        } else {
          //console.log('tx stored: %s', block.tx[i]);
          loop.next();
        }
      });
    }, function(){
      return cb();
    });
  },
  
  get_last_txs: function(count, min, cb) {
    Tx.find({'total': {$gt: min}}).sort({_id: 'desc'}).limit(count).exec(function(err, txs){
      if (err) {
        return cb(err);
      } else {
        return cb(txs);
      }
    });
  },

  create_market: function(coin, exchange, market, cb) {
    var newMarkets = new Markets({
      market: market,
      coin: coin,
      exchange: exchange,
    });

    newMarkets.save(function(err) {
      if (err) {
        console.log(err);
        return cb();
      } else {
        console.log("initial markets entry created for %s", market);
        //console.log(newMarkets);
        return cb();
      }
    });
  },
  
  // checks market data exists for given market
  check_market: function(market, cb) {
    Markets.findOne({market: market}, function(err, exists) {
      if(exists) {
        return cb(market, true);
      } else {
        return cb(market, false);
      }
    });
  },

  // gets market data for given market
  get_market: function(market, cb) {
    Markets.findOne({market: market}, function(err, data) {
      if(data) {
        return cb(data);
      } else {
        return cb(null);
      }
    });
  },

  // creates initial richlist entry in database; called on first launch of explorer
  create_richlist: function(coin, cb) {
    var newRichlist = new Richlist({
      coin: coin,
    });
    newRichlist.save(function(err) {
      if (err) {
        console.log(err);
        return cb();
      } else {
        console.log("initial richlist entry created for %s", coin);
        //console.log(newRichlist);
        return cb();
      }
    });
  },
  // checks richlist data exists for given coin
  check_richlist: function(coin, cb) {
    Richlist.findOne({coin: coin}, function(err, exists) {
      if(exists) {
        return cb(true);
      } else {
        return cb(false);
      }
    });
  },
  
  create_heavy: function(coin, cb) {
    var newHeavy = new Heavy({
      coin: coin,
    });
    newHeavy.save(function(err) {
      if (err) {
        console.log(err);
        return cb();
      } else {
        console.log("initial heavy entry created for %s", coin);
        console.log(newHeavy);
        return cb();
      }
    });
  },
  
  check_heavy: function(coin, cb) {
    Heavy.findOne({coin: coin}, function(err, exists) {
      if(exists) {
        return cb(true);
      } else {
        return cb(false);
      }
    });
  },

  get_heavy: function(coin, cb) {
    Heavy.findOne({coin: coin}, function(err, heavy) {
      if(heavy) {
        return cb(heavy);
      } else {
        return cb(null);
      }
    });
  },
  get_distribution: function(richlist, stats, cb){
    var distribution = {
      supply: stats.supply,
      t_1_25: {percent: 0, total: 0 },
      t_26_50: {percent: 0, total: 0 },
      t_51_75: {percent: 0, total: 0 },
      t_76_100: {percent: 0, total: 0 },
      t_101plus: {percent: 0, total: 0 }
    };
    lib.syncLoop(richlist.balance.length, function (loop) {
      var i = loop.iteration();
      var count = i + 1;
      var percentage = ((richlist.balance[i].balance / 100000000) / stats.supply) * 100;
      if (count <= 25 ) {
        distribution.t_1_25.percent = distribution.t_1_25.percent + percentage;
        distribution.t_1_25.total = distribution.t_1_25.total + (richlist.balance[i].balance / 100000000);
      }
      if (count <= 50 && count > 25) {
        distribution.t_26_50.percent = distribution.t_26_50.percent + percentage;
        distribution.t_26_50.total = distribution.t_26_50.total + (richlist.balance[i].balance / 100000000);
      }
      if (count <= 75 && count > 50) {
        distribution.t_51_75.percent = distribution.t_51_75.percent + percentage;
        distribution.t_51_75.total = distribution.t_51_75.total + (richlist.balance[i].balance / 100000000);
      }
      if (count <= 100 && count > 75) {
        distribution.t_76_100.percent = distribution.t_76_100.percent + percentage;
        distribution.t_76_100.total = distribution.t_76_100.total + (richlist.balance[i].balance / 100000000);
      }
      loop.next();
    }, function(){
      distribution.t_101plus.percent = parseFloat(100 - distribution.t_76_100.percent - distribution.t_51_75.percent - distribution.t_26_50.percent - distribution.t_1_25.percent).toFixed(2);
      distribution.t_101plus.total = parseFloat(distribution.supply - distribution.t_76_100.total - distribution.t_51_75.total - distribution.t_26_50.total - distribution.t_1_25.total).toFixed(8);
      distribution.t_1_25.percent = parseFloat(distribution.t_1_25.percent).toFixed(2);
      distribution.t_1_25.total = parseFloat(distribution.t_1_25.total).toFixed(8);
      distribution.t_26_50.percent = parseFloat(distribution.t_26_50.percent).toFixed(2);
      distribution.t_26_50.total = parseFloat(distribution.t_26_50.total).toFixed(8);
      distribution.t_51_75.percent = parseFloat(distribution.t_51_75.percent).toFixed(2);
      distribution.t_51_75.total = parseFloat(distribution.t_51_75.total).toFixed(8);
      distribution.t_76_100.percent = parseFloat(distribution.t_76_100.percent).toFixed(2);
      distribution.t_76_100.total = parseFloat(distribution.t_76_100.total).toFixed(8);
      return cb(distribution);
    });
  },
  // updates heavy stats for coin
  // height: current block height, count: amount of votes to store
  update_heavy: function(coin, height, count, cb) {    
    var newVotes = [];
    lib.get_maxmoney( function (maxmoney) {
      lib.get_maxvote( function (maxvote) {
        lib.get_vote( function (vote) {
          lib.get_phase( function (phase) {
            lib.get_reward( function (reward) {
              lib.get_supply( function (supply) {
                lib.get_estnext( function (estnext) {
                  lib.get_nextin( function (nextin) {
                    lib.syncLoop(count, function (loop) {
                      var i = loop.iteration();
                      lib.get_blockhash(height-i, function (hash) {
                        lib.get_block(hash, function (block) {
                          newVotes.push({count:height-i,reward:block.reward,vote:block.vote});
                          loop.next();
                        });
                      });                      
                    }, function(){
                      console.log(newVotes);
                      Heavy.update({coin: coin}, {
                        lvote: vote,
                        reward: reward,
                        supply: supply,
                        cap: maxmoney,
                        estnext: estnext,
                        phase: phase,
                        maxvote: maxvote,
                        nextin: nextin,
                        votes: newVotes,
                      }, function() {
                        //console.log('address updated: %s', hash);
                        return cb();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });  
  },

  // updates market data for given market; called by sync.js
  update_markets_db: function(market, cb) {
    get_market_data(market, function (err, obj) {
      if (err == null) {
        Markets.update({market:market}, {
          chartdata: JSON.stringify(obj.chartdata),
          buys: obj.buys,
          sells: obj.sells,
          history: obj.trades,
          summary: obj.stats,
        }, function() {
          if ( market == settings.markets.default ) {
            Stats.update({coin:settings.coin}, {
              last_price: obj.stats.last,
            }, function(){
              return cb(null);
            });
          } else {
            return cb(null);
          }
        });
      } else {
        return cb(err);
      }
    });
  },
  
  // updates stats data for given coin; called by sync.js
  update_db: function(coin, cb) {
    lib.get_blockcount( function (count) {
      if (!count){
        console.log('Unable to connect to explorer API');
        return cb(false);
      }
      lib.get_supply( function (supply){                             
        lib.get_connectioncount(function (connections) {
          Stats.update({coin: coin}, { 
            coin: coin,
            count : count,
            supply: supply,
            connections: connections,
          }, function() {
            return cb(true);
          });
        });
      });
    });
  },

  /**
   * Insert tx to database
   * @param txid
   * @param cb
   */
  save_utx: function(txid, cb) {
  	lib.get_rawtransaction(txid, function(tx) {
  		if (tx != 'There was an error. Check your console.') {
  		
  				lib.prepare_vin(tx, function(vin) {
  					lib.prepare_vout(tx.vout, txid, vin, function(vout, nvin) {
  						lib.syncLoop(vin.length, function(loop) {
  							var i = loop.iteration();
  							update_uaddress(nvin[i].addresses, txid,
  									nvin[i].amount, 'vin', function() {
  										loop.next();
  									});
  						}, function() {
  							lib.syncLoop(vout.length, function(subloop) {
  								var t = subloop.iteration();
  								if (vout[t].addresses) {
  									update_uaddress(vout[t].addresses, txid,
  											vout[t].amount, 'vout',
  											function() {
  												subloop.next();
  											});
  								} else {
  									subloop.next();
  								}
  							}, function() {
  								lib.calculate_total(vout, function(total) {
  									var newTx = new UTx({
  										txid : tx.txid,
  										vin : nvin,
  										vout : vout,
  										total : total.toFixed(8),
  										timestamp : tx.time,
  										blockhash : tx.blockhash,
  										blockindex : -1,
  									});
  									newTx.save(function(err) {
  										if (err) {
  											return cb(err);
  										} else {
  											//console.log('txid: ');
  											return cb();
  										}
  									});
  								});
  							});
  						});
  					});
  				});
  			
  			
  		} else {
  			return cb('tx not found: ' + txid);
  		}
  	});
  },
  
  updateErrorInfo: function(block,cb){
		lib.syncLoop(block.txs.length, function(loop){
			var ii = loop.iteration();
			//console.log('trans: ',block.txs[ii]);
			
			unsave_tx(block.txs[ii],function(err){
				console.log(err);
			});
			setTimeout(function(){
				loop.next();
			},10);			
		}) ;
		return cb();
	},
  // updates tx, address & richlist db's; called by sync.js
  update_tx_db: function(coin, start, end, timeout, cb) {
    var complete = false;
    lib.syncLoop((end - start) + 1, function (loop) {      
      var x = loop.iteration();
      if (x % 5000 === 0) {      
        Tx.find({}).where('blockindex').lt(start + x).sort({timestamp: 'desc'}).limit(settings.index.last_txs).exec(function(err, txs){
          Stats.update({coin: coin}, { 
            last: start + x - 1,
            last_txs: '' //not used anymore left to clear out existing objects
          }, function() {});
        });
      }     
      lib.get_blockhash(start + x, function(blockhash){    	  
        if (typeof blockhash === "string") {
          lib.get_block(blockhash, function(block) {
            if (block) {            
            	//update last hash            	
            	//Stats.update({coin:coin},{lastHash: blockhash}, function(){});
            	
            	
            	/*
             	if(start+x == 1){
            		var newblock = new Block({blockhash:blockhash, block_number:1,prev_block: "",height:1});
            		newblock.save(function(err) {
    	    	        if (err) {
    	    	            //return cb(err);
    	    	        	console.log(err)
    	    	          } else {
    	    	            //console.log('address saved: %s', hash);
    	    	            //console.log(newAddress);
    	    	            //return cb();
    	    	        	  //console.log("not error for get blockhash")
    	    	          }
    	    	        });
            	}
            	else
        		{           
            		Block.aggregate([
    	                 {
    	                     $group: {
    	                         _id: null,  //$region is the column name in collection
    	                         count: {$sum: 1}
    	                     }
    	                 }
    	             ], function (err, result) {
    	                 if (err) {
    	                    console.log(err);
    	                 } else {
    	                	 console.log('test result:',result[0]);
    	                	 //console.log('amount:',result[0].count);   
    	                	 var numberRecords = result[0].count;
    	                	 if(numberRecords < 6)
	                		 {  	                		 
    	                		     	                		 	
	                		 }
    	                	 else // if there are more than 2 records in blocks collection => remove number 1,update number 2 to 1
	                		 {
    	                 		 Block.remove({block_number:1},function(err){
    	                			 if(err){
    	                				 console.log(err);
    	                			 }
    	                			 else{
    	                				 Block.update({},{block_number:1},function(){});
    	                			 }   				 
    	                				 
    	                		 });	                		 
    	                		 
	                		 }
    	                	 
    	                	 lib.get_blockhash(start+x+1, function(newHash){ 	                 			
 	                 			var newblock = new Block({blockhash:newHash, block_number:2,prev_block: blockhash,height:start+x});
 	                     		newblock.save(function(err) {
 	             	    	        if (err) {
 	             	    	            //return cb(err);
 	             	    	        	console.log(err)
 	             	    	          } else {
 	             	    	            //console.log('address saved: %s', hash);
 	             	    	            //console.log(newAddress);
 	             	    	            //return cb();
 	             	    	        	  //console.log("not error for get blockhash")
 	             	    	          }
 	             	    	        });
 	                 		});
    	                	
    	                 }
    	             });
            		
        			 
        		} */
            	
              lib.syncLoop(block.tx.length, function (subloop) {
                var i = subloop.iteration();
                Tx.findOne({txid: block.tx[i]}, function(err, tx) {
                  if(tx) {
                    tx = null;
                    subloop.next();
                  } else {
                    save_tx(block.tx[i], function(err){
                      if (err) {
                        console.log(err);
                      } else {
                        console.log('%s: %s', block.height, block.tx[i]);
                      }
                      setTimeout( function(){
                        tx = null;
                        subloop.next();
                      }, timeout);
                    });
                  }
                });
              }, function(){
                blockhash = null;
                block = null;
                loop.next();
              });
              
            //if this first block => create new one and insert to db
          	if(start+x == 1){
          		var newblock = new Block({blockhash:blockhash, prev_block: "",height:1,txs:block.tx});
          		newblock.save(function(err) {
  	    	        if (err) {
  	    	            //return cb(err);
  	    	        	console.log(err)
  	    	          } else {
  	    	            //console.log('address saved: %s', hash);
  	    	            //console.log(newAddress);
  	    	            //return cb();
  	    	        	//console.log("not error for get blockhash")
  	    	          }
  	    	        });
          	}
          	else // if not first block
      		{           
          		Block.aggregate([
  	                 {
  	                     $group: {
  	                         _id: null,  //$region is the column name in collection
  	                         count: {$sum: 1}
  	                     }
  	                 }
  	             ], function (err, result) {
  	                 if (err) {
  	                    console.log(err);
  	                 } else {
  	                	 console.log('test result:',result[0]);
  	                	 //console.log('amount:',result[0].count);   
  	                	 var numberRecords = result[0].count;
  	                	 if(numberRecords > 0 && numberRecords < 6) // if 0 < numberBlock < 6 => insert
	                		 {
  	                		 var newblock = new Block({blockhash:blockhash, prev_block: block.previousblockhash,height:start+x,txs: block.tx});
  	                     		newblock.save(function(err) {
  	             	    	        if (err) {
  	             	    	            //return cb(err);
  	             	    	        	console.log(err)
  	             	    	          } 
  	             	    	        else {
  	             	    	            //return cb();
  	             	    	          }
  	                     		});                		 	
	                		 }
  	                	 else if(numberRecords >= 6)// if there are more than 6 records in blocks collection => remove first one and insert new one
	                		 {
  	                		 //remove first block
  	                		 Block.findOneAndRemove({},function(err){
  	                			 if(err){
  	                				 console.log(err);
  	                			 }
  	                			 else{
  	                				 //Block.update({},{block_number:1},function(){});
  	                			 }    	                				 
  	                		 });	
  	                		 //update last block from yes to no
  	                		 //Block.update({last:"yes"}, {last:"no"},function(){});
  	                		 
  	                		 var newblock = new Block({blockhash:blockhash, 
  	                			 prev_block: block.previousblockhash,
  	                			 height:start+x,txs: block.tx});
	                     		newblock.save(function(err) {
	             	    	        if (err) {
	             	    	            //return cb(err);
	             	    	        	console.log(err)
	             	    	          } 
	             	    	        else {
	             	    	            //console.log('address saved: %s', hash);
	             	    	            //console.log(newAddress);
	             	    	            //return cb();
	             	    	        	  //console.log("not error for get blockhash")
	 	             	    	        //update stats
	 	             	    	      	Stats.update({coin: coin}, { 
	 	             	    	        	  //last_block.height: 111,
	 	             	    	              last: start + x,
	 	             	    	        	  //last: start + x,
	 	             	    	              lasthash: blockhash,
	 	             	    	              last_txs: '' //not used anymore left to clear out existing objects
	 	             	    	            }, function() {});
	             	    	          }
	                     		});
	                		 }                  	 	
  	                 } 
          		});
      		}
              
            } else {
              loop.next();
            }
          });
        } else {
        	console.log('block hash not found: %s', start + x);            
            setTimeout(function(){
            	loop.next();
            }, 1000);
        }
        
      
      });
    }, function(){
      Tx.find({}).sort({timestamp: 'desc'}).limit(settings.index.last_txs).exec(function(err, txs){
        Stats.update({coin: coin}, { 
          last: end,
          last_txs: '' //not used anymore left to clear out existing objects
        }, function() {
          return cb();
        });  
      });
    });
  },
  remove_utx: function(txid, cb) {
	  UTx.findOne({'txid': txid}, function(err, tx){
		  tx.remove(function(err,removed){
			  if(removed) {
				  var vin = tx.vin;
				  var vout = tx.vout;
				  lib.syncLoop(vin.length, function (loop) {
		                var i = loop.iteration();
		                // Remove transaction from tx array of address
		                find_uaddress(nvin[i].addresses, function(err, address){
		                	 if(address) {
		                		 
		                		for(var j = 0; j < address.txs.length; j++){
		                			if(address.txs[j].addresses == txid) {
		                				address.txs.splice(j, 1);
		                				address.save(function(){
		                					loop.next();
		                				});
		                			}
		                		}
		                	} else {
		                		loop.next();
		                	}
		                });
		              }, function(){  
		                lib.syncLoop(vout.length, function (subloop) {
		                  var t = subloop.iteration();
		                  // Remove transaction from tx array of address
			                find_uaddress(vout[t].addresses, function(err, address){
			                	 if(address) {
			                		 
			                		for(var j = 0; j < address.txs.length; j++){
			                			if(address.txs[j].addresses == txid) {
			                				address.txs.splice(j, 1);
			                				address.save(function(){
			                					subloop.next();
			                				});
			                			}
			                		}
			                	} else {String
			                		subloop.next();
			                	}
			                });
		                },function(){
		                	return cb();
		                });
		              });
			  }
		  });
		
	  });
	  
  }
};
function insertBlock(){
	
}
// change is_confirmed status of transaction to false
//update vin and vout of address
function unsave_tx(txid, cb) { 
	//console.log('test count ' ,txid);
	
	Tx.count({txid:txid}, function(err, count){
		//console.log('test count ' ,count);
		if(count == 1){			
			//console.log('test confirm: ' + txid);
			Tx.update({txid:txid},{is_confirmed:false, blockhash:"",blocktime:null,confirmations:null,blockindex:null},function(){});
			//Tx.find({txid:txid}, function(err,result){
			lib.get_rawtransaction(txid, function(tx){
				//tx = result[0];
				if(tx){
					
					console.log('updated address after hacking ',tx.txid);
					console.log('updated address after hacking ',tx.vout);					
					
					/*
					vout = tx.vout;
					nvin = tx.vin;		           
		              lib.syncLoop(nvin.length, function (loop) {
		                var i = loop.iteration();		             
		                update_address_error(nvin[i].addresses, txid, nvin[i].amount, 'vin', nvin[i].n, nvin[i].prev_txid, function(){
		                	
		            		loop.next();
		                });
		              }, function(){  
		                lib.syncLoop(vout.length, function (subloop) {
		                  var t = subloop.iteration();		                  
		                  if (vout[t].addresses) {		                
		                	  update_address_error(vout[t].addresses, txid, vout[t].amount, 'vout', vout[t].n, "", function(){
			                      subloop.next();
			                    });				                
		                  } else {
		                    subloop.next();
		                  }
		                });
		              });*/
					lib.prepare_vin(tx, function(vin) {
			            lib.prepare_vout(tx.vout, txid, vin, function(vout, nvin) {
			              lib.syncLoop(vin.length, function (loop) {
			                var i = loop.iteration();
			              
			                update_address_error(nvin[i].addresses, txid, nvin[i].amount, 'vin', nvin[i].n, nvin[i].prev_txid, function(){
			            		loop.next();
			                });  
			              }, function(){  
			                lib.syncLoop(vout.length, function (subloop) {
			                  var t = subloop.iteration();
			                  
			                  if (vout[t].addresses) {
			                    update_address_error(vout[t].addresses, txid, vout[t].amount, 'vout', vout[t].n, "", function(){
			                      subloop.next();
			                    });  
			                  } else {
			                    subloop.next();
			                  }
			                });
			              });
			            });
			          }); 
				}
				else{
					return cb('can not find this transaction');
				}
			})
			//console.log('test confirm sdads: ' + count);true
		}
		else{
			return cb('not find transaction');
		}
	});
}