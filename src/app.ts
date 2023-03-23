import { ethers } from "ethers";
import fetch from "isomorphic-fetch";

const arbAddr = "0x912CE59144191C1204E64559FE8253a0e49E6548";
const usdcAddr = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
const wethAddr = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";

enum Decimals {
  ABR = 18,
  ETH = 18,
  USDC = 6,
}

type QuoteConfig = {
  chainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  amount: bigint;
};

type AllowanceConfig = {
  chainId: number;
  tokenAddress: string;
  walletAddress: string;
};

type ApproveConfig = {
  chainId: number;
  tokenAddress: string;
  amount: bigint;
};

type SwapConfig = {
  chainId: number;
  fromTokenAddress: string;
  toTokenAddress: string;
  fromAddress: string;
  amount: bigint;
  slippage: number;
};

class OneInch {
  baseUrl: string;

  constructor() {
    this.baseUrl = "https://api.1inch.exchange/v5.0";
  }

  async getQuote(config: QuoteConfig) {
    const url = `${this.baseUrl}/${config.chainId}/quote?fromTokenAddress=${config.fromTokenAddress}&toTokenAddress=${config.toTokenAddress}&amount=${config.amount}`;
    const result = await this.getJson(url);
    if (!result.toTokenAmount) {
      console.log(result);
      throw new Error("expected tx data");
    }

    const { toTokenAmount } = result;

    return toTokenAmount;
  }

  async getAllowance(config: AllowanceConfig) {
    const url = `${this.baseUrl}/${config.chainId}/approve/allowance?tokenAddress=${config.tokenAddress}&walletAddress=${config.walletAddress}`;
    const result = await this.getJson(url);
    if (result.allowance === undefined) {
      console.log(result);
      throw new Error("expected tx data");
    }

    return result.allowance;
  }

  async getApproveTx(config: ApproveConfig) {
    const url = `${this.baseUrl}/${config.chainId}/approve/transaction?&amount=${config.amount}&tokenAddress=${config.tokenAddress}`;
    const result = await this.getJson(url);
    if (!result.data) {
      console.log(result);
      throw new Error("expected tx data");
    }

    const { data, to, value } = result;

    return {
      data,
      to,
      value,
    };
  }

  async getSwapTx(config: SwapConfig) {
    const url = `${this.baseUrl}/${config.chainId}/swap?fromTokenAddress=${config.fromTokenAddress}&toTokenAddress=${config.toTokenAddress}&amount=${config.amount}&fromAddress=${config.fromAddress}&slippage=${config.slippage}`;
    const result = await this.getJson(url);
    if (!result.tx) {
      console.log(result);
      throw new Error("expected tx data");
    }

    const { data, to, value } = result.tx;

    return {
      data,
      to,
      value,
    };
  }

  async getJson(url: string) {
    const res = await fetch(url);
    const json = await res.json();
    if (!json) {
      throw new Error("no response");
    }
    if (json.error) {
      console.log(json);
      throw new Error(json.description || json.error);
    }

    return json;
  }
}

async function main() {
  const oneInch = new OneInch();

  const rpc_provider = new ethers.JsonRpcProvider(
    "https://rpc.ankr.com/arbitrum"
  );

  const wallet = new ethers.Wallet("PRIV_KEY", rpc_provider);

  rpc_provider.getBlockNumber().then((blockNumber) => {
    console.log("rpc_provider.getBlockNumber", blockNumber);
  });

  // pre build inputs
  const chainId = 42161;
  const fromToken = arbAddr;
  const toToken = wethAddr;
  const slippage = 1; // 1%
  const walletAddress = await wallet.getAddress();
  const formattedAmount = "1"; // 1 eth
  const amount = ethers.parseUnits(formattedAmount, Decimals.ABR);

  const quoteConfig: QuoteConfig = {
    chainId: 42161,
    fromTokenAddress: wethAddr,
    toTokenAddress: usdcAddr,
    amount: 1000000000000000000n, // 1 eth
  };

  const toTokenAmount = await oneInch.getQuote(quoteConfig);

  console.log("quote: ", toTokenAmount);

  const allowanceConfig: AllowanceConfig = {
    chainId: chainId,
    tokenAddress: fromToken,
    walletAddress: "0x1bacc2205312534375c8d1801c27d28370656cff",
  };

  const allowance = await oneInch.getAllowance(allowanceConfig);

  console.log("allowance: ", allowance);

  const approveConfig: ApproveConfig = {
    chainId: chainId,
    tokenAddress: fromToken,
    amount: 100000n,
  };

  const approveTx = await oneInch.getApproveTx(approveConfig);

  console.log("approveTx: ", approveTx);

  const swapConfig: SwapConfig = {
    chainId: chainId,
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    fromAddress: walletAddress,
    amount: amount, // 1 eth
    slippage: slippage,
  };

  const swapTx = await oneInch.getSwapTx(swapConfig);

  console.log("swapTx: ", swapTx);

  const tx = await wallet.sendTransaction(swapTx);
  await tx.wait();

  console.log("done");
}

main().catch((err) => {
  console.error(err);
});
