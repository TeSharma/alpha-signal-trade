// Hedera Mirror Node API integration
import axios from 'axios';

const HEDERA_MIRROR_NODE_URL = 'https://mainnet-public.mirrornode.hedera.com/api/v1';
const HEDERA_TESTNET_URL = 'https://testnet.mirrornode.hedera.com/api/v1';

// Operator credentials for testnet (read-only account ID is public)
export const HEDERA_OPERATOR_ID = '0.0.6900218';

// Use testnet for development
const BASE_URL = import.meta.env.MODE === 'production' 
  ? HEDERA_MIRROR_NODE_URL 
  : HEDERA_TESTNET_URL;

export interface HederaAccountInfo {
  account: string;
  balance: {
    balance: number;
    timestamp: string;
  };
  evm_address: string | null;
  key?: {
    key: string;
  };
}

export interface HederaToken {
  token_id: string;
  balance: number;
  decimals?: number;
  name?: string;
  symbol?: string;
}

export interface HederaTransaction {
  transaction_id: string;
  consensus_timestamp: string;
  result: string;
  name: string;
  transfers?: Array<{
    account: string;
    amount: number;
  }>;
}

// ✅ Get account information
export async function getHederaAccountInfo(accountId: string): Promise<HederaAccountInfo> {
  try {
    const { data } = await axios.get(`${BASE_URL}/accounts/${accountId}`);
    return data;
  } catch (error: any) {
    console.error('Error fetching Hedera account:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch account info');
  }
}

// ✅ Get tokens associated with account
export async function getHederaAccountTokens(accountId: string): Promise<HederaToken[]> {
  try {
    const { data } = await axios.get(`${BASE_URL}/accounts/${accountId}/tokens`);
    return data.tokens || [];
  } catch (error: any) {
    console.error('Error fetching Hedera tokens:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch tokens');
  }
}

// ✅ Get account transactions with pagination
export async function getHederaAccountTransactions(
  accountId: string,
  limit: number = 10
): Promise<HederaTransaction[]> {
  try {
    let url = `${BASE_URL}/transactions?account.id=${accountId}&limit=${limit}&order=desc`;
    const transactions: HederaTransaction[] = [];
    
    // Fetch first page
    while (url && transactions.length < limit) {
      const { data } = await axios.get(url);
      transactions.push(...(data.transactions || []));
      
      // Check for next page
      if (data.links?.next && transactions.length < limit) {
        url = BASE_URL + data.links.next;
      } else {
        url = '';
      }
    }
    
    return transactions.slice(0, limit);
  } catch (error: any) {
    console.error('Error fetching Hedera transactions:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch transactions');
  }
}

// ✅ Get token information by token ID
export async function getHederaTokenInfo(tokenId: string) {
  try {
    const { data } = await axios.get(`${BASE_URL}/tokens/${tokenId}`);
    return data;
  } catch (error: any) {
    console.error('Error fetching token info:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch token info');
  }
}

// ✅ Check if user holds your project token (for access control)
export async function checkUserHoldsProjectToken(
  accountId: string,
  projectTokenId: string
): Promise<boolean> {
  try {
    const tokens = await getHederaAccountTokens(accountId);
    return tokens.some(token => token.token_id === projectTokenId && token.balance > 0);
  } catch (error) {
    console.error('Error checking token holdings:', error);
    return false;
  }
}

// ✅ Format Hedera account balance (from tinybars to HBAR)
export function formatHbarBalance(tinybars: number): string {
  return (tinybars / 100_000_000).toFixed(2);
}

// ✅ Validate Hedera account ID format
export function isValidHederaAccountId(accountId: string): boolean {
  // Format: 0.0.xxxxx
  const regex = /^0\.0\.\d+$/;
  return regex.test(accountId);
}
