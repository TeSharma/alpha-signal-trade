import { useState, useEffect } from 'react';
import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

// Contract ABIs (minimal interface)
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function'
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function'
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function'
  }
];

// Deployed contract addresses on Amoy testnet
export const TOKEN_ADDRESSES = {
  tUSD: '0xdb204732615f1EC2bDb1Aae2032bC9DE7aA8c164',
  tEUR: '0x0000000000000000000000000000000000000000', // Not yet deployed
  tGBP: '0x0000000000000000000000000000000000000000',
  tJPY: '0x0000000000000000000000000000000000000000',
  tAUD: '0x0000000000000000000000000000000000000000',
  tCAD: '0x0000000000000000000000000000000000000000',
  tCHF: '0x0000000000000000000000000000000000000000',
  tNZD: '0x0000000000000000000000000000000000000000',
};

// Updated to use the latest deployed addresses
export const ORACLE_ADDRESS = '0x8063A3901b9053f911fFE3da4bAF754B640A0744';
export const TRADING_PLATFORM_ADDRESS = '0xE13B97E70AF997dEaB3EAa28Ab88cCd362734729';

interface TokenBalance {
  symbol: string;
  balance: string;
  decimals: number;
  address: string;
}

export const useTokenContracts = () => {
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string>('');
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    initializeWeb3();
  }, []);

  const initializeWeb3 = async () => {
    if (typeof window.ethereum !== 'undefined') {
      const web3Instance = new Web3(window.ethereum);
      setWeb3(web3Instance);
      
      // Get current account
      const accounts = await web3Instance.eth.getAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0]);
      }

      // Listen for account changes
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        setAccount(accounts[0] || '');
      });
    }
  };

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        setAccount(accounts[0]);
        return accounts[0];
      } catch (error) {
        console.error('Error connecting wallet:', error);
        throw error;
      }
    } else {
      throw new Error('MetaMask not installed');
    }
  };

  const getTokenContract = (tokenAddress: string): any => {
    if (!web3) return null;
    return new web3.eth.Contract(ERC20_ABI as any, tokenAddress);
  };

  const getTokenBalance = async (tokenSymbol: keyof typeof TOKEN_ADDRESSES): Promise<string> => {
    if (!web3 || !account) return '0';
    
    const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return '0'; // Contract not deployed yet
    }

    const contract = getTokenContract(tokenAddress);
    if (!contract) return '0';

    try {
      const balance = await contract.methods.balanceOf(account).call();
      const decimals = await contract.methods.decimals().call();
      return (Number(balance) / Math.pow(10, Number(decimals))).toFixed(6);
    } catch (error) {
      console.error(`Error fetching ${tokenSymbol} balance:`, error);
      return '0';
    }
  };

  const getAllTokenBalances = async () => {
    if (!web3 || !account) return;
    
    setIsLoading(true);
    try {
      const balancePromises = Object.keys(TOKEN_ADDRESSES).map(async (symbol) => {
        const tokenSymbol = symbol as keyof typeof TOKEN_ADDRESSES;
        const balance = await getTokenBalance(tokenSymbol);
        const address = TOKEN_ADDRESSES[tokenSymbol];
        
        return {
          symbol: tokenSymbol,
          balance,
          decimals: 6, // Standard for stablecoins
          address
        };
      });

      const balanceResults = await Promise.all(balancePromises);
      setBalances(balanceResults);
    } catch (error) {
      console.error('Error fetching token balances:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const approveToken = async (
    tokenSymbol: keyof typeof TOKEN_ADDRESSES, 
    spender: string, 
    amount: string
  ): Promise<string> => {
    if (!web3 || !account) throw new Error('Web3 not initialized');
    
    const tokenAddress = TOKEN_ADDRESSES[tokenSymbol];
    const contract = getTokenContract(tokenAddress);
    if (!contract) throw new Error('Contract not found');

    try {
      const decimals = await contract.methods.decimals().call();
      const amountInSmallestUnit = BigInt(
        Math.floor(parseFloat(amount) * Math.pow(10, Number(decimals)))
      );

      const tx = await contract.methods
        .approve(spender, amountInSmallestUnit.toString())
        .send({ from: account });

      return tx.transactionHash;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  };

  return {
    web3,
    account,
    balances,
    isLoading,
    connectWallet,
    getTokenBalance,
    getAllTokenBalances,
    approveToken,
    getTokenContract,
  };
};
