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
//	wss://rococo-rpc.polkadot.io
const wsProvider = new WsProvider('wss://westend-rpc.polkadot.io');
const api = new ApiPromise({ provider: wsProvider });

// Constuct the keyring after the API (crypto has an async init)
const keyring = new Keyring({ type: 'sr25519' });

//checking network connection status
app.get('/connect', async (req, res) => {
    res.send({ message: `Network is connected: ${api.isConnected}` });
});


//Create account using mnemonic , address type: Generic Substrate addresses
app.get('/generatePolkaAddress', async (req, res) => {

    let mnemonic = mnemonicGenerate();
    const account = keyring.addFromMnemonic(mnemonic);

    res.send({ account, mnemonic });
})


//Import private key using seed
app.post('/importPrivateKey', async (req, res) => {

    let mnemonic = req.body.mnemonic

    if (mnemonic && mnemonicValidate(mnemonic)) {
        const account = keyring.addFromMnemonic(mnemonic);
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


const createAccount = (mnemonic) => {

    const account = keyring.addFromMnemonic(mnemonic);
    return { account, mnemonic };
}


//Initia transaction function 
//Polkadot testnet explorer  https://westend.subscan.io/

app.post('/createPolkaTrx', async (req, res) => {

    const seeds = req.body.sender
    const address2 = req.body.receiver
    const amountbalance = req.body.amount


    const decimal = 10 ** api.registry.chainDecimals

    //Creating account by passing seeds
    const { account: account1 } = createAccount(seeds);
    const account1balance = await api.derive.balances.all(account1.address);


    //converting binary balance to decimal
    const availableBalance = account1balance.availableBalance / decimal

    //converting decimal amount to binary
    const amount = amountbalance * decimal;

    // //transfering WND
    const transfer = api.tx.balances.transfer(address2, amount);

    const { partialFee } = await transfer.paymentInfo(account1.address);
    const fees = partialFee.muln(110).divn(100);


    //total amount checking for transfer
    const totalAmount = (amount + parseFloat(fees) + parseFloat(api.consts.balances.existentialDeposit)) / decimal


    // query balance
    if (totalAmount > availableBalance) {
        res.send({ error: `Cannot transfer ${totalAmount} with ${availableBalance} left` });
    }
    else {
        const tx = await transfer.signAndSend(account1);
        res.send({ tx: tx });
    }

});

app.get('/', (req, res) => {
    res.send('This is a test API');
});

const port = 3000;
app.listen(port, () => console.log(`Listening on port ${port}`));
