
var mongoose = require('mongoose'), 
db = require('../lib/database'), 
UTx = require('../models/utx'),
Tx = require('../models/tx'), 
UAddress = require('../models/uaddress'),
Richlist = require('../models/richlist'), 
Stats = require('../models/statics'), 
settings = require('../lib/settings'),
lib = require('../lib/explorer'), 
fs = require('fs');

var tempFileName = 'mempool';
var dbString = 'mongodb://' + settings.dbsettings.user;
dbString = dbString + ':' + settings.dbsettings.password;
dbString = dbString + '@' + settings.dbsettings.address;
dbString = dbString + ':' + settings.dbsettings.port;
dbString = dbString + '/' + settings.dbsettings.database;

/**
 * Create lock file(if file exists --> processing)
 * @param cb
 */
function create_lock(cb) {
	
	var fname = './tmp/' + tempFileName + '.pid';
	fs.appendFile(fname, process.pid, function(err) {
		if (err) {
			console.log("Error: unable to create %s", fname);
			process.exit(1);
		} else {
			return cb();
		}
	});
	
}
/**
 * Remove lock file
 * @param cb
 */
function remove_lock(cb) {
	
	var fname = './tmp/' + tempFileName + '.pid';
	fs.unlink(fname, function(err) {
		if (err) {
			console.log("unable to remove lock: %s", fname);
			process.exit(1);
		} else {
			return cb();
		}
	});
	
}
/**
 * Check lock file exist
 * @param cb
 */
function is_locked(cb) {
	var fname = './tmp/' + tempFileName + '.pid';
	fs.exists(fname, function(exists) {
		if (exists) {
			return cb(true);
		} else {
			return cb(false);
		}
	});
}
/**
 * Exit process
 */
function exit() {
	remove_lock(function() {
		mongoose.disconnect();
		process.exit(0);
	});
}

is_locked(function(exists) {
	if (exists) {
		console.log("Script mempool already running..");
		process.exit(0);
	} else {
		mongoose.connect(dbString, function(err) {
			if (err) {
				console.log('Unable to connect to database: %s', dbString);
				console.log('Aborting');
				exit();
			} else {
				create_lock(function (){
					// Get unconfirm transaction in memory
					lib.get_rawmempool(function(txes){
						// Loop throught all tx
						lib.syncLoop(txes.length, function (subloop) {
							var i = subloop.iteration();
							console.log('unconfirm tx:' + txes[i]);
							// Check tx exists in table utx
							UTx.findOne({txid: txes[i]}, function(err, utx) {
								if(utx) {
									utx = null;
									subloop.next();
								} else {
									// Check txt exists in tabl tx
									Tx.findOne({txid:txes[i]}, function(err, tx){
										if(tx){
											tx = null;
											subloop.next();
										} else {
											db.save_utx(txes[i], function(err){
												if (err) {
													console.log(err);
												} else {
													console.log('txid=%s', txes[i]);
												}
												setTimeout( function(){
													utx = null;
													subloop.next();
												}, settings.update_timeout);
											});
										}
									});
									
									
								}
							});
						}, function(){
							console.log('end loop');
							exit();
						});
					});
				});
			}
		});
		
		
	}
});
