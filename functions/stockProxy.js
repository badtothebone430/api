import fs from "fs";
import path from "path";
import fetch from "node-fetch";

// helper to read CSV
function readCSV() {
  const filePath = path.join(process.cwd(), "data.csv");
  const csv = fs.readFileSync(filePath, "utf8");
  const rows = csv.trim().split("\n").slice(1); // skip header
  return rows.map(line => {
    const parts = line.split(",");
    return {
      id: parseInt(parts[0], 10),
      symbol: parts[1],
      symbol_ext: parts[2],
      name: parts[3].replace(/^"|"$/g, "")
    };
  });
}

// Netlify function handler
export async function handler(event, context) {
  try {
    const stockTable = readCSV();

    // Optionally, filter out symbols starting with XJAM: or TRN:
    const filteredStocks = stockTable.filter(s => !s.symbol_ext.startsWith("XJAM:") && !s.symbol_ext.startsWith("TRN:"));

    // fetch prices concurrently
    const pricePromises = filteredStocks.map(async s => {
      try {
        const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}?interval=1d`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const price = data.chart.result?.[0]?.meta?.regularMarketPrice || null;
        return { ...s, price };
      } catch (err) {
        console.error(`Failed to fetch ${s.symbol}:`, err.message);
        return { ...s, price: null };
      }
    });

    const prices = await Promise.all(pricePromises);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(prices),
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
