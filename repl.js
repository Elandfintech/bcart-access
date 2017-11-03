#!/usr/bin/env node
(()=>{
	"use strict";

	const repl	= require( 'repl' );
	const hist	= require( 'repl.history' );
	const color = require( 'colors/safe' );
	
	const fs	= require( 'fs' );
	const tiiny = require( 'tiinytiny' );
	const util	= require( 'util' );
	const bcart	= require( './bcart' );
	
	
	
	
	bcart.Initialize({url:'https://demo.elandfintech.com:8443/'})
	.then(()=>{
		if ( process.argv.indexOf( '--purge-cache' ) >= 0 ) {
			console.log(color.yellow( "Purging transaction caches... (This will result in long transaction checking time...)" ) );
			return bcart.PurgeCache();
		}
	})
	.then(()=>{
		console.log(color.yellow( "Checking for latest transactions..." ));
		return bcart.UpdateCache();
	})
	.then(()=>{
		let __defaultKey = null;
		try {
			let rawJSON = fs.readFileSync( `${__dirname}/default.key.json` );
			console.log(color.yellow( "Default key found! Loading..." ));
			__defaultKey = JSON.parse(rawJSON);
		}
		catch(e) {
			__defaultKey = null;
		}
	
	
		console.log(color.yellow( "Starting repl environment..." ));
		const repl_server = repl.start( 'bcart-console >> ' );
		hist(repl_server, './.history');
		
		tiiny.ImprintProperties(repl_server.context, {
			console: console,
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
					.then((blockData)=>{console.clog(blockData);})
					.catch((err)=>{console.clog(err);});
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
				},
				traverseBlock:(...args)=>{
					let [options, callback] = args;
					if ( args.length < 2 ) {
						callback = options;
						options = {};
					}
				
					return bcart.TraverseBlocks(options, callback);
				}
			}, [true, true, false])
		}, [true, true, false]);
		repl_server.on( 'exit', ()=>{ bcart.Finalize(); });
	})
	.catch((err)=>{
		console.clog(err);
	
		return tiiny.PromiseWaitAll([
			bcart.Finalize()
		]);
	});
	
	
	console.clog=function(...args){
		args.forEach((arg)=>{
			this.log(util.inspect(arg, {colors:true, depth:10}));
		});
	};
})();
