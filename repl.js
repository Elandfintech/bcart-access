#!/usr/bin/env node
(()=>{
	"use strict";

	const repl	= require( 'repl' );
	const hist	= require( 'repl.history' );
	
	const fs	= require( 'fs' );
	const tiiny = require( 'tiinytiny' );
	const util	= require( 'util' );
	const bcart	= require( './bcart' );
	
	bcart.Initialize({url:'https://demo.elandfintech.com:8443/'}).then(()=>{
		let __defaultKey = null;
		try {
			let rawJSON = fs.readFileSync( `${__dirname}/default.key.json` );
			console.log( "Default key found! Loading..." );
			__defaultKey = JSON.parse(rawJSON);
		}
		catch(e) {
			__defaultKey = null;
		}
		
		
		
		const repl_server = repl.start( 'bcart-console >> ' );
		hist(repl_server, './.history');
		
		tiiny.ImprintProperties(repl_server.context, {
			web3: bcart.Connection,
			eth: bcart.Connection.eth,
			bcart: tiiny.ImprintProperties({}, {
				get key(){ return !__defaultKey ? null : tiiny.ImprintProperties({}, __defaultKey, [false, true, true]); },
				loadKey: (keyPath)=>{
					try {
						let rawKey = fs.readFileSync(keyPath);
						__defaultKey = JSON.parse(rawKey);
					}
					catch(e) {
						__defaultKey = null
					}
					
					return __defaultKey;
				},
				getBlock: (...args)=>{
					bcart.GetBlock(...args)
					.then((blockData)=>{__OUTPUT_LOG(blockData);})
					.catch((err)=>{__OUTPUT_LOG(err);});
				},
				genRecord: (...args)=>{
					let [from, to, data, nounce] = [];
					if ( args.length < 4 ) {
						[to, data, nounce] = args;
					}
					
					if ( !from && !__defaultKey ) {
						throw "A valid initiator information is required! Please ether use loadKey to load default key info or assign the info directly!";
					}
					
					return bcart.GenRecord(from||__defaultKey, to, data, nounce);
				},
				sendRecord: (...args)=>{
					let [from, to, data, nounce] = [];
					if ( args.length < 4 ) {
						[to, data, nounce] = args;
					}
					
					if ( !from && !__defaultKey ) {
						throw "A valid initiator information is required! Please ether use loadKey to load default key info or assign the info directly!";
					}
					
					return bcart.SendRecord(from||__defaultKey, to, data, nounce);
				}
			}, [true, true, false])
		}, [true, true, false]);
	});
	
	
	
	function __OUTPUT_LOG(data) {
		console.log(util.inspect(data, {colors:true, depth:10}));
	}
})();
