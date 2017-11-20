### bcart-access example
#### * connect to Eland-DEV-ALPHA-01 server then enter bcart-console mode 

> cd bcart-access 
> node repl.js

#### * Start typing command

> bcart.getBlock('latest',true)

#### * show priv_key and address
 
> bcart.key

#### * send a transaction to destination address

> var nonce = web3.eth.getTransactionCount('0x'+bcart.key.address,'pending');
> var toWho = '0x10388ae25100d3b977d86b44424be42fbf317149';

#### * get current time

> var timestamp = Math.round(new Date().getTime()/1000);

> var data = {
>	     "type": 2,
>	     "basis": {
>		          "prod": "0xd00801f27b1373459e509dbb596fd36fe8bf4fd963ff1c4814dc1ac75a2ba444",
>		          "time": timestamp
>	      },
>	     "ext": 1
>       };


> bcart.sendRecord(bcart.key,toWho,data,nonce);
