const { ethers } = require('ethers');
const fs = require('fs');

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const W1 = '0xB7f932Ff14A33F37d4C3A421EC98Ec79a89475E2';
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const USDT_ABI = JSON.parse(fs.readFileSync('contracts/abi.json', 'utf8'));
const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256,uint256,uint256)',
  'function WETH() view returns (address)'
];
const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
const PAIR_ABI = [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)'
];

async function main() {
  console.log('Setting up full simulation with PancakeSwap V2...\n');

  // Deploy USDT
  const usdtBytecode = '0x' + fs.readFileSync('contracts/bytecode.txt', 'utf8').trim();
  await provider.send('anvil_setCode', [USDT, usdtBytecode]);
  await provider.send('anvil_setStorageAt', [USDT, ethers.zeroPadValue('0x00', 32), ethers.zeroPadValue(DEPLOYER, 32)]);
  console.log('USDT contract set');

  // Set balances - deployer gets massive amount for liquidity
  await provider.send('anvil_setBalance', [DEPLOYER, ethers.toBeHex(ethers.parseEther('10000000'))]);
  await provider.send('anvil_setBalance', [W1, ethers.toBeHex(ethers.parseEther('5000'))]);
  console.log('BNB balances set');

  await provider.send('anvil_impersonateAccount', [DEPLOYER]);
  const signer = await provider.getSigner(DEPLOYER);
  const usdt = new ethers.Contract(USDT, USDT_ABI, signer);

  // Mint billions of USDT
  await (await usdt['mint(address,uint256)'](DEPLOYER, ethers.parseUnits('5000000000', 18), { gasLimit: 300000 })).wait();
  console.log('Minted 5 Billion USDT to deployer');

  // Fund W1 with 700,000 USDT
  await (await usdt.transfer(W1, ethers.parseUnits('700000', 18), { gasLimit: 200000 })).wait();
  console.log('Transferred 700,000 USDT to W1');

  // Add massive liquidity to PancakeSwap
  // 1,000,000,000 USDT + 2,000,000 BNB = 500 USDT per BNB
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  await (await usdt.approve(ROUTER, ethers.parseUnits('1000000000', 18), { gasLimit: 100000 })).wait();
  await (await router.addLiquidityETH(
    USDT,
    ethers.parseUnits('1000000000', 18),
    ethers.parseUnits('900000000', 18),
    ethers.parseEther('1000000'),
    DEPLOYER,
    deadline,
    { value: ethers.parseEther('2000000'), gasLimit: 8000000 }
  )).wait();
  console.log('Added liquidity: 1,000,000,000 USDT + 2,000,000 BNB');

  await provider.send('anvil_stopImpersonatingAccount', [DEPLOYER]);

  // Get pair info
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
  const pairAddr = await factory.getPair(USDT, WBNB);
  const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();
  const [bnbRes, usdtRes] = token0.toLowerCase() === WBNB.toLowerCase() ? [r0, r1] : [r1, r0];

  fs.writeFileSync('contracts/pancake_addresses.json', JSON.stringify({
    WBNB, FACTORY, ROUTER, USDT, PAIR: pairAddr
  }, null, 2));

  const usdtReader = new ethers.Contract(USDT, USDT_ABI, provider);
  console.log('\n=== SETUP COMPLETE ===');
  console.log('Factory:', FACTORY);
  console.log('Router:', ROUTER);
  console.log('Pair:', pairAddr);
  console.log('BNB Reserve:', ethers.formatEther(bnbRes));
  console.log('USDT Reserve:', ethers.formatUnits(usdtRes, 18));
  console.log('Rate: 1 BNB =', (Number(usdtRes) / Number(bnbRes)).toFixed(2), 'USDT');
  console.log('\nW1 BNB:', ethers.formatEther(await provider.getBalance(W1)));
  console.log('W1 USDT:', ethers.formatUnits(await usdtReader.balanceOf(W1), 18));
}

main().catch(console.error);
