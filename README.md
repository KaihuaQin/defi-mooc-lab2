# Hands-on Exercise: Flash Loan based Liquidation

## Exercise
In this exercise, you are expected to implement a smart contract that performs a flash loan based liquidation.

### Prerequisite
- You need to register an account on https://www.alchemy.com/ for access to an archive Ethereum node.

- You need to prepare the nodeJS environment for the project yourself, or have [docker](https://www.docker.com/) installed on your machine.

### Requirements

- The smart contract should allow you to perform a flash loan, a liquidation, and an asset exchange in one blockchain transaction.

- To ease marking, we require your contract to provide a unified interface `operate`. By calling `operate`, the flash loan, liquidation, and exchange should be executed properly. You are allowed to "hardcode" the execution logic and parameters in the `operate` function.

```javascript
function operate() external;
```

### Test case

You are expected to liquidate `0x59CE4a2AC5bC3f5F225439B2993b86B42f6d3e9F` on Aave V2 which was liquidated at block `12489620`. Check out the [original liquidation transaction](https://etherscan.io/tx/0xac7df37a43fab1b130318bbb761861b8357650db2e2c6493b73d6da3d9581077).

### Commands
To test your contract:
1. `docker build -t defi-mooc-lab2 .`
2. `docker run -e ALCHE_API="$YOUR ALCHEMY ETHEREUM MAINNET API" -it defi-mooc-lab2 npm test`

### Grading

Your grade is determined by the actual profit you earn in the test case. After the program execution, you should see `Profit xxx ETH` at the end of a successful liquidation. If you are not using the docker environment, for successful execution you should also see a `profit.txt` file which contains the amount of ETH that you earned after the liquidation. **If your implementation is correct, you should be receiving at least 21 ETH as the profit.** Note that we reduce the gas fee to be zero to encourage programming complicated liquidation strategies. 

### Submission

Your submission should be a single `LiquidationOperator.sol` file **that contains at most one import statement `import "hardhat/console.sol";`**. If you plan to include libraries or interfaces from other npm packages, please manually add them to your contract file so that we have a unified environment for grading. 

## Background

We provide the following background information for this exercise.

### Aave liquidation
To trigger a liquidation on Aave, you need to call a public function `liquidationCall` provided by the Aave smart contracts. In the function, you can specify `user` representing the borrowing position you would like to liquidate, `debtAsset`, the cryptocurrency you would like to repay (let's say token D), and `collateralAsset`, the collateral cryptocurrency you would like claim from the borrowing position (let's say token C). You also specify the amount of debt you want to repay, `debtToCover`.

```javascript
function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  ) external;
```

By calling this function, you then repay some amount of token D to Aave and in return, some token C is sent to your account.

You should make sure that the user is in a liquidatable state. Otherwise, the aave smart contract would revert your transaction and you would pay transaction fees for an unsuccessful liquidation. 

### Uniswap flash loan
What if you don't have any upfront token D, but you do need some to repay in the liquidation? You can use flash loans! A Uniswap flash loan (a.k.a flash swap) can grant you the cryptocurrencies available in the pool without any collateral, as long as you preserve the constant `K` in the end of the transaction. Check out the detailed code snippet ([Uniswap V2](https://github.com/Uniswap/uniswap-v2-core/blob/master/contracts/UniswapV2Pair.sol)) in the following.

```javascript
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external lock {
    require(amount0Out > 0 || amount1Out > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
    (uint112 _reserve0, uint112 _reserve1,) = getReserves(); // gas savings
    require(amount0Out < _reserve0 && amount1Out < _reserve1, 'UniswapV2: INSUFFICIENT_LIQUIDITY');

    uint balance0;
    uint balance1;
    { // scope for _token{0,1}, avoids stack too deep errors
    address _token0 = token0;
    address _token1 = token1;
    require(to != _token0 && to != _token1, 'UniswapV2: INVALID_TO');
    if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
    if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens
    if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
    balance0 = IERC20(_token0).balanceOf(address(this));
    balance1 = IERC20(_token1).balanceOf(address(this));
    }
    uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
    uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
    require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');
    { // scope for reserve{0,1}Adjusted, avoids stack too deep errors
    uint balance0Adjusted = balance0.mul(1000).sub(amount0In.mul(3));
    uint balance1Adjusted = balance1.mul(1000).sub(amount1In.mul(3));
    require(balance0Adjusted.mul(balance1Adjusted) >= uint(_reserve0).mul(_reserve1).mul(1000**2), 'UniswapV2: K');
    }

    _update(balance0, balance1, _reserve0, _reserve1);
    emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, to);
}
```

Importantly, Uniswap would attempt to call into the receiver to invoke the function `uniswapV2Call` after sending the flash loan assets. This means that you need a smart contract to accept a flash loan. The smart contract should have an `uniswapV2Call` function and you can program how you use the flash loan assets in this function.

```javascript
if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
```

Back to liquidation, you can program the liquidation logic in the `uniswapV2Call` function. So, when you don't have enough token D to perform a liquidation, you can request a flash loan and your smart contract can do the liquidation after receiving token D.

### What do you need to do after liquidation?
With the flash loan, you now have enough token D. You can repay the debt for the borrowing position and claim the collateral token C. Congratulation! A successful liquidation is completed, but, wait, you still need to repay the flash loan. Remember that you need to preserve the `K`. In the exercise, you are required to convert every earned token to ETH through e.g., exchanges. This is for easing the grading.

### More reference
Please check out the links in the template file (`contracts/LiquidationOperator.sol`) for how to use the interfaces. [Etherscan](https://etherscan.io/) is a handy tool for exploring addresses, blocks, and transactions on-chain. If you have further questions or comments, please feel free to [submit an issue](https://github.com/KaihuaQin/defi-mooc-lab2/issues/new).
