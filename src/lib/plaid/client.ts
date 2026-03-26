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
