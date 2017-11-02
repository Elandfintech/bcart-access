(()=>{
	"use strict";
	
	const Web3	 = require( 'web3' );
	const crypto = require( 'crypto' );
	const ethTx	 = require( 'ethereumjs-tx' );
	
	const sha256 = crypto.createHash( 'sha256' );
	const bcartAPIs = {};
	
	
	
	let __web3Conn = null;
	Object.defineProperties(bcartAPIs, {
		Initialize:{
			writable:false, enumerable:true, configurable:false,
			value:(info={})=>{
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
		},
		Connection:{
			enumerable:true, configurable:false,
			get:()=>{ return __web3Conn; }
		},
		GetBlock:{
			writable:false, enumerable:true, configurable:false,
			value:(blockId='latest', options={}) => {
				return __CHECK_VALID().then(()=>{
					return new Promise((fulfill, reject)=>{
						let fullRecords = (options.fullRecords === undefined) ? true : !!options.fullRecords;
						let parseTxn		= (options.parseTxn === undefined) ? true : !!options.parseTxn;
						__web3Conn.eth.getBlock(blockId, fullRecords, (err, block)=>{
							if ( err ) {
								reject(err);
								return;
							}
							
							if ( parseTxn ) {
								block.transactions.forEach((record)=>{
									try {
										if ( record.input === '0x' ) {
											throw "Simple Transaction";
										}
										
										let raw	= record.input;
										let rawContract = Buffer.from(raw.substring(2), 'hex');
										let contract = JSON.parse(rawContract.toString( 'utf8' ));
										record.contractInfo = {
											hash: sha256.update(rawContract).digest( 'hex' ),
											content:contract,
										};
										record.symmerified  = true;
									}
									catch(err) {
										record.symmerified = false;
									}
								});
							}
							
							fulfill(block);
						});
					});
				});
			}
		},
		GenRecord:{
			writable:false, enumerable:true, configurable:false,
			value:(from, to, data, nonce, amt = 0.01)=>{
				__CHECK_VALID_SYNC();
			
			
			
				if ( to.substring(0, 2) !== "0x" ) to = `0x${to}`;
				

				
				//get current median gasPrice
	//			var price = web3Conn.eth.gasPrice;
				
				let data_hex = __web3Conn.toHex(JSON.stringify(data));   // extra note
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
			value:()=>(from, to, data, nonce)=>{
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
	});
	
	
	function __CHECK_VALID() {
		return new Promise((fulfill, reject)=>{ __web3Conn ? fulfill() : reject(); });
	}
	
	function __CHECK_VALID_SYNC() {
		if ( !__web3Conn ) {
			throw "Web3 connection hasn't been initialized!";
		}
		
		return true;
	}
	
	module.exports = bcartAPIs;
})();
