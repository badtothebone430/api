import fetch from "node-fetch";

const exchangeMap = {
  'NasdaqGS': 'NSDQ',
  'New York Stock Exchange': 'NYSE',
  'NYSE American': 'AMEX',
  'Cboe': 'CBOE',
  'Toronto Stock Exchange': 'TSX',
  'London Stock Exchange': 'LSE',
  // Add more as needed
};

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

    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    if (!res.ok) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Stock not found', ticker: ticker, status: res.status })
      };
    }

    const data = await res.json();
    const meta = data.chart.result?.[0]?.meta;
    if (!meta) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Stock not found', ticker: ticker })
      };
    }

    const response = {
      symbol: meta.symbol,
      name: meta.shortName || meta.longName,
      price: meta.regularMarketPrice,
      exchange: meta.fullExchangeName || meta.exchangeName
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