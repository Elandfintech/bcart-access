(()=>{
	"use strict";
	
	const tiiny	 = require( 'tiinytiny' );
	const BN	 = require( 'bignumber.js' );
	const Web3	 = require( 'web3' );
	const crypto = require( 'crypto' );
	const ethTx	 = require( 'ethereumjs-tx' );
	const mongo	 = require( 'mongodb' );
	const config = require( 'json-cfg' );
	
	const bcartAPIs = {};
	
	
	
	let __web3Conn = null, __db = null;
	Object.defineProperties(bcartAPIs, {
		Initialize:{
			writable:false, enumerable:true, configurable:false,
			value:(info={})=>{
				return __INITIATE_WEB3(info)
				.then(()=>{return __INITIATE_DB(info);});
			}
		},
		Finalize:{
			writable:false, enumerable:true, configurable:false,
			value:(info={})=>{
				let _promises = [];
				if ( __web3Conn ) {
					__web3Conn = null;
				}
				
				if ( __db ) {
					_promises.push(__db.close());
					__db = null;
				}
				
				return tiiny.PromiseWaitAll(_promises);
			}
		},
		Connection:{
			enumerable:true, configurable:false,
			get:()=>{ return __web3Conn; }
		},
		GetBlock:{
			writable:false, enumerable:true, configurable:false,
			value:(blockId='latest', options={})=>{
				return __CHECK_VALID().then(()=>{
					return __FETCH_BLOCK(blockId, options);
				});
			}
		},
		GenRecord:{
			writable:false, enumerable:true, configurable:false,
			value:(from, to, data, nonce, amt = 0.01)=>{
				__CHECK_VALID_SYNC();
			
			
			
				if ( to.substring(0, 2) !== "0x" ) to = `0x${to}`;
				

				
				//get current median gasPrice
//				var price = web3Conn.eth.gasPrice;
				
				let dataPayload = Buffer.concat([
					Buffer.from( "SYM", "utf8" ),
					new Uint8Array([1]),
					Buffer.from( JSON.stringify(data), 'utf8' )
				]).toString( 'hex' );
				let data_hex = `0x${dataPayload}`;   // extra note
				let tx = new ethTx({
					nonce: __web3Conn.toHex(nonce),
					to: to,
					
					value: __web3Conn.toHex(__web3Conn.toWei(amt,'ether')),
					data: data_hex,
					
					// the price whatever you would pay even is '0', but not less than the minimum gas price that is set by miner
					gasPrice: __web3Conn.toHex(0),
					gasLimit: __web3Conn.toHex(__web3Conn.eth.estimateGas({to:to, data:data_hex}))
				});
				
				tx.sign(Buffer.from(from.privateKey, 'hex'));
				return tx.serialize().toString( 'hex' );
			}
		},
		SendRecord:{
			writable:false, enumerable:true, configurable:false,
			value:(from, to, data, nonce)=>{
				return __CHECK_VALID().then(()=>{
					return new Promise((fulfill, reject)=>{
						__web3Conn.eth.sendRawTransaction(
							'0x' + bcartAPIs.GenRecord(from, to, data, nonce),
							(err, hash)=>{ (err ? reject(err) : fulfill(hash)); }
						);
					});
				});
			}
		},
		TraverseBlocks:{
			writable:false, enumerable:true, configurable:false,
			value:(options={}, callback=(b,ctrl)=>{ctrl.more=false})=>{
				__CHECK_VALID_SYNC();
				return __TRAVERSE_BLOCKS(options, callback);
			}
		}
	});
	
	
	
	function __TRAVERSE_BLOCKS(options, callback) {
		let control = {more:true};
		let {from, to, getEmpty} = options;
		let qOptions = {
			fullRecords: options.fullRecords,
			parseTxn: options.parseTxn
		};
		
		from = from || 'latest';
		getEmpty = !!getEmpty;
		to = to || null;
		
		


		
		return __FETCH_BLOCK(from||'latest', qOptions).then(__FETCH_NEXT_BLOCK);
		
		
		function __FETCH_NEXT_BLOCK(blockInfo) {
			if (!getEmpty && (blockInfo.transactions.length > 0)) {
				control.more = true;
				callback(blockInfo, control);
			}
			
			if ( control.more && (!to || (blockInfo.hash !== to)) ) {
				let number = new BN.BigNumber(blockInfo.parentHash);
				if ( !number.equals(0) ) {
					return __FETCH_BLOCK(blockInfo.parentHash, qOptions).then(__FETCH_NEXT_BLOCK);
				}
			}
		}
	}
	function __FETCH_BLOCK(blockId='latest', options={}) {
		return new Promise((fulfill, reject)=>{
			let fullRecords = (options.fullRecords === undefined) ? true : !!options.fullRecords;
			let parseTxn = (options.parseTxn === undefined) ? true : !!options.parseTxn;
		
		
			__web3Conn.eth.getBlock(blockId, fullRecords, (err, block)=>{
				if ( err ) {
					reject(err);
					return;
				}
			
				if ( parseTxn ) {
					block.transactions.forEach((record)=>{
						try {
							if ( record.input.substring(0, 8) !== '0x53594d' ) {
								throw "Simple Transaction";
							}
							
							let raw	= record.input.substring(10);
							let ver = parseInt(record.input.substring(8, 10), 16);
							let rawContract = Buffer.from(raw, 'hex');
							let contract = JSON.parse(rawContract.toString( 'utf8' ));
							let sha256 = crypto.createHash( 'sha256' );
							record.contract = {
								hash: '0x' + sha256.update(rawContract).digest( 'hex' ),
								content:contract,
							};
							record.symmerified  = true;
							record.version = ver;
						}
						catch(err) {
							record.symmerified = false;
						}
					});
				}
				
				fulfill(block);
			});
		});
	}
	function __CHECK_VALID() {
		return new Promise((fulfill, reject)=>{ __web3Conn ? fulfill() : reject(); });
	}
	function __CHECK_VALID_SYNC() {
		if ( !__web3Conn ) {
			throw "Web3 connection hasn't been initialized!";
		}
		
		return true;
	}
	function __INITIATE_WEB3(info) {
		return new Promise((fulfill, reject)=>{
			__web3Conn = new Web3(new Web3.providers.HttpProvider(info.url));
			
			try {
				__web3Conn.eth.getMining((err, result)=>{
					if (err) {
						reject(err);
						return;
					}
					
					fulfill(__web3Conn);
				});
			}
			catch(e) {
				reject(e);
			}
		});
	}
	function __INITIATE_DB(info){
		return __CONNECT_DB(info).then(__PREPARE_DB_CONTENT);
	}
	function __CONNECT_DB(info) {
		return new Promise((fulfill, reject)=>{
			let conf = config.conf.bcart || {};
			let bcartConf = {
				dbURI: info.dbURI || conf.dbURI || 'mongodb://127.0.0.1:27017/txn_cache'
			};
			
			mongo.MongoClient.connect( bcartConf.dbURI, (err, db)=>{
				if ( err ) {
					reject(err);
					return;
				}
				
				tiiny.PromiseWaitAll([
					db.createCollection('txn',  {strict:false}),
					db.createCollection('meta', {strict:false})
				])
				.then(()=>{
					fulfill(__db=db);
				})
				.catch((err)=>{
					reject(err);
				});
			});
		});
	}
	function __PREPARE_DB_CONTENT() {
		return new Promise((fulfill, reject)=>{
			let metaColl = __db.collection( 'meta' );
			
			metaColl.findOne({name:'lastBlock'})
			.then((doc)=>{
				return doc || {name:'lastBlock', value:null};
			})
			.then(___UPDATE_STORAGE)
			.then((meta)=>{
				return metaColl.findOneAndUpdate(
					{name:'lastBlock'},
					{$set:{value:meta.value}},
					{upsert:true}
				);
			})
			.then(fulfill)
			.catch((err)=>{console.log(err); return Promise.reject(err);});
		});
		
		function ___UPDATE_STORAGE(meta) {
			let lastBlock = meta.value;
			
			
			let latestBlock = false;
			let txnColl = __db.collection( 'txn' );
			return __TRAVERSE_BLOCKS(
				{ from:'latest', to:lastBlock },
				(block)=>{
					latestBlock = latestBlock || block.hash;
					
					let _promises = [], op = null;
					block.transactions.forEach((txn)=>{
						if ( txn.symmerified ) {
							let contract = txn.contract;
							let cHash = contract.hash.substring(2);
							let cType = contract.type || -1;
							op = txnColl.findOneAndUpdate({hash:cHash}, {
								$setOnInsert: {
									hash:cHash,
									status:cType < 0 ? -1 : 0,
									type:cType,
									init:block.timestamp,
									update:0,
									end:0,
									contract:contract
								},
								$push:{
									records:txn
								}
							}, {upsert:true, returnOriginal:false})
							.then((result)=>{
								const doc = result.value;
								
							});
						}
						else {
							op = txnColl.findOneAndUpdate({hash:txn.hash}, {
								$setOnInsert: {
									hash:txn.hash,
									status:1,
									type:0,
									init:block.timestamp,
									update:0,
									end:0,
									contract:txn.input
								},
								$push:{
									records:txn
								}
							}, {upsert:true, returnOriginal:false});
						}
						
						_promises.push(op);
					});
				}
			).then(()=>{
				meta.value = latestBlock || meta.value;
				return meta;
			});
		}
	}
	
	module.exports = bcartAPIs;
})();
