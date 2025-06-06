import Web3 from 'web3';

const web3 = new Web3(window.ethereum);

export const getWeb3 = () => web3;

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
