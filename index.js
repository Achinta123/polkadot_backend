const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

//Polkadot wallet libraries
const { mnemonicGenerate, mnemonicValidate } = require('@polkadot/util-crypto');
const { ApiPromise, WsProvider } = require('@polkadot/api');
const { Keyring } = require('@polkadot/keyring');

//Test network  wss://westend-rpc.polkadot.io
//Main Network  wss://rpc.polkadot.io
const wsProvider = new WsProvider('wss://westend-rpc.polkadot.io');
const api = new ApiPromise({ provider: wsProvider });


//checking network connection status
app.get('/connect', async (req, res) => {
    res.send({ message: `Network is connected: ${api.isConnected}` });
});

//we are using keyring sr25519 to ecrypt and decrypt the address and public key
const keyring = new Keyring({ type: 'sr25519' });

// decrypting address
app.post('/decryption', async (req, res) => {
    let address = req.body.address

    //decrypt address using sr25519
    const decryption = keyring.decodeAddress(address)
    console.log("decryption",decryption);
    res.send({ decryption });
});

// encrypting public key provide conversion of any address to polkadot address (1)
app.post('/encryption', async (req, res) => {
    let publicKey = JSON.parse(req.body.publicKey)

   //encrypt address using sr25519
    const encryption = keyring.encodeAddress(Uint8Array.from(publicKey), 0)
    res.send(encryption);
});


//Create account using mnemonic , address type: Polka addresses start with 1
app.get('/getPolkaAddress', async (req, res) => {
   
    // adjust the default ss58Format for Polkadot
    keyring.setSS58Format(0);

    const mnemonic=mnemonicGenerate();
    //Creating account using ss58Format keyring start with 1
    const account = keyring.addFromMnemonic(mnemonic);

    res.send({ account, mnemonic });
})


//Create account using mnemonic , address type: Kusama addresses start with Capital letter
app.get('/getKusamaAddress', async (req, res) => {
   
    // adjust the default ss58Format for Polkadot
    keyring.setSS58Format(2);

    //Creating account using ss58Format keyring start with 1
    const account = keyring.addFromMnemonic(mnemonicGenerate());

    res.send({ account, account });
})



//Create account using mnemonic , address type: Generic Substrate addresses
app.get('/generatePolkaAddress', async (req, res) => {

    let mnemonic = mnemonicGenerate();
    const account = keyring.addFromMnemonic(mnemonic);

    res.send({ account, mnemonic });
})


//Import seed to get account details
app.post('/importPrivateKey', async (req, res) => {

    let mnemonic = req.body.mnemonic

    if (mnemonic && mnemonicValidate(mnemonic)) {

        const account = getAccountInfo(mnemonic);
        res.send({ account });
    }
    else {
        res.send({ error: "Invalid Mnemonic" });
    }

})


//get balance 
//get free faucet WND https://app.element.io/#/room/#westend_faucet:matrix.org 
app.get('/getBalance/:address', async (req, res) => {

    const address = req.params.address;

    const account1balance = await api.derive.balances.all(address);
    const availableBalance = (account1balance.availableBalance.toNumber()) / (10 ** api.registry.chainDecimals);

    res.send({ balance: availableBalance });
});

//to signAndsend transaction
const getAccountInfo = (mnemonic) => {

    const account = keyring.addFromMnemonic(mnemonic);
    return account
}


//Initia transaction function 
//Polkadot testnet explorer  https://westend.subscan.io/

app.post('/createPolkaTrx', async (req, res) => {

    //senders seed
    const seeds = req.body.sender

    //receivers address
    const address2 = req.body.receiver

    // amount to be transfer
    const sendingAmount = req.body.amount

    const decimal = 10 ** api.registry.chainDecimals

    //Get sender account info by passing seeds
    const account1 = getAccountInfo(seeds);
    const account1balance = await api.derive.balances.all(account1.address);

    //converting binary balance to decimal
    const availableBalance = account1balance.availableBalance / decimal

    //converting decimal amount to binary
    const amount = sendingAmount * decimal;

    // //transfering coin (WND) 
    const transfer = api.tx.balances.transfer(address2, amount);

    //Transaction fee calculation
    const { partialFee } = await transfer.paymentInfo(account1.address);
    const fees = partialFee.muln(110).divn(100);

    //sending amount + network fees 
    const totalAmount = (amount + parseFloat(fees) + parseFloat(api.consts.balances.existentialDeposit)) / decimal

    // query sender balance
    if (totalAmount > availableBalance) {
        res.send({ error: `Cannot transfer ${totalAmount} with ${availableBalance} left` });
    }
    else {
         //sign the transaction with sender's secret key
        const tx = await transfer.signAndSend(account1);
        res.send({ tx: tx });
    }

});

const port = 8081;
app.listen(port, () => console.log(`Listening on port ${port}`));
