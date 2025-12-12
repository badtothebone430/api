import fetch from "node-fetch";
import fs from "fs";
import path from "path";

function splitCsvLine(line) {
  // split on commas not inside quotes
  return line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
}

function parsePrice(priceStr) {
  if (!priceStr) return null;
  // remove currency symbols and commas
  const cleaned = priceStr.replace(/[^0-9.\-]+/g, '');
  const v = parseFloat(cleaned);
  return Number.isFinite(v) ? v : null;
}

export async function handler(event, context) {
  let parsedTicker = null;
  try {
    const rootCsv = path.resolve(__dirname, '..', 'data.csv');
    const csv = fs.readFileSync(rootCsv, 'utf8');
    const lines = csv.split('\n').filter(l => l.trim());
    const header = lines.shift();
    const cols = header.split(',').map(c => c.trim());

    // Accept ticker from the path segment `/functions/evaluate/TICKER` or query param
    const pathParts = (event.path || '').split('/').filter(p => p);
    let tickerQuery = null;
    // Netlify function path looks like: /.netlify/functions/evaluate/TSLA
    if (pathParts.length >= 4 && pathParts[0] === '.netlify' && pathParts[1] === 'functions' && pathParts[2] === 'evaluate') {
      tickerQuery = pathParts[3] ? pathParts[3].toUpperCase() : null;
    }
    if (!tickerQuery && event.queryStringParameters && event.queryStringParameters.ticker) {
      tickerQuery = event.queryStringParameters.ticker.toUpperCase();
    }

    if (!tickerQuery) {
      parsedTicker = tickerQuery;
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: 'Missing required ticker. Use path `/.netlify/functions/evaluate/TSLA` or `?ticker=TSLA`', parsedTicker: parsedTicker })
      };
    }

    // find the CSV row for the ticker (if any) to use as fallback price
    const matchLine = lines.find(l => {
      const parts = splitCsvLine(l);
      const symbol = (parts[1] || '').replace(/\"/g, '').trim().toUpperCase();
      return symbol === tickerQuery;
    });

    const symbol = tickerQuery;
    const gameCsvPrice = matchLine ? parsePrice((splitCsvLine(matchLine)[4] || '').trim()) : null;

    // fetch game API price
    let gameApiPrice = null;
    try {
      const gRes = await fetch(`https://virtualstockmarketgame.com/getstock/${symbol}`);
      if (gRes.ok) {
        const gData = await gRes.json();
        if (gData && typeof gData.price === 'number') gameApiPrice = gData.price;
      }
    } catch (e) {
      // ignore
    }

    const gamePrice = (gameApiPrice !== null && Number.isFinite(gameApiPrice)) ? gameApiPrice : gameCsvPrice;

    // fetch our real price via existing netlify function
    let realPrice = null;
    try {
      const ourRes = await fetch(`https://test--lokiapi.netlify.app/.netlify/functions/stock/${symbol}`);
      if (ourRes.ok) {
        const ourData = await ourRes.json();
        if (ourData && typeof ourData.price === 'number') realPrice = ourData.price;
      }
    } catch (e) {
      // ignore
    }

    const diff = (realPrice !== null && gamePrice !== null) ? (realPrice - gamePrice) : null;
    const diffPercent = (diff !== null && gamePrice) ? (diff / gamePrice) * 100 : null;

    // threshold can be provided via query param (in dollars). Default = 5
    const rawThreshold = event.queryStringParameters && event.queryStringParameters.threshold;
    let threshold = 5;
    if (rawThreshold !== undefined) {
      const parsed = parseFloat(rawThreshold);
      if (Number.isFinite(parsed) && parsed >= 0) threshold = parsed;
    }

    let signal = null;
    if (diff !== null) {
      if (Math.abs(diff) >= threshold) {
        signal = diff > 0 ? 'buy' : 'sell';
      } else {
        signal = null;
      }
    }

    // If neither price is available, return 404
    if (gamePrice === null && realPrice === null) {
      parsedTicker = symbol;
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: 'No price data found for ticker', ticker: symbol, parsedTicker: parsedTicker })
      };
    }

    const result = {
      ticker: symbol,
      gamePrice: gamePrice,
      realPrice: realPrice,
      diff: diff !== null ? Number(diff.toFixed(4)) : null,
      diffPercent: diffPercent !== null ? Number(diffPercent.toFixed(4)) : null,
      signal: signal
    };

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(result)
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message, parsedTicker: parsedTicker })
    };
  }
}
