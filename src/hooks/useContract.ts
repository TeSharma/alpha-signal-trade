import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContract, getWriteContract } from "../utils/web3";

export const useContract = (name: string, write = false) => {
  const [contract, setContract] = useState<ethers.Contract | null>(null);

  useEffect(() => {
    const loadContract = async () => {
      try {
        const instance = write
          ? await getWriteContract(name)
          : await getContract(name);
        setContract(instance);
      } catch (err) {
        console.error(`Failed to load ${name} contract:`, err);
      }
    };
    loadContract();
  }, [name, write]);

  return contract;
};
