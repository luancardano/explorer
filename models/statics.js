var mongoose = require('mongoose')
  , Schema = mongoose.Schema;
 
var StaticsSchema = new Schema({
  coin: { type: String },
  count: { type: Number, default: 1 },
  last: { type: Number, default: 1 },
  //difficulty: { type: Object, default: {} },
  //hashrate: { type: String, default: 'N/A' },
  supply: { type: Number, default: 0 },
  //last_txs: { type: Array, default: [] },
  connections: { type: Number, default: 0 },
  last_price: { type: Number, default: 0 },
  //last_block: {height: {type:Number}, hash: {type:String}},
  lasthash: { type: String },
});

module.exports = mongoose.model('Statics', StaticsSchema);