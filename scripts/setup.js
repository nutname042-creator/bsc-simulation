const { ethers } = require('ethers');
const fs = require('fs');

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const W1 = '0xB7f932Ff14A33F37d4C3A421EC98Ec79a89475E2';
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const USDT_ABI = JSON.parse(fs.readFileSync('contracts/abi.json', 'utf8'));
const SWAP_ABI = JSON.parse(fs.readFileSync('contracts/swap_abi.json', 'utf8'));
const SWAP_BYTECODE = '0x' + fs.readFileSync('contracts/swap_bytecode.txt', 'utf8').trim();

async function main() {
  console.log('Setting up simulation...');

  // Deploy USDT contract
  const bytecode = '0x' + fs.readFileSync('contracts/bytecode.txt', 'utf8').trim();
  await provider.send('anvil_setCode', [USDT, bytecode]);
  const ownerSlot = '0x0000000000000000000000000000000000000000000000000000000000000000';
  await provider.send('anvil_setStorageAt', [USDT, ownerSlot, ethers.zeroPadValue(DEPLOYER, 32)]);
  console.log('USDT contract deployed');

  // Set BNB balances
  await provider.send('anvil_setBalance', [DEPLOYER, ethers.toBeHex(ethers.parseEther('10000'))]);
  await provider.send('anvil_setBalance', [W1, ethers.toBeHex(ethers.parseEther('5000'))]);
  console.log('BNB balances set');

  // Mint and transfer USDT
  await provider.send('anvil_impersonateAccount', [DEPLOYER]);
  const signer = await provider.getSigner(DEPLOYER);
  const usdt = new ethers.Contract(USDT, USDT_ABI, signer);
  await (await usdt['mint(address,uint256)'](DEPLOYER, ethers.parseUnits('2000000', 18), { gasLimit: 300000 })).wait();
  await (await usdt.transfer(W1, ethers.parseUnits('700000', 18), { gasLimit: 200000 })).wait();
  console.log('USDT minted and transferred to W1');

  // Deploy SimpleSwap
  const factory = new ethers.ContractFactory(SWAP_ABI, SWAP_BYTECODE, signer);
  const swap = await factory.deploy(USDT, { gasLimit: 3000000 });
  await swap.waitForDeployment();
  const swapAddress = await swap.getAddress();
  console.log('SimpleSwap deployed at:', swapAddress);

  // Add liquidity
  await (await usdt.approve(swapAddress, ethers.parseUnits('600000', 18), { gasLimit: 100000 })).wait();
  await (await swap.depositUSDT(ethers.parseUnits('600000', 18), { gasLimit: 200000 })).wait();
  await (await swap.depositBNB({ value: ethers.parseEther('1000'), gasLimit: 100000 })).wait();
  console.log('Liquidity added to swap');

  await provider.send('anvil_stopImpersonatingAccount', [DEPLOYER]);

  // Save swap address
  fs.writeFileSync('contracts/swap_address.txt', swapAddress);

  // Print summary
  const [bnbRes, usdtRes] = await swap.getReserves();
  console.log('\n=== SETUP COMPLETE ===');
  console.log('W1 BNB:', ethers.formatEther(await provider.getBalance(W1)));
  console.log('W1 USDT:', ethers.formatUnits(await usdt.balanceOf(W1), 18));
  console.log('Swap address:', swapAddress);
  console.log('Swap BNB reserve:', ethers.formatEther(bnbRes));
  console.log('Swap USDT reserve:', ethers.formatUnits(usdtRes, 18));
  console.log('Rate: 1 BNB =', ethers.formatUnits(await swap.bnbToUsdtRate(), 18), 'USDT');
}

main().catch(console.error);
