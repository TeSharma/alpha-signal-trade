import Web3 from 'web3';

let web3Instance = null;

export const getWeb3 = () => {
  if (!web3Instance && window.ethereum) {
    web3Instance = new Web3(window.ethereum);
  }
  return web3Instance;
};

export const connectToBlockchain = async () => {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      return true;
    } catch (error) {
      console.error('Error connecting to blockchain:', error);
      return false;
    }
  } else {
    console.log('No Ethereum provider found');
    return false;
  }
};

export const getContractInstance = (contractAddress, contractAbi) => {
  const contract = new web3.eth.Contract(contractAbi, contractAddress);
  return contract;
};
