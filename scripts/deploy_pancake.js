const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
const USDT = '0x55d398326f99059fF775485246999027B3197955';
const W1 = '0xB7f932Ff14A33F37d4C3A421EC98Ec79a89475E2';
const DEPLOYER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const DEPLOYER_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const FACTORY_ADDRESS = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const ROUTER_ADDRESS = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

const CORE_PATH = 'pancake/node_modules/@uniswap/v2-core/build';
const PERIPHERY_PATH = 'pancake/node_modules/@uniswap/v2-periphery/build';

const USDT_ABI = JSON.parse(fs.readFileSync('contracts/abi.json', 'utf8'));

const PAIR_ABI = [
  'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];

const FACTORY_ABI = [
  'function createPair(address tokenA, address tokenB) returns (address pair)',
  'function getPair(address tokenA, address tokenB) view returns (address pair)',
  'function feeToSetter() view returns (address)'
];

const ROUTER_ABI = [
  'function factory() view returns (address)',
  'function WETH() view returns (address)',
  'function addLiquidityETH(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity)',
  'function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[] amounts)',
  'function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[] amounts)',
  'function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)'
];

const WETH_ABI = [
  'function deposit() payable',
  'function withdraw(uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function transfer(address, uint256) returns (bool)',
  'function transferFrom(address, address, uint256) returns (bool)',
  'function totalSupply() view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

async function deployAndGetCode(wallet, artifact, constructorArgs, abi) {
  const factory = new ethers.ContractFactory(abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...constructorArgs, { gasLimit: 8000000 });
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const code = await provider.getCode(address);
  return code;
}

async function main() {
  console.log('Deploying PancakeSwap V2 on local BSC...\n');
  const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);

  const factoryArtifact = JSON.parse(fs.readFileSync(path.join(CORE_PATH, 'UniswapV2Factory.json')));
  const wethArtifact = JSON.parse(fs.readFileSync(path.join(PERIPHERY_PATH, 'WETH9.json')));
  const routerArtifact = JSON.parse(fs.readFileSync(path.join(PERIPHERY_PATH, 'UniswapV2Router02.json')));

  console.log('Step 1: Deploying WBNB...');
  const wbnbCode = await deployAndGetCode(wallet, wethArtifact, [], WETH_ABI);
  await provider.send('anvil_setCode', [WBNB_ADDRESS, wbnbCode]);
  console.log('WBNB at:', WBNB_ADDRESS);

  console.log('Step 2: Deploying Factory...');
  const factoryCode = await deployAndGetCode(wallet, factoryArtifact, [DEPLOYER], FACTORY_ABI);
  await provider.send('anvil_setCode', [FACTORY_ADDRESS, factoryCode]);
  await provider.send('anvil_setStorageAt', [FACTORY_ADDRESS, '0x0000000000000000000000000000000000000000000000000000000000000001', ethers.zeroPadValue(DEPLOYER, 32)]);
  console.log('Factory at:', FACTORY_ADDRESS);

  console.log('Step 3: Deploying Router...');
  const routerCode = await deployAndGetCode(wallet, routerArtifact, [FACTORY_ADDRESS, WBNB_ADDRESS], ROUTER_ABI);
  await provider.send('anvil_setCode', [ROUTER_ADDRESS, routerCode]);
  console.log('Router at:', ROUTER_ADDRESS);

  console.log('\nStep 4: Setting up USDT and balances...');
  const usdtBytecode = '0x' + fs.readFileSync('contracts/bytecode.txt', 'utf8').trim();
  await provider.send('anvil_setCode', [USDT, usdtBytecode]);
  await provider.send('anvil_setStorageAt', [USDT, '0x0000000000000000000000000000000000000000000000000000000000000000', ethers.zeroPadValue(DEPLOYER, 32)]);
  await provider.send('anvil_setBalance', [DEPLOYER, ethers.toBeHex(ethers.parseEther('100000'))]);
  await provider.send('anvil_setBalance', [W1, ethers.toBeHex(ethers.parseEther('5000'))]);

  await provider.send('anvil_impersonateAccount', [DEPLOYER]);
  const signer = await provider.getSigner(DEPLOYER);
  const usdt = new ethers.Contract(USDT, USDT_ABI, signer);
  await (await usdt['mint(address,uint256)'](DEPLOYER, ethers.parseUnits('10000000', 18), { gasLimit: 300000 })).wait();
  await (await usdt.transfer(W1, ethers.parseUnits('700000', 18), { gasLimit: 200000 })).wait();
  console.log('USDT minted, W1 funded');

  console.log('\nStep 5: Adding liquidity...');
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  await (await usdt.approve(ROUTER_ADDRESS, ethers.parseUnits('3000000', 18), { gasLimit: 100000 })).wait();
  await (await router.addLiquidityETH(
    USDT,
    ethers.parseUnits('3000000', 18),
    ethers.parseUnits('2900000', 18),
    ethers.parseEther('5000'),
    DEPLOYER,
    deadline,
    { value: ethers.parseEther('6000'), gasLimit: 8000000 }
  )).wait();
  console.log('Liquidity added: 3,000,000 USDT + 6,000 BNB');

  await provider.send('anvil_stopImpersonatingAccount', [DEPLOYER]);

  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const pairAddress = await factory.getPair(USDT, WBNB_ADDRESS);
  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
  const [r0, r1] = await pair.getReserves();
  const token0 = await pair.token0();
  let bnbReserve, usdtReserve;
  if (token0.toLowerCase() === WBNB_ADDRESS.toLowerCase()) {
    bnbReserve = r0; usdtReserve = r1;
  } else {
    bnbReserve = r1; usdtReserve = r0;
  }

  const addresses = { WBNB: WBNB_ADDRESS, FACTORY: FACTORY_ADDRESS, ROUTER: ROUTER_ADDRESS, USDT, PAIR: pairAddress };
  fs.writeFileSync('contracts/pancake_addresses.json', JSON.stringify(addresses, null, 2));

  const usdtReader = new ethers.Contract(USDT, USDT_ABI, provider);
  console.log('\n=== PANCAKESWAP V2 READY ===');
  console.log('WBNB:', WBNB_ADDRESS);
  console.log('Factory:', FACTORY_ADDRESS);
  console.log('Router:', ROUTER_ADDRESS);
  console.log('USDT/WBNB Pair:', pairAddress);
  console.log('BNB Reserve:', ethers.formatEther(bnbReserve));
  console.log('USDT Reserve:', ethers.formatUnits(usdtReserve, 18));
  console.log('Rate: 1 BNB =', (Number(usdtReserve) / Number(bnbReserve)).toFixed(2), 'USDT');
  console.log('W1 BNB:', ethers.formatEther(await provider.getBalance(W1)));
  console.log('W1 USDT:', ethers.formatUnits(await usdtReader.balanceOf(W1), 18));
}

main().catch(console.error);
