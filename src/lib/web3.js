import Web3 from 'web3';

let web3Instance;

export const getWeb3 = () => {
  if (!web3Instance && window.ethereum) {
    web3Instance = new Web3(window.ethereum);
  }
  return web3Instance;
};

export const connectToBlockchain = async () => {
  if (!window.ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
  }

  try {
    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    if (accounts.length === 0) {
      throw new Error('No accounts found. Please unlock MetaMask.');
    }

    // Initialize web3 instance
    web3Instance = new Web3(window.ethereum);
    
    // Check network
    const networkId = await web3Instance.eth.net.getId();
    console.log('Connected to network:', networkId);
    
    return true;
  } catch (error) {
    console.error('Error connecting to blockchain:', error);
    
    // Handle specific error cases
    if (error.code === 4001) {
      throw new Error('Connection rejected. Please approve the connection request.');
    } else if (error.code === -32002) {
      throw new Error('Connection request already pending. Please check MetaMask.');
    }
    
    throw error;
  }
};

export const getAccounts = async () => {
  const web3 = getWeb3();
  if (!web3) {
    throw new Error('Web3 not initialized');
  }
  
  try {
    const accounts = await web3.eth.getAccounts();
    return accounts;
  } catch (error) {
    console.error('Error getting accounts:', error);
    throw error;
  }
};

export const getBalance = async (address) => {
  const web3 = getWeb3();
  if (!web3) {
    throw new Error('Web3 not initialized');
  }
  
  try {
    const balance = await web3.eth.getBalance(address);
    return web3.utils.fromWei(balance, 'ether');
  } catch (error) {
    console.error('Error getting balance:', error);
    throw error;
  }
};

export const getNetworkInfo = async () => {
  const web3 = getWeb3();
  if (!web3) {
    throw new Error('Web3 not initialized');
  }
  
  try {
    const networkId = await web3.eth.net.getId();
    const networkNames = {
      1: 'Ethereum Mainnet',
      3: 'Ropsten Testnet',
      4: 'Rinkeby Testnet',
      5: 'Goerli Testnet',
      42: 'Kovan Testnet',
      137: 'Polygon Mainnet',
      80001: 'Polygon Mumbai Testnet'
    };
    
    return {
      networkId,
      networkName: networkNames[networkId] || `Network ${networkId}`
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    throw error;
  }
};

export const isConnected = async () => {
  if (!window.ethereum) {
    return false;
  }
  
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    return accounts.length > 0;
  } catch (error) {
    console.error('Error checking connection:', error);
    return false;
  }
};

export const getContractInstance = (contractAddress, contractAbi) => {
  const web3 = getWeb3();
  if (!web3) {
    throw new Error('Web3 not initialized');
  }
  
  if (!contractAddress || !contractAbi) {
    throw new Error('Contract address and ABI are required');
  }
  
  try {
    const contract = new web3.eth.Contract(contractAbi, contractAddress);
    return contract;
  } catch (error) {
    console.error('Error creating contract instance:', error);
    throw error;
  }
};

// Event listeners for account and network changes
export const setupEventListeners = (onAccountChange, onNetworkChange) => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', onAccountChange);
    window.ethereum.on('chainChanged', onNetworkChange);
  }
};

export const removeEventListeners = (onAccountChange, onNetworkChange) => {
  if (window.ethereum) {
    window.ethereum.removeListener('accountsChanged', onAccountChange);
    window.ethereum.removeListener('chainChanged', onNetworkChange);
  }
};
