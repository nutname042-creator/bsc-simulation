const { ethers } = require('ethers');
const fs = require('fs');

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const USDT_ABI = JSON.parse(fs.readFileSync('contracts/abi.json', 'utf8'));
const ROUTER_ABI = [
  'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256,uint256,uint256)'
];
const FACTORY_ABI = ['function getPair(address,address) view returns (address)'];
const PAIR_ABI = [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)'
];

// ===========================
// CONFIGURE HERE
// ===========================
const ADD_BNB = '1000000';       // BNB to add
const ADD_USDT = '500000000';    // USDT to add (should match rate: 500 USDT per BNB)
// ===========================

async function main() {
  console.log(`Adding liquidity: ${ADD_BNB} BNB + ${ADD_USDT} USDT...\n`);

  await provider.send('anvil_setBalance', [DEPLOYER, ethers.toBeHex(ethers.parseEther('10000000'))]);
  await provider.send('anvil_impersonateAccount', [DEPLOYER]);
  const signer = await provider.getSigner(DEPLOYER);
  const usdt = new ethers.Contract(USDT, USDT_ABI, signer);
  const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);

  // Mint USDT for liquidity
  await (await usdt['mint(address,uint256)'](DEPLOYER, ethers.parseUnits(ADD_USDT, 18), { gasLimit: 300000 })).wait();
  await (await usdt.approve(ROUTER, ethers.parseUnits(ADD_USDT, 18), { gasLimit: 100000 })).wait();

  const deadline = Math.floor(Date.now() / 1000) + 3600;
  await (await router.addLiquidityETH(
    USDT,
    ethers.parseUnits(ADD_USDT, 18),
    0n,
    0n,
    DEPLOYER,
    deadline,
    { value: ethers.parseEther(ADD_BNB), gasLimit: 8000000 }
  )).wait();

  await provider.send('anvil_stopImpersonatingAccount', [DEPLOYER]);

  // Show updated reserves
  const factory = new ethers.Contract(FACTORY, FACTORY_ABI, provider);
  const pairAddr = await factory.getPair(USDT, WBNB);
  const pair = new ethers.Contract(pairAddr, PAIR_ABI, provider);
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();
  const [bnbRes, usdtRes] = token0.toLowerCase() === WBNB.toLowerCase() ? [r0, r1] : [r1, r0];

  console.log('=== LIQUIDITY ADDED ===');
  console.log('BNB Reserve:', ethers.formatEther(bnbRes));
  console.log('USDT Reserve:', ethers.formatUnits(usdtRes, 18));
  console.log('Rate: 1 BNB =', (Number(usdtRes) / Number(bnbRes)).toFixed(2), 'USDT');
}

main().catch(console.error);
