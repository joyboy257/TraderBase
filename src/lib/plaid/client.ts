import { PlaidApi, Configuration, Products, CountryCode } from "plaid";
import axios from "axios";

function getBasePath(): string {
  switch (process.env.PLAID_ENV) {
    case "production":
      return "https://production.plaid.com";
    case "development":
      return "https://development.plaid.com";
    default:
      return "https://sandbox.plaid.com";
  }
}

const config = new Configuration({
  basePath: getBasePath(),
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
      "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
    },
  },
});

export const plaidClient = new PlaidApi(config);

export async function createLinkToken(userId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "TraderBase",
    products: [Products.Investments],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return response.data;
}

export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return response.data;
}

export async function getInvestmentHoldings(accessToken: string) {
  const response = await plaidClient.investmentsHoldingsGet({
    access_token: accessToken,
  });
  return response.data;
}

export async function getAccounts(accessToken: string) {
  const response = await plaidClient.accountsGet({
    access_token: accessToken,
  });
  return response.data;
}

/**
 * Verify a Plaid webhook is legitimate by calling /item/webhook/get.
 * The Plaid SDK does not expose this endpoint, so we call it directly.
 */
export async function verifyPlaidWebhook(accessToken: string): Promise<boolean> {
  try {
    const basePath = getBasePath();
    const response = await axios.post(
      `${basePath}/item/webhook/get`,
      { access_token: accessToken },
      {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
          "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
          "Content-Type": "application/json",
        },
      }
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Transform Plaid holdings data into positions table rows.
 * Shared by exchange-token, connections, and webhook handlers.
 * Guards against securities.find() returning undefined for stale Plaid data.
 */
export function transformHoldingsToPositions(
  accounts: Awaited<ReturnType<typeof getInvestmentHoldings>>["accounts"],
  holdings: Awaited<ReturnType<typeof getInvestmentHoldings>>["holdings"],
  securities: Awaited<ReturnType<typeof getInvestmentHoldings>>["securities"],
  userId: string,
  connectionId: string
): Array<{
  user_id: string;
  brokerage_connection_id: string;
  ticker: string;
  quantity: number;
  average_cost: number;
  current_price: number;
  unrealized_pnl: number;
}> {
  return accounts.flatMap((account) => {
    const accountHoldings = holdings.filter(
      (h) => h.account_id === account.account_id && h.quantity > 0
    );

    return accountHoldings.map((holding) => {
      const security = securities.find(
        (s) => s.security_id === holding.security_id
      );

      // Skip holdings with no matching security (Stale Plaid data edge case)
      if (!security) return null;

      const quantity = holding.quantity;
      const lastPrice = holding.institution_price ?? 0;
      const costBasis = holding.institution_value ?? 0;
      const ticker = security.ticker_symbol ?? security.name ?? "UNKNOWN";

      if (ticker === "UNKNOWN" || quantity <= 0) return null;

      return {
        user_id: userId,
        brokerage_connection_id: connectionId,
        ticker,
        quantity,
        average_cost: quantity > 0 ? costBasis / quantity : 0,
        current_price: lastPrice,
        unrealized_pnl: lastPrice * quantity - costBasis,
      };
    });
  }).filter((p): p is NonNullable<typeof p> => p !== null);
}
