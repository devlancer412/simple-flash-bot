import { Wallet, BigNumber, utils, providers, Contract } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import contractAbi from './abi.json';

import {
  privateKey,
  senderPvkey,
  rpcUrl,
  contractAddress,
  transferFee,
  usdtTransferFee
} from './data.json';

const library = new providers.JsonRpcProvider(rpcUrl);
const wallet = new Wallet(privateKey, library);
const sender = new Wallet(senderPvkey, library);

const contract = new Contract(contractAddress, contractAbi, wallet);

const getBlockchainTime = async () => {
  return (await library.getBlock('latest')).timestamp;
};

const main = async () => {
  console.log('start');

  console.log(Date.now() / 1000);

  const flashbotsProvider = await FlashbotsBundleProvider.create(
    library,
    sender
  );

  const transactions: any[] = [];
  let gasPrice: BigNumber = await library.getGasPrice();
  gasPrice = gasPrice.mul(130).div(100);
  const transferFeeWei = gasPrice.mul(transferFee);
  const usdtTransferFeeWei = gasPrice.mul(usdtTransferFee + 100);

  let balance = await sender.getBalance();
  const usdtBalance = await contract.balanceOf(wallet.address);

  if(balance.lt(transferFeeWei.add(usdtTransferFeeWei))) {
    console.log("Insufficient gas");
  }

  console.log("USDT balance:", usdtBalance.toString())

  const currentTime = await getBlockchainTime();
  if (!currentTime) {
    return;
  }
  
  const transferTx = {
    chainId: 1,
    from: sender.address,
    to: wallet.address,
    value: usdtTransferFeeWei,
    gasLimit: transferFee,
    gasPrice: gasPrice
  };
  
  transactions.push({
    signer: sender,
    transaction: transferTx,
  });
 
  const usdtTransferTx = await contract
  ?.connect(wallet)
  .populateTransaction.transfer("0x3764fe4e74F6A2F8F4735923c078771d83e139c7", usdtBalance);

  const revampMinTx = {
    chainId: 1,
    from: usdtTransferTx.from,
    to: usdtTransferTx.to,
    data: usdtTransferTx.data,
    value: 0,
    gasLimit: usdtTransferFee,
    gasPrice: gasPrice
  };

  transactions.push({
    signer: wallet,
    transaction: revampMinTx,
  });

  const signedBundle = await flashbotsProvider.signBundle(transactions);

  const blockNumber = await library.getBlockNumber();
  const targetBlockNumber = blockNumber + 3;

  console.log('Current number', blockNumber);

  const simulation = await flashbotsProvider.simulate(
    signedBundle,
    targetBlockNumber
  );

  console.log(simulation);

  return;

  const tx = await flashbotsProvider.sendRawBundle(
    signedBundle,
    targetBlockNumber
  );
  console.log(tx);

  const r = await (tx as any).wait();
  console.log(r);
};

main().then();
