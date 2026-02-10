import { ethers } from "ethers";
import { CONTRACT_ADDRESSES, AMOY_RPC_URL } from "../config/contracts";

// Get provider (wallet or RPC fallback)
export const getProvider = () => {
  if (window.ethereum) {
    return new ethers.BrowserProvider(window.ethereum);
  } else {
    console.warn("⚠️ No wallet found — using dedicated RPC");
    return new ethers.JsonRpcProvider(AMOY_RPC_URL);
  }
};

// Get signer (only if user connected wallet)
export const getSigner = async () => {
  const provider = getProvider();
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
    return await provider.getSigner();
  } catch (err) {
    console.error("❌ Wallet not connected:", err);
    return null;
  }
};

// Get contract instance
export const getContract = async (name: string, chain: keyof typeof CONTRACT_ADDRESSES = "amoy") => {
  const abi = await import(`../abi/${name}.json`);
  const provider = getProvider();
  const address = CONTRACT_ADDRESSES[chain][name];
  if (!address) throw new Error(`Address not found for ${name} on ${chain}`);

  return new ethers.Contract(address, abi, provider);
};

// Get contract with signer for write transactions
export const getWriteContract = async (name: string, chain: keyof typeof CONTRACT_ADDRESSES = "amoy") => {
  const signer = await getSigner();
  if (!signer) throw new Error("No signer available");
  const abi = await import(`../abi/${name}.json`);
  const address = CONTRACT_ADDRESSES[chain][name];
  return new ethers.Contract(address, abi, signer);
};
