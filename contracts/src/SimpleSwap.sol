// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

contract SimpleSwap {
    address public owner;
    IERC20 public usdt;

    // How many USDT per 1 BNB (with 18 decimals)
    // Default: 600 USDT per BNB
    uint256 public bnbToUsdtRate = 600 * 1e18;

    event SwapBNBToUSDT(address indexed user, uint256 bnbAmount, uint256 usdtAmount);
    event SwapUSDTToBNB(address indexed user, uint256 usdtAmount, uint256 bnbAmount);
    event RateUpdated(uint256 newRate);
    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _usdt) {
        owner = msg.sender;
        usdt = IERC20(_usdt);
    }

    // Swap BNB for USDT
    function swapBNBForUSDT() external payable {
        require(msg.value > 0, "Must send BNB");
        uint256 usdtAmount = (msg.value * bnbToUsdtRate) / 1e18;
        require(usdt.balanceOf(address(this)) >= usdtAmount, "Insufficient USDT liquidity");
        usdt.transfer(msg.sender, usdtAmount);
        emit SwapBNBToUSDT(msg.sender, msg.value, usdtAmount);
    }

    // Swap USDT for BNB
    function swapUSDTForBNB(uint256 usdtAmount) external {
        require(usdtAmount > 0, "Must send USDT");
        uint256 bnbAmount = (usdtAmount * 1e18) / bnbToUsdtRate;
        require(address(this).balance >= bnbAmount, "Insufficient BNB liquidity");
        usdt.transferFrom(msg.sender, address(this), usdtAmount);
        payable(msg.sender).transfer(bnbAmount);
        emit SwapUSDTToBNB(msg.sender, usdtAmount, bnbAmount);
    }

    // Get USDT amount for given BNB
    function getUSDTAmountForBNB(uint256 bnbAmount) external view returns (uint256) {
        return (bnbAmount * bnbToUsdtRate) / 1e18;
    }

    // Get BNB amount for given USDT
    function getBNBAmountForUSDT(uint256 usdtAmount) external view returns (uint256) {
        return (usdtAmount * 1e18) / bnbToUsdtRate;
    }

    // Update exchange rate
    function setRate(uint256 newRate) external onlyOwner {
        require(newRate > 0, "Rate must be > 0");
        bnbToUsdtRate = newRate;
        emit RateUpdated(newRate);
    }

    // Deposit USDT liquidity
    function depositUSDT(uint256 amount) external onlyOwner {
        usdt.transferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);
    }

    // Deposit BNB liquidity
    function depositBNB() external payable onlyOwner {
        emit Deposit(msg.sender, msg.value);
    }

    // Withdraw USDT
    function withdrawUSDT(uint256 amount) external onlyOwner {
        usdt.transfer(msg.sender, amount);
        emit Withdraw(msg.sender, amount);
    }

    // Withdraw BNB
    function withdrawBNB(uint256 amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
        emit Withdraw(msg.sender, amount);
    }

    // Check contract balances
    function getReserves() external view returns (uint256 bnbReserve, uint256 usdtReserve) {
        return (address(this).balance, usdt.balanceOf(address(this)));
    }

    receive() external payable {}
}
