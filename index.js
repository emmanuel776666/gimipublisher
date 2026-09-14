require("dotenv").config();

const Parser = require("rss-parser");
const { GoogleGenAI } = require("@google/genai");

const parser = new Parser();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const greetings = [
  "🌅 Good morning! Here's your quick look at today's biggest stories.",
  "☀️ Good morning! Let's catch up on what happened around the world yesterday.",
  "🌍 Morning update! Here are the stories making headlines today.",
  "📰 Good morning! Here's what you need to know this morning.",
];

function getGreeting() {
  const day = new Date().getDay();
  return greetings[day % greetings.length];
}


// Get yesterday's date in Nigeria
function getNigeriaYesterday() {
  const now = new Date();

  const nigeriaDate = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Africa/Lagos",
    })
  );

  nigeriaDate.setDate(nigeriaDate.getDate() - 1);

  return nigeriaDate.toISOString().split("T")[0];
}


// News sources
const feeds = {
  world: [
    "https://feeds.bbci.co.uk/news/world/rss.xml",
    "https://rss.app/feeds/v1.1/_Zp3zJqQfW4v5W5x8.json",
  ],

  football: [
    "https://feeds.bbci.co.uk/sport/football/rss.xml",
  ],

  technology: [
    "https://feeds.bbci.co.uk/news/technology/rss.xml",
  ],

  economy: [
    "https://feeds.bbci.co.uk/news/business/rss.xml",
  ],
};


// Get news from an RSS feed
async function getFeed(url) {
  try {
    const feed = await parser.parseURL(url);

    return feed.items.map((item) => ({
      title: item.title,
      description: item.contentSnippet || item.content || "",
      date: item.isoDate || item.pubDate || "",
      link: item.link || "",
    }));
  } catch (error) {
    console.log("Feed error:", url);
    return [];
  }
}


// Collect news
async function collectNews() {
  console.log("Researching the latest news...");

  const yesterday = getNigeriaYesterday();

  console.log("Research date:", yesterday);

  const results = {};

  for (const category of Object.keys(feeds)) {
    results[category] = [];

    for (const feedUrl of feeds[category]) {
      const articles = await getFeed(feedUrl);

      for (const article of articles) {
        if (!article.date) continue;

        const articleDate = new Date(article.date)
          .toISOString()
          .split("T")[0];

        if (articleDate === yesterday) {
          results[category].push(article);
        }
      }
    }
  }

  return results;
}


// Ask Gemini to write the Facebook post
async function createPost(news) {
  console.log("Creating Facebook post with Gemini...");

  const prompt = `
You are a professional morning news editor.

Today is September 14, 2026.

The news below was collected from RSS feeds.
The target news date is ${getNigeriaYesterday()}.

Create a short Facebook morning news briefing.

IMPORTANT:
- Only use information contained in the supplied news.
- Do not invent facts.
- Do not add stories that are not supplied.
- Select the most important stories.
- Mention the source name when possible.
- Keep the language simple and natural.
- No Markdown.
- No URLs.
- No website addresses.
- No hashtags.
- Maximum 400 words.

Use exactly this structure:

${getGreeting()}

🌍 WORLD NEWS:
2 important stories.

⚽ FOOTBALL:
2 important football stories.

💻 TECHNOLOGY:
2 important technology stories.

💰 ECONOMY:
2 important economy/business stories.

End with one short positive morning message.

NEWS DATA:

WORLD:
${JSON.stringify(news.world, null, 2)}

FOOTBALL:
${JSON.stringify(news.football, null, 2)}

TECHNOLOGY:
${JSON.stringify(news.technology, null, 2)}

ECONOMY:
${JSON.stringify(news.economy, null, 2)}
`;

  const response = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: prompt,
  });

  const post = response.candidates?.[0]?.content?.parts
    ?.filter((part) => part.text)
    .map((part) => part.text)
    .join("")
    .trim();

  if (!post) {
    throw new Error("Gemini returned an empty response.");
  }

  return post;
}

async function postToFacebook(message) {
  console.log("\nPosting to Facebook...");

  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    throw new Error("Facebook Page ID or access token is missing.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${pageId}/feed`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: message,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Facebook API Error: ${JSON.stringify(data)}`
    );
  }

  console.log("Facebook post successful!");
  console.log("Post ID:", data.id);

  return data;
}

// Main bot
async function runBot() {
  try {
    console.log("\n====================================");
    console.log("MORNING NEWS BOT");
    console.log("====================================");

    const news = await collectNews();

    console.log("\nArticles found:");

    console.log("World:", news.world.length);
    console.log("Football:", news.football.length);
    console.log("Technology:", news.technology.length);
    console.log("Economy:", news.economy.length);

    const post = await createPost(news);

    console.log("\n====================================");
    console.log("FACEBOOK POST");
    console.log("====================================");

    console.log(post);
     await postToFacebook(post);
    console.log("\n====================================");
    console.log("BOT FINISHED");
    console.log("====================================");

  } catch (error) {
    console.error("\nBOT ERROR:");
    console.error(error);
  }
}



runBot();