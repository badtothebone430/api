import fetch from "node-fetch";

export async function handler(event, context) {
  try {
    const pathParts = event.path.split('/').filter(p => p);
    if (pathParts.length < 4 || pathParts[2] !== 'stock') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid path' })
      };
    }
    const ticker = pathParts[3].toUpperCase();

    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`);
    if (!res.ok) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Stock not found', ticker: ticker, status: res.status })
      };
    }

    const data = await res.json();
    const quote = data.quoteResponse.result[0];
    if (!quote) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Stock not found', ticker: ticker })
      };
    }

    const response = {
      symbol: quote.symbol,
      name: quote.shortName || quote.longName,
      price: quote.regularMarketPrice
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(response)
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}