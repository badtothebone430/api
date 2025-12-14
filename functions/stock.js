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
    const pathParts = (event.path || '').split('/').filter(p => p);
    // Support both Netlify function path: /.netlify/functions/stock/TSLA
    // and friendly routes: /stock/TSLA or /stocks/TSLA
    let ticker = null;
    const symbolFromQuery = event.queryStringParameters && (event.queryStringParameters.symbol || event.queryStringParameters.ticker);
    if (symbolFromQuery) ticker = String(symbolFromQuery).toUpperCase();
    else if (pathParts.length >= 4 && pathParts[0] === '.netlify' && pathParts[1] === 'functions' && (pathParts[2] === 'stock' || pathParts[2] === 'stocks')) {
      ticker = pathParts[3] ? pathParts[3].toUpperCase() : null;
    } else if (pathParts.length >= 2 && (pathParts[0] === 'stock' || pathParts[0] === 'stocks')) {
      ticker = pathParts[1] ? pathParts[1].toUpperCase() : null;
    }

    if (!ticker) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required symbol. Use /stocks/TSLA, /stock/TSLA, /.netlify/functions/stock/TSLA or ?symbol=TSLA' })
      };
    }

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
      exchange: exchangeMap[meta.fullExchangeName] || meta.exchangeName
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