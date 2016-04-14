/**
 * http://usejsdoc.org/
 */
var mongoose = require('mongoose')
  , Schema = mongoose.Schema;
 
var BlocksSchema = new Schema({
  blockhash: { type: String, unique: true, index: true},
  prev_block: { type: String},
  //block_number:{type:Number},
  txs: { type: Array, default: [] },
  height:{type:Number},

}, {id: false});

module.exports = mongoose.model('Block', BlocksSchema);

